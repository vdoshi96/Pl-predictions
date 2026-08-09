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
import { hasSeasonStarted } from "@/features/seasons/deadline";
import { getSeasonAccess } from "@/shared/policy";

import { getActiveSeasonView } from "../seasons/queries";
import { getSpotlightPicksByPredictionId } from "./pick-queries";
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
};

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

export async function getLeaderboardView(): Promise<LeaderboardView> {
  const {
    databaseNow,
    season,
    teams: seasonTeams,
  } = await getActiveSeasonView();
  const db = getDb();
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionDeadline: season.submissionDeadline,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );
  const entryRows = await db
    .select({
      createdAt: predictions.createdAt,
      id: predictions.id,
      participantName: predictions.participantName,
      publicKey: predictions.normalizedParticipantName,
    })
    .from(predictions)
    .where(eq(predictions.seasonId, season.id))
    .orderBy(asc(predictions.normalizedParticipantName));

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
  const pendingSpotlightAccuracyEntries = buildSpotlightAccuracyEntries(
    entryRows,
    spotlightPicksByPredictionId,
  );

  if (!season.activeSnapshotId) {
    return {
      entries: revealedEntries,
      predictionsRevealed: true,
      scoredEntries: null,
      seasonStarted: access.seasonStarted,
      snapshot: null,
      spotlightAccuracyEntries: pendingSpotlightAccuracyEntries,
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
      seasonStarted: access.seasonStarted,
      snapshot: null,
      spotlightAccuracyEntries: pendingSpotlightAccuracyEntries,
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
  const expectationIndexes = scoringActive
    ? calculateTeamExpectationIndexes(
        entryRows.map((entry) => itemsByPrediction.get(entry.id) ?? []),
        actualTable,
      )
    : [];
  const underdogResultByTeamId = new Map(
    rankTeamExpectationIndexes(expectationIndexes, "underdog").map((item) => [
      item.teamId,
      { index: item.underdogIndex, rank: item.rank },
    ]),
  );
  const overratedResultByTeamId = new Map(
    rankTeamExpectationIndexes(expectationIndexes, "overrated").map((item) => [
      item.teamId,
      { index: item.overratedIndex, rank: item.rank },
    ]),
  );
  const rankedTeamPicksByPredictionId = new Map<
    string,
    Map<string, AvailableSpotlightResult>
  >();

  for (const pick of teamSpotlightRows) {
    if (!pick.teamId) continue;
    const result =
      pick.category === "underdog_team"
        ? underdogResultByTeamId.get(pick.teamId)
        : pick.category === "overrated_team"
          ? overratedResultByTeamId.get(pick.teamId)
          : undefined;
    if (!result) continue;
    const byCategory =
      rankedTeamPicksByPredictionId.get(pick.predictionId) ?? new Map();
    byCategory.set(pick.category, {
      accuracyPoints: scoreCategoryRank(result.rank, entryRows.length),
      metricLabel: formatExpectationIndex(result.index),
      resultRank: result.rank,
    });
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
      tableScore: state.summary.total,
      totalScore: state.summary.total,
      withinThreeCount: state.summary.withinThreeCount,
    };
  });

  return {
    entries: revealedEntries,
    predictionsRevealed: true,
    scoredEntries: scored.some((entry) => entry === null)
      ? null
      : assignSharedRanks(
          scored.filter((entry): entry is NonNullable<typeof entry> =>
            Boolean(entry),
          ),
        ),
    seasonStarted: access.seasonStarted,
    snapshot: observedSnapshot,
    spotlightAccuracyEntries,
  };
}
