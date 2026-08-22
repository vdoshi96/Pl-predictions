import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  predictionCategoryPicks,
  predictionItems,
  predictions,
  standingsItems,
  standingsSnapshots,
} from "@/db/schema";
import {
  assignSharedRanks,
  calculateTeamExpectationIndexes,
  isStandingsScoringActive,
  rankTeamExpectationIndexes,
  scoreCategoryRank,
  scorePredictionIfActive,
  type RankedLeaderboardEntry,
} from "@/features/scoring";
import { getManualResultAssignments } from "@/features/results/queries";
import { hasSeasonStarted } from "@/features/seasons/deadline";
import { getSeasonAccess } from "@/shared/policy";

import { getActiveSeasonContext, getSeasonTeams } from "../seasons/queries";
import { getSpotlightPicksByPredictionId } from "./pick-queries";
import {
  computeRankMovement,
  selectPreviousMeaningfulSnapshot,
  type SnapshotIdentity,
} from "./movement";
import type { SpotlightPickDisplay } from "./spotlight-pick-grid";

export type LeaderboardChampion = {
  actualPosition: number | null;
  assetPath: string;
  displayName: string;
  shortName: string;
};

export type LeaderboardRosterEntry = {
  champion: LeaderboardChampion;
  createdAt: Date;
  id: string | null;
  participantName: string;
  publicKey: string;
  spotlightPicks: SpotlightPickDisplay[] | null;
  totalScore: 0;
};

export type ScoredLeaderboardEntry = RankedLeaderboardEntry<{
  champion: LeaderboardChampion & { actualPosition: number };
  correctHalfCount: number;
  createdAt: Date;
  exactCount: number;
  id: string;
  participantName: string;
  movement: number | null;
  tableScore: number;
  totalScore: number;
  withinThreeCount: number;
}>;

export type SpotlightAccuracyEntry = {
  accuracyRank: number;
  accuracyScore: number;
  availableCategoryCount: number;
  createdAt: Date;
  id: string;
  participantName: string;
  spotlightPicks: SpotlightPickDisplay[];
};

export type LeaderboardView = {
  entries: LeaderboardRosterEntry[];
  predictionsRevealed: boolean;
  scoredEntries: ScoredLeaderboardEntry[] | null;
  seasonName: string;
  seasonStarted: boolean;
  snapshot: {
    capturedAt: Date;
    id: string;
    isFinal: boolean;
    matchweek: number | null;
    source: string;
  } | null;
  spotlightAccuracyEntries: SpotlightAccuracyEntry[] | null;
};

const nameCollator = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});

function formatExpectationIndex(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return `Index ${normalized > 0 ? "+" : ""}${normalized.toFixed(1)}`;
}

type AvailableSpotlightResult = {
  accuracyPoints: number;
  metricLabel: string;
  resultRank: number;
  resultStatus?: "outside-range" | "ranked";
};

type RankedTeamResult = {
  index: number;
  rank: number;
};

type RankedTeamResults = {
  overratedByTeamId: ReadonlyMap<string, RankedTeamResult>;
  underdogByTeamId: ReadonlyMap<string, RankedTeamResult>;
};

type PredictionItemForConsensus = {
  predictedPosition: number;
  teamId: string;
};

function buildRankedTeamResults(
  entryIds: readonly string[],
  itemsByPrediction: ReadonlyMap<string, readonly PredictionItemForConsensus[]>,
  actualTable: readonly { actualPosition: number; teamId: string }[],
  scoringActive: boolean,
): RankedTeamResults {
  const expectationIndexes = scoringActive
    ? calculateTeamExpectationIndexes(
        entryIds.map((entryId) => itemsByPrediction.get(entryId) ?? []),
        actualTable,
      )
    : [];

  return {
    overratedByTeamId: new Map(
      rankTeamExpectationIndexes(expectationIndexes, "overrated").map(
        (item) => [
          item.teamId,
          { index: item.overratedIndex, rank: item.rank },
        ],
      ),
    ),
    underdogByTeamId: new Map(
      rankTeamExpectationIndexes(expectationIndexes, "underdog").map((item) => [
        item.teamId,
        { index: item.underdogIndex, rank: item.rank },
      ]),
    ),
  };
}

function availableTeamResult(
  category: string,
  teamId: string | null,
  rankedTeamResults: RankedTeamResults,
  activeBracketCount: number,
): AvailableSpotlightResult | null {
  if (!teamId) return null;
  const result =
    category === "underdog_team"
      ? rankedTeamResults.underdogByTeamId.get(teamId)
      : category === "overrated_team"
        ? rankedTeamResults.overratedByTeamId.get(teamId)
        : undefined;
  if (!result) return null;

  return {
    accuracyPoints: scoreCategoryRank(result.rank, activeBracketCount),
    metricLabel: formatExpectationIndex(result.index),
    resultRank: result.rank,
    resultStatus: "ranked",
  };
}

function buildSpotlightAccuracyEntries(
  entryRows: readonly {
    createdAt: Date;
    id: string;
    participantName: string;
  }[],
  spotlightPicksByPredictionId: ReadonlyMap<string, SpotlightPickDisplay[]>,
  rankedTeamPicksByPredictionId: ReadonlyMap<
    string,
    ReadonlyMap<string, AvailableSpotlightResult>
  > = new Map(),
): SpotlightAccuracyEntry[] {
  const unrankedEntries = entryRows.map((entry) => {
    const rankedTeamPicks = rankedTeamPicksByPredictionId.get(entry.id);
    const spotlightPicks = (
      spotlightPicksByPredictionId.get(entry.id) ?? []
    ).map((pick) => {
      const result = rankedTeamPicks?.get(pick.category);
      return result ? { ...pick, ...result } : pick;
    });
    const availableCategoryPoints = spotlightPicks.flatMap((pick) =>
      pick.accuracyPoints === null || pick.accuracyPoints === undefined
        ? []
        : [pick.accuracyPoints],
    );
    const accuracyScore = availableCategoryPoints.reduce(
      (total, points) => total + points,
      0,
    );

    return {
      accuracyScore,
      availableCategoryCount: availableCategoryPoints.length,
      createdAt: entry.createdAt,
      id: entry.id,
      participantName: entry.participantName,
      spotlightPicks,
      totalScore: accuracyScore,
    };
  });

  return assignSharedRanks(unrankedEntries).map((entry) => ({
    accuracyRank: entry.rank,
    accuracyScore: entry.accuracyScore,
    availableCategoryCount: entry.availableCategoryCount,
    createdAt: entry.createdAt,
    id: entry.id,
    participantName: entry.participantName,
    spotlightPicks: entry.spotlightPicks,
  }));
}

export async function getEntrySpotlightPicksWithAccuracy({
  actualTable,
  predictionId,
  seasonId,
  spotlightPicks,
  teamScoringActive,
}: {
  actualTable: readonly {
    actualPosition: number;
    playedGames: number | null;
    teamId: string;
  }[];
  predictionId: string;
  seasonId: string;
  spotlightPicks: readonly SpotlightPickDisplay[];
  teamScoringActive: boolean;
}): Promise<SpotlightPickDisplay[]> {
  const db = getDb();
  const entryRows = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(eq(predictions.seasonId, seasonId));
  if (entryRows.length === 0) return [...spotlightPicks];

  const entryIds = entryRows.map((entry) => entry.id);
  const [itemRows, teamPickRows] = teamScoringActive
    ? await Promise.all([
        db
          .select({
            predictedPosition: predictionItems.predictedPosition,
            predictionId: predictionItems.predictionId,
            teamId: predictionItems.teamId,
          })
          .from(predictionItems)
          .where(inArray(predictionItems.predictionId, entryIds)),
        db
          .select({
            category: predictionCategoryPicks.category,
            teamId: predictionCategoryPicks.teamId,
          })
          .from(predictionCategoryPicks)
          .where(
            and(
              eq(predictionCategoryPicks.predictionId, predictionId),
              inArray(predictionCategoryPicks.category, [
                "underdog_team",
                "overrated_team",
              ]),
            ),
          ),
      ])
    : [[], []];
  const itemsByPrediction = new Map<string, PredictionItemForConsensus[]>();
  for (const item of itemRows) {
    const group = itemsByPrediction.get(item.predictionId) ?? [];
    group.push(item);
    itemsByPrediction.set(item.predictionId, group);
  }

  const rankedTeamResults = buildRankedTeamResults(
    entryIds,
    itemsByPrediction,
    actualTable,
    teamScoringActive,
  );
  const resultByCategory = new Map(
    teamPickRows.flatMap((pick) => {
      const result = availableTeamResult(
        pick.category,
        pick.teamId,
        rankedTeamResults,
        entryRows.length,
      );
      return result ? [[pick.category, result] as const] : [];
    }),
  );
  const manualResults = await getManualResultAssignments(
    seasonId,
    [predictionId],
    entryRows.length,
  );
  for (const [category, result] of manualResults.get(predictionId) ?? []) {
    resultByCategory.set(category, result);
  }

  return spotlightPicks.map((pick) => {
    const result = resultByCategory.get(pick.category);
    return result ? { ...pick, ...result } : pick;
  });
}

export async function getPreviousMeaningfulSnapshot(
  seasonId: string,
  activeSnapshot: SnapshotIdentity,
): Promise<SnapshotIdentity | null> {
  const candidates = await getDb()
    .select({
      capturedAt: standingsSnapshots.capturedAt,
      id: standingsSnapshots.id,
      matchweek: standingsSnapshots.matchweek,
    })
    .from(standingsSnapshots)
    .where(eq(standingsSnapshots.seasonId, seasonId));

  return selectPreviousMeaningfulSnapshot(candidates, activeSnapshot);
}

export async function getLeaderboardView(): Promise<LeaderboardView> {
  const { databaseNow, season } = await getActiveSeasonContext();
  const db = getDb();
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );
  const [seasonTeams, entryRows] = await Promise.all([
    getSeasonTeams(season.id),
    db
      .select({
        createdAt: predictions.createdAt,
        id: predictions.id,
        participantName: predictions.participantName,
        publicKey: predictions.normalizedParticipantName,
      })
      .from(predictions)
      .where(eq(predictions.seasonId, season.id))
      .orderBy(asc(predictions.normalizedParticipantName)),
  ]);

  entryRows.sort((left, right) =>
    nameCollator.compare(left.participantName, right.participantName),
  );

  const championRows =
    entryRows.length === 0
      ? []
      : await db
          .select({
            predictionId: predictionItems.predictionId,
            teamId: predictionItems.teamId,
          })
          .from(predictionItems)
          .where(
            and(
              inArray(
                predictionItems.predictionId,
                entryRows.map((entry) => entry.id),
              ),
              eq(predictionItems.predictedPosition, 1),
            ),
          );
  const championTeamIdByPrediction = new Map(
    championRows.map((row) => [row.predictionId, row.teamId] as const),
  );
  const teamById = new Map(seasonTeams.map((team) => [team.id, team] as const));

  const entries = entryRows.map<LeaderboardRosterEntry>((entry) => {
    const championTeamId = championTeamIdByPrediction.get(entry.id);
    const champion = championTeamId ? teamById.get(championTeamId) : null;
    if (!champion) {
      throw new Error("Every leaderboard entry must have one champion pick.");
    }

    return {
      champion: {
        actualPosition: null,
        assetPath: champion.assetPath,
        displayName: champion.displayName,
        shortName: champion.shortName,
      },
      createdAt: entry.createdAt,
      id: access.predictionsRevealed ? entry.id : null,
      participantName: entry.participantName,
      publicKey: entry.publicKey,
      spotlightPicks: null,
      totalScore: 0,
    };
  });

  if (!access.predictionsRevealed) {
    return {
      entries,
      predictionsRevealed: false,
      scoredEntries: null,
      seasonName: season.name,
      seasonStarted: access.seasonStarted,
      snapshot: null,
      spotlightAccuracyEntries: null,
    };
  }

  const spotlightPicksByPredictionId = await getSpotlightPicksByPredictionId(
    entryRows.map((entry) => entry.id),
  );
  const revealedEntries = entries.map((entry, index) => ({
    ...entry,
    spotlightPicks:
      spotlightPicksByPredictionId.get(entryRows[index]?.id ?? "") ?? [],
  }));
  const manualResultAssignments = await getManualResultAssignments(
    season.id,
    entryRows.map((entry) => entry.id),
    entryRows.length,
  );
  const manualSpotlightAccuracyEntries = buildSpotlightAccuracyEntries(
    entryRows,
    spotlightPicksByPredictionId,
    manualResultAssignments,
  );

  if (!season.activeSnapshotId) {
    return {
      entries: revealedEntries,
      predictionsRevealed: true,
      scoredEntries: null,
      seasonName: season.name,
      seasonStarted: access.seasonStarted,
      snapshot: null,
      spotlightAccuracyEntries: manualSpotlightAccuracyEntries,
    };
  }

  const [snapshot] = await db
    .select()
    .from(standingsSnapshots)
    .where(eq(standingsSnapshots.id, season.activeSnapshotId))
    .limit(1);

  if (!snapshot) {
    return {
      entries: revealedEntries,
      predictionsRevealed: true,
      scoredEntries: null,
      seasonName: season.name,
      seasonStarted: access.seasonStarted,
      snapshot: null,
      spotlightAccuracyEntries: manualSpotlightAccuracyEntries,
    };
  }

  const observedSnapshot = {
    ...snapshot,
    capturedAt: season.standingsAcceptedThrough ?? snapshot.capturedAt,
  };
  const snapshotObservedAfterKickoff = hasSeasonStarted(
    observedSnapshot.capturedAt,
    season.openingKickoff,
  );
  const actualTable = await db
    .select({
      actualPosition: standingsItems.actualPosition,
      playedGames: standingsItems.playedGames,
      teamId: standingsItems.teamId,
    })
    .from(standingsItems)
    .where(eq(standingsItems.snapshotId, snapshot.id));

  if (entryRows.length === 0) {
    return {
      entries: revealedEntries,
      predictionsRevealed: true,
      scoredEntries:
        access.seasonStarted &&
        snapshotObservedAfterKickoff &&
        isStandingsScoringActive(actualTable)
          ? []
          : null,
      seasonName: season.name,
      seasonStarted: access.seasonStarted,
      snapshot: observedSnapshot,
      spotlightAccuracyEntries: [],
    };
  }

  const itemRows = await db
    .select({
      predictedPosition: predictionItems.predictedPosition,
      predictionId: predictionItems.predictionId,
      teamId: predictionItems.teamId,
    })
    .from(predictionItems)
    .where(
      inArray(
        predictionItems.predictionId,
        entryRows.map((entry) => entry.id),
      ),
    );
  const itemsByPrediction = new Map<
    string,
    Array<{ predictedPosition: number; teamId: string }>
  >();

  for (const item of itemRows) {
    const group = itemsByPrediction.get(item.predictionId) ?? [];
    group.push(item);
    itemsByPrediction.set(item.predictionId, group);
  }

  const teamSpotlightRows = await db
    .select({
      category: predictionCategoryPicks.category,
      predictionId: predictionCategoryPicks.predictionId,
      teamId: predictionCategoryPicks.teamId,
    })
    .from(predictionCategoryPicks)
    .where(
      and(
        inArray(
          predictionCategoryPicks.predictionId,
          entryRows.map((entry) => entry.id),
        ),
        inArray(predictionCategoryPicks.category, [
          "underdog_team",
          "overrated_team",
        ]),
      ),
    );

  const scoringWindowOpen =
    access.seasonStarted && snapshotObservedAfterKickoff;
  const scoringActive =
    scoringWindowOpen && isStandingsScoringActive(actualTable);
  const rankedTeamResults = buildRankedTeamResults(
    entryRows.map((entry) => entry.id),
    itemsByPrediction,
    actualTable,
    scoringActive,
  );
  const rankedTeamPicksByPredictionId = manualResultAssignments;

  for (const pick of teamSpotlightRows) {
    const result = availableTeamResult(
      pick.category,
      pick.teamId,
      rankedTeamResults,
      entryRows.length,
    );
    if (!result) continue;
    const byCategory =
      rankedTeamPicksByPredictionId.get(pick.predictionId) ?? new Map();
    byCategory.set(pick.category, result);
    rankedTeamPicksByPredictionId.set(pick.predictionId, byCategory);
  }

  const spotlightAccuracyEntries = buildSpotlightAccuracyEntries(
    entryRows,
    spotlightPicksByPredictionId,
    rankedTeamPicksByPredictionId,
  );

  const actualPositionByTeamId = new Map(
    actualTable.map((item) => [item.teamId, item.actualPosition] as const),
  );
  const scored = entryRows.map((entry) => {
    const state = scorePredictionIfActive(
      itemsByPrediction.get(entry.id) ?? [],
      actualTable,
      scoringWindowOpen,
    );

    if (state.status === "not-started") return null;

    const championTeamId = championTeamIdByPrediction.get(entry.id);
    const champion = championTeamId ? teamById.get(championTeamId) : null;
    const actualPosition = championTeamId
      ? actualPositionByTeamId.get(championTeamId)
      : null;
    if (!champion || actualPosition === null || actualPosition === undefined) {
      throw new Error("The champion pick must exist in the active standings.");
    }

    return {
      champion: {
        actualPosition,
        assetPath: champion.assetPath,
        displayName: champion.displayName,
        shortName: champion.shortName,
      },
      correctHalfCount: state.summary.correctHalfCount,
      createdAt: entry.createdAt,
      exactCount: state.summary.exactCount,
      id: entry.id,
      participantName: entry.participantName,
      movement: null,
      tableScore: state.summary.total,
      totalScore: state.summary.total,
      withinThreeCount: state.summary.withinThreeCount,
    };
  });

  const currentRanks = scored.some((entry) => entry === null)
    ? null
    : assignSharedRanks(
        scored.filter((entry): entry is NonNullable<typeof entry> =>
          Boolean(entry),
        ),
      );
  let previousRanks: Array<{ id: string; rank: number }> | null = null;
  if (currentRanks) {
    const previousSnapshot = await getPreviousMeaningfulSnapshot(
      season.id,
      snapshot,
    );
    if (previousSnapshot) {
      const previousTable = await db
        .select({
          actualPosition: standingsItems.actualPosition,
          playedGames: standingsItems.playedGames,
          teamId: standingsItems.teamId,
        })
        .from(standingsItems)
        .where(eq(standingsItems.snapshotId, previousSnapshot.id));
      const previousScoringWindowOpen = hasSeasonStarted(
        previousSnapshot.capturedAt,
        season.openingKickoff,
      );
      if (
        previousScoringWindowOpen &&
        isStandingsScoringActive(previousTable)
      ) {
        previousRanks = assignSharedRanks(
          entryRows.map((entry) => {
            const state = scorePredictionIfActive(
              itemsByPrediction.get(entry.id) ?? [],
              previousTable,
              previousScoringWindowOpen,
            );
            if (state.status !== "scored") {
              throw new Error("A meaningful previous table must be scoreable.");
            }
            return {
              id: entry.id,
              participantName: entry.participantName,
              totalScore: state.summary.total,
            };
          }),
        );
      }
    }
  }
  const movementById = computeRankMovement(currentRanks ?? [], previousRanks);

  return {
    entries: revealedEntries,
    predictionsRevealed: true,
    scoredEntries:
      currentRanks?.map((entry) => ({
        ...entry,
        movement: movementById.get(entry.id) ?? null,
      })) ?? null,
    seasonName: season.name,
    seasonStarted: access.seasonStarted,
    snapshot: observedSnapshot,
    spotlightAccuracyEntries,
  };
}
