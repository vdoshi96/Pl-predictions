import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  predictionCategoryPicks,
  predictions,
  players,
  spotlightResultItems,
  spotlightResultSnapshotAliases,
  spotlightResultSnapshots,
  spotlightResultStates,
  teams,
} from "@/db/schema";
import {
  isPredictionCategory,
  PREDICTION_CATEGORY_DEFINITIONS,
  type PredictionCategory,
} from "@/features/predictions/categories";
import { rankMetricItems } from "@/features/scoring/categories";

import {
  formatSpotlightMetric,
  resolveSpotlightResult,
  type ResolvedSpotlightResult,
} from "./scoring";
import {
  isSpotlightResultDataset,
  RESULT_DATASET_BY_CATEGORY,
  type SpotlightResultDataset,
} from "./types";

type ActiveResultSnapshot = Readonly<{
  coveredThroughRank: number;
  dataset: SpotlightResultDataset;
  id: string;
}>;

type ActiveResultItem = Readonly<{
  metricValue: number;
  outcomeRank: number;
  playerId: string | null;
  snapshotId: string;
  teamId: string | null;
}>;

type ResultPick = Readonly<{
  category: PredictionCategory;
  normalizedCustomPlayerName: string | null;
  playerId: string | null;
  predictionId: string;
  teamId: string | null;
}>;

function subjectIdForPick(
  pick: ResultPick,
  aliasPlayerIdByName: ReadonlyMap<string, string>,
): { id: string | null; identityResolved: boolean } {
  if (pick.teamId) return { id: pick.teamId, identityResolved: true };
  if (pick.playerId) return { id: pick.playerId, identityResolved: true };
  if (!pick.normalizedCustomPlayerName) {
    return { id: null, identityResolved: false };
  }
  const aliasPlayerId = aliasPlayerIdByName.get(
    pick.normalizedCustomPlayerName,
  );
  return {
    id: aliasPlayerId ?? null,
    identityResolved: Boolean(aliasPlayerId),
  };
}

export type CategoryOutcomeLeader = Readonly<{
  assetPath: string | null;
  category: PredictionCategory;
  displayName: string;
  metricLabel: string;
  shortName: string | null;
  subject: "player" | "team";
}>;

export type CategoryOutcomeLeadersView = Readonly<{
  leaders: Partial<Record<PredictionCategory, CategoryOutcomeLeader>>;
  liveCategories: readonly PredictionCategory[];
}>;

function categoriesForDataset(
  dataset: SpotlightResultDataset,
): PredictionCategory[] {
  return PREDICTION_CATEGORY_DEFINITIONS.flatMap((definition) =>
    RESULT_DATASET_BY_CATEGORY[definition.category] === dataset
      ? [definition.category]
      : [],
  );
}

export async function getCategoryOutcomeLeaders(
  seasonId: string,
  activeBracketCount: number,
): Promise<CategoryOutcomeLeadersView> {
  if (activeBracketCount < 1) {
    return { leaders: {}, liveCategories: [] };
  }
  const db = getDb();
  const snapshotRows = await db
    .select({
      coveredThroughRank: spotlightResultSnapshots.coveredThroughRank,
      dataset: spotlightResultStates.dataset,
      id: spotlightResultSnapshots.id,
    })
    .from(spotlightResultStates)
    .innerJoin(
      spotlightResultSnapshots,
      eq(spotlightResultSnapshots.id, spotlightResultStates.activeSnapshotId),
    )
    .where(
      and(
        eq(spotlightResultStates.seasonId, seasonId),
        isNotNull(spotlightResultStates.activeSnapshotId),
        isNotNull(spotlightResultSnapshots.coveredThroughRank),
        isNotNull(spotlightResultSnapshots.sealedAt),
      ),
    );
  const snapshots = snapshotRows.flatMap((snapshot) =>
    isSpotlightResultDataset(snapshot.dataset)
      ? [{ dataset: snapshot.dataset, id: snapshot.id }]
      : [],
  );
  if (snapshots.length === 0) {
    return { leaders: {}, liveCategories: [] };
  }
  const [itemRows, pickRows, aliasRows] = await Promise.all([
    db
      .select({
        metricValue: spotlightResultItems.metricValue,
        outcomeRank: spotlightResultItems.outcomeRank,
        playerAssetPath: players.assetPath,
        playerDisplayName: players.displayName,
        playerId: spotlightResultItems.playerId,
        snapshotId: spotlightResultItems.snapshotId,
        teamAssetPath: teams.assetPath,
        teamDisplayName: teams.displayName,
        teamId: spotlightResultItems.teamId,
        teamShortName: teams.shortName,
      })
      .from(spotlightResultItems)
      .leftJoin(players, eq(players.id, spotlightResultItems.playerId))
      .leftJoin(teams, eq(teams.id, spotlightResultItems.teamId))
      .where(
        inArray(
          spotlightResultItems.snapshotId,
          snapshots.map((snapshot) => snapshot.id),
        ),
      ),
    db
      .select({
        category: predictionCategoryPicks.category,
        normalizedCustomPlayerName:
          predictionCategoryPicks.normalizedCustomPlayerName,
        playerId: predictionCategoryPicks.playerId,
        predictionId: predictionCategoryPicks.predictionId,
        teamId: predictionCategoryPicks.teamId,
      })
      .from(predictionCategoryPicks)
      .innerJoin(
        predictions,
        eq(predictions.id, predictionCategoryPicks.predictionId),
      )
      .where(eq(predictions.seasonId, seasonId)),
    db
      .select({
        normalizedCustomPlayerName:
          spotlightResultSnapshotAliases.normalizedCustomPlayerName,
        playerId: spotlightResultSnapshotAliases.playerId,
        snapshotId: spotlightResultSnapshotAliases.snapshotId,
      })
      .from(spotlightResultSnapshotAliases)
      .where(
        inArray(
          spotlightResultSnapshotAliases.snapshotId,
          snapshots.map((snapshot) => snapshot.id),
        ),
      ),
  ]);
  const itemsBySnapshot = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const group = itemsBySnapshot.get(item.snapshotId) ?? [];
    group.push(item);
    itemsBySnapshot.set(item.snapshotId, group);
  }
  const leaders: Partial<Record<PredictionCategory, CategoryOutcomeLeader>> =
    {};
  const liveCategories = snapshots.flatMap((snapshot) =>
    snapshot.dataset === "player_ratings"
      ? []
      : categoriesForDataset(snapshot.dataset),
  );

  for (const snapshot of snapshots) {
    const items = itemsBySnapshot.get(snapshot.id) ?? [];
    for (const category of categoriesForDataset(snapshot.dataset)) {
      const aliasPlayerIdByName = new Map(
        aliasRows.flatMap((alias) =>
          alias.snapshotId === snapshot.id
            ? [[alias.normalizedCustomPlayerName, alias.playerId] as const]
            : [],
        ),
      );
      const eligiblePlayerIds = new Set(
        pickRows.flatMap((pick) => {
          if (
            pick.category !== category ||
            (category !== "underdog_player" && category !== "overrated_player")
          ) {
            return [];
          }
          const subject = subjectIdForPick(
            {
              ...pick,
              category,
            },
            aliasPlayerIdByName,
          );
          return subject.identityResolved && subject.id ? [subject.id] : [];
        }),
      );
      const leader =
        category === "overrated_player"
          ? rankMetricItems(
              items.flatMap((item) =>
                item.playerId && eligiblePlayerIds.has(item.playerId)
                  ? [{ id: item.playerId, item, metric: item.metricValue }]
                  : [],
              ),
              "ascending",
            ).find((item) => item.rank === 1)?.item
          : category === "underdog_player"
            ? rankMetricItems(
                items.flatMap((item) =>
                  item.playerId && eligiblePlayerIds.has(item.playerId)
                    ? [{ id: item.playerId, item, metric: item.metricValue }]
                    : [],
                ),
                "descending",
              ).find((item) => item.rank === 1)?.item
            : items.find((item) => item.outcomeRank === 1);
      if (!leader) continue;
      if (category === "underdog_player" || category === "overrated_player") {
        liveCategories.push(category);
      }
      const subject = leader.playerId ? "player" : "team";
      const displayName =
        subject === "player"
          ? leader.playerDisplayName
          : leader.teamDisplayName;
      if (!displayName) continue;
      leaders[category] = {
        assetPath:
          subject === "player" ? leader.playerAssetPath : leader.teamAssetPath,
        category,
        displayName,
        metricLabel: formatSpotlightMetric(category, leader.metricValue),
        shortName: subject === "team" ? leader.teamShortName : null,
        subject,
      };
    }
  }

  return { leaders, liveCategories };
}

export async function getActiveSpotlightAliasResolutions(
  seasonId: string,
): Promise<
  Array<{
    assetPath: string | null;
    category: PredictionCategory;
    displayName: string;
    normalizedCustomPlayerName: string;
    playerId: string;
  }>
> {
  const rows = await getDb()
    .select({
      assetPath: players.assetPath,
      dataset: spotlightResultStates.dataset,
      displayName: players.displayName,
      normalizedCustomPlayerName:
        spotlightResultSnapshotAliases.normalizedCustomPlayerName,
      playerId: spotlightResultSnapshotAliases.playerId,
    })
    .from(spotlightResultStates)
    .innerJoin(
      spotlightResultSnapshots,
      eq(spotlightResultSnapshots.id, spotlightResultStates.activeSnapshotId),
    )
    .innerJoin(
      spotlightResultSnapshotAliases,
      eq(
        spotlightResultSnapshotAliases.snapshotId,
        spotlightResultSnapshots.id,
      ),
    )
    .innerJoin(players, eq(players.id, spotlightResultSnapshotAliases.playerId))
    .where(
      and(
        eq(spotlightResultStates.seasonId, seasonId),
        isNotNull(spotlightResultSnapshots.coveredThroughRank),
        isNotNull(spotlightResultSnapshots.sealedAt),
      ),
    );

  return rows.flatMap((row) =>
    isSpotlightResultDataset(row.dataset)
      ? categoriesForDataset(row.dataset).map((category) => ({
          assetPath: row.assetPath,
          category,
          displayName: row.displayName,
          normalizedCustomPlayerName: row.normalizedCustomPlayerName,
          playerId: row.playerId,
        }))
      : [],
  );
}

export function buildManualResultAssignments({
  activeBracketCount,
  aliases,
  items,
  picks,
  snapshots,
}: {
  activeBracketCount: number;
  aliases: readonly {
    normalizedCustomPlayerName: string;
    playerId: string;
    snapshotId: string;
  }[];
  items: readonly ActiveResultItem[];
  picks: readonly ResultPick[];
  snapshots: readonly ActiveResultSnapshot[];
}): Map<string, Map<PredictionCategory, ResolvedSpotlightResult>> {
  if (activeBracketCount < 1) return new Map();
  const snapshotByDataset = new Map(
    snapshots.map((snapshot) => [snapshot.dataset, snapshot] as const),
  );
  const itemsBySnapshot = new Map<string, ActiveResultItem[]>();
  for (const item of items) {
    const group = itemsBySnapshot.get(item.snapshotId) ?? [];
    group.push(item);
    itemsBySnapshot.set(item.snapshotId, group);
  }
  const aliasPlayerIdBySnapshot = new Map<string, Map<string, string>>();
  for (const alias of aliases) {
    const snapshotAliases =
      aliasPlayerIdBySnapshot.get(alias.snapshotId) ??
      new Map<string, string>();
    snapshotAliases.set(alias.normalizedCustomPlayerName, alias.playerId);
    aliasPlayerIdBySnapshot.set(alias.snapshotId, snapshotAliases);
  }
  const result = new Map<
    string,
    Map<PredictionCategory, ResolvedSpotlightResult>
  >();
  const ratingSnapshot = snapshotByDataset.get("player_ratings");
  const rankedRatingByCategory = new Map<
    "overrated_player" | "underdog_player",
    Map<string, { item: ActiveResultItem; rank: number }>
  >();
  if (ratingSnapshot) {
    const snapshotAliases =
      aliasPlayerIdBySnapshot.get(ratingSnapshot.id) ?? new Map();
    const ratingItems = itemsBySnapshot.get(ratingSnapshot.id) ?? [];
    for (const category of ["underdog_player", "overrated_player"] as const) {
      const eligiblePlayerIds = new Set(
        picks.flatMap((pick) => {
          if (pick.category !== category) return [];
          const subject = subjectIdForPick(pick, snapshotAliases);
          return subject.identityResolved && subject.id ? [subject.id] : [];
        }),
      );
      const ranked = rankMetricItems(
        ratingItems.flatMap((item) =>
          item.playerId && eligiblePlayerIds.has(item.playerId)
            ? [
                {
                  id: item.playerId,
                  item,
                  metric: item.metricValue,
                },
              ]
            : [],
        ),
        category === "overrated_player" ? "ascending" : "descending",
      );
      rankedRatingByCategory.set(
        category,
        new Map(
          ranked.map(({ id, item, rank }) => [id, { item, rank }] as const),
        ),
      );
    }
  }

  for (const pick of picks) {
    const dataset = RESULT_DATASET_BY_CATEGORY[pick.category];
    if (!dataset) continue;
    const snapshot = snapshotByDataset.get(dataset);
    if (!snapshot) continue;
    const datasetItems = itemsBySnapshot.get(snapshot.id) ?? [];
    const { id: subjectId, identityResolved } = subjectIdForPick(
      pick,
      aliasPlayerIdBySnapshot.get(snapshot.id) ?? new Map(),
    );
    if (!identityResolved) continue;

    let matchingItem: ActiveResultItem | undefined;
    let outcomeRank: number | undefined;
    if (
      pick.category === "underdog_player" ||
      pick.category === "overrated_player"
    ) {
      if (!subjectId) continue;
      const ranked = rankedRatingByCategory.get(pick.category)?.get(subjectId);
      if (!ranked) continue;
      matchingItem = ranked.item;
      outcomeRank = ranked.rank;
    } else {
      matchingItem = datasetItems.find(
        (item) => (item.playerId ?? item.teamId) === subjectId,
      );
      if (
        matchingItem &&
        matchingItem.outcomeRank <= snapshot.coveredThroughRank
      ) {
        outcomeRank = matchingItem.outcomeRank;
      } else {
        matchingItem = undefined;
      }
    }

    const resolved = resolveSpotlightResult({
      activeBracketCount,
      category: pick.category,
      coveredThroughRank: snapshot.coveredThroughRank,
      metricValue: matchingItem?.metricValue,
      outcomeRank,
    });
    if (!resolved) continue;
    const byCategory = result.get(pick.predictionId) ?? new Map();
    byCategory.set(pick.category, resolved);
    result.set(pick.predictionId, byCategory);
  }

  return result;
}

export async function getManualResultAssignments(
  seasonId: string,
  predictionIds: readonly string[],
  activeBracketCount: number,
): Promise<Map<string, Map<PredictionCategory, ResolvedSpotlightResult>>> {
  if (predictionIds.length === 0 || activeBracketCount < 1) return new Map();
  const db = getDb();
  const snapshotRows = await db
    .select({
      coveredThroughRank: spotlightResultSnapshots.coveredThroughRank,
      dataset: spotlightResultStates.dataset,
      id: spotlightResultSnapshots.id,
    })
    .from(spotlightResultStates)
    .innerJoin(
      spotlightResultSnapshots,
      eq(spotlightResultSnapshots.id, spotlightResultStates.activeSnapshotId),
    )
    .where(
      and(
        eq(spotlightResultStates.seasonId, seasonId),
        isNotNull(spotlightResultStates.activeSnapshotId),
      ),
    );
  const snapshots = snapshotRows.flatMap((snapshot) =>
    snapshot.coveredThroughRank !== null &&
    isSpotlightResultDataset(snapshot.dataset)
      ? [
          {
            coveredThroughRank: snapshot.coveredThroughRank,
            dataset: snapshot.dataset,
            id: snapshot.id,
          },
        ]
      : [],
  );
  if (snapshots.length === 0) return new Map();

  const [itemRows, pickRows, aliasRows] = await Promise.all([
    db
      .select({
        metricValue: spotlightResultItems.metricValue,
        outcomeRank: spotlightResultItems.outcomeRank,
        playerId: spotlightResultItems.playerId,
        snapshotId: spotlightResultItems.snapshotId,
        teamId: spotlightResultItems.teamId,
      })
      .from(spotlightResultItems)
      .where(
        inArray(
          spotlightResultItems.snapshotId,
          snapshots.map((snapshot) => snapshot.id),
        ),
      ),
    db
      .select({
        category: predictionCategoryPicks.category,
        normalizedCustomPlayerName:
          predictionCategoryPicks.normalizedCustomPlayerName,
        playerId: predictionCategoryPicks.playerId,
        predictionId: predictionCategoryPicks.predictionId,
        teamId: predictionCategoryPicks.teamId,
      })
      .from(predictionCategoryPicks)
      .innerJoin(
        predictions,
        eq(predictions.id, predictionCategoryPicks.predictionId),
      )
      .where(eq(predictions.seasonId, seasonId)),
    db
      .select({
        normalizedCustomPlayerName:
          spotlightResultSnapshotAliases.normalizedCustomPlayerName,
        playerId: spotlightResultSnapshotAliases.playerId,
        snapshotId: spotlightResultSnapshotAliases.snapshotId,
      })
      .from(spotlightResultSnapshotAliases)
      .where(
        inArray(
          spotlightResultSnapshotAliases.snapshotId,
          snapshots.map((snapshot) => snapshot.id),
        ),
      ),
  ]);
  const picks = pickRows.flatMap((pick) =>
    isPredictionCategory(pick.category)
      ? [{ ...pick, category: pick.category }]
      : [],
  );

  const assignments = buildManualResultAssignments({
    activeBracketCount,
    aliases: aliasRows,
    items: itemRows,
    picks,
    snapshots,
  });
  const requestedPredictionIds = new Set(predictionIds);
  return new Map(
    [...assignments].filter(([predictionId]) =>
      requestedPredictionIds.has(predictionId),
    ),
  );
}
