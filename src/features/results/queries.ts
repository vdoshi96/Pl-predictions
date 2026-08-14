import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  predictionCategoryPicks,
  spotlightResultItems,
  spotlightResultSnapshotAliases,
  spotlightResultSnapshots,
  spotlightResultStates,
} from "@/db/schema";
import {
  isPredictionCategory,
  type PredictionCategory,
} from "@/features/predictions/categories";
import { rankMetricItems } from "@/features/scoring/categories";

import {
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
    if (pick.category === "overrated_player") {
      const ascending = rankMetricItems(
        datasetItems.flatMap((item) =>
          item.playerId
            ? [
                {
                  id: item.playerId,
                  item,
                  metric: item.metricValue,
                },
              ]
            : [],
        ),
        "ascending",
      );
      const ranked = ascending.find((item) => item.id === subjectId);
      if (ranked && ranked.rank <= snapshot.coveredThroughRank) {
        matchingItem = ranked.item;
        outcomeRank = ranked.rank;
      }
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
      .where(inArray(predictionCategoryPicks.predictionId, [...predictionIds])),
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

  return buildManualResultAssignments({
    activeBracketCount,
    aliases: aliasRows,
    items: itemRows,
    picks,
    snapshots,
  });
}
