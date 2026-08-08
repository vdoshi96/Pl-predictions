import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  predictionItems,
  predictions,
  standingsItems,
  standingsSnapshots,
} from "@/db/schema";
import {
  assignSharedRanks,
  scorePredictionIfActive,
  type RankedLeaderboardEntry,
} from "@/features/scoring";
import { getSeasonAccess } from "@/shared/policy";

import { getActiveSeasonView } from "../seasons/queries";

export type LeaderboardRosterEntry = {
  createdAt: Date;
  id: string | null;
  participantName: string;
  publicKey: string;
};

export type ScoredLeaderboardEntry = RankedLeaderboardEntry<{
  correctHalfCount: number;
  createdAt: Date;
  exactCount: number;
  id: string;
  participantName: string;
  totalScore: number;
  withinThreeCount: number;
}>;

export type LeaderboardView = {
  entries: LeaderboardRosterEntry[];
  predictionsRevealed: boolean;
  scoredEntries: ScoredLeaderboardEntry[] | null;
  snapshot: {
    capturedAt: Date;
    id: string;
    isFinal: boolean;
    matchweek: number | null;
    source: string;
  } | null;
};

const nameCollator = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});

export async function getLeaderboardView(): Promise<LeaderboardView> {
  const { season } = await getActiveSeasonView();
  const db = getDb();
  const access = getSeasonAccess({
    revealPredictions: season.revealPredictions,
    submissionDeadline: season.submissionDeadline,
    submissionsLocked: season.submissionsLocked,
  });

  if (!access.predictionsRevealed) {
    const publicEntries = await db
      .select({
        createdAt: predictions.createdAt,
        participantName: predictions.participantName,
        publicKey: predictions.normalizedParticipantName,
      })
      .from(predictions)
      .where(eq(predictions.seasonId, season.id))
      .orderBy(asc(predictions.normalizedParticipantName));
    const entries = publicEntries.map((entry) => ({ ...entry, id: null }));

    entries.sort((left, right) =>
      nameCollator.compare(left.participantName, right.participantName),
    );

    return {
      entries,
      predictionsRevealed: false,
      scoredEntries: null,
      snapshot: null,
    };
  }

  const entries = await db
    .select({
      createdAt: predictions.createdAt,
      id: predictions.id,
      participantName: predictions.participantName,
      publicKey: predictions.normalizedParticipantName,
    })
    .from(predictions)
    .where(eq(predictions.seasonId, season.id))
    .orderBy(asc(predictions.normalizedParticipantName));

  entries.sort((left, right) =>
    nameCollator.compare(left.participantName, right.participantName),
  );

  if (!season.activeSnapshotId) {
    return {
      entries,
      predictionsRevealed: true,
      scoredEntries: null,
      snapshot: null,
    };
  }

  const [snapshot] = await db
    .select()
    .from(standingsSnapshots)
    .where(eq(standingsSnapshots.id, season.activeSnapshotId))
    .limit(1);

  if (!snapshot) {
    return {
      entries,
      predictionsRevealed: true,
      scoredEntries: null,
      snapshot: null,
    };
  }

  const observedSnapshot = {
    ...snapshot,
    capturedAt: season.standingsAcceptedThrough ?? snapshot.capturedAt,
  };

  const actualTable = await db
    .select({
      actualPosition: standingsItems.actualPosition,
      playedGames: standingsItems.playedGames,
      teamId: standingsItems.teamId,
    })
    .from(standingsItems)
    .where(eq(standingsItems.snapshotId, snapshot.id));

  if (entries.length === 0) {
    return {
      entries,
      predictionsRevealed: true,
      scoredEntries: [],
      snapshot: observedSnapshot,
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
        entries.map((entry) => entry.id),
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

  const scored = entries.map((entry) => {
    const state = scorePredictionIfActive(
      itemsByPrediction.get(entry.id) ?? [],
      actualTable,
    );

    if (state.status === "not-started") return null;

    return {
      correctHalfCount: state.summary.correctHalfCount,
      createdAt: entry.createdAt,
      exactCount: state.summary.exactCount,
      id: entry.id,
      participantName: entry.participantName,
      totalScore: state.summary.total,
      withinThreeCount: state.summary.withinThreeCount,
    };
  });

  return {
    entries,
    predictionsRevealed: true,
    scoredEntries: scored.some((entry) => entry === null)
      ? null
      : assignSharedRanks(
          scored.filter((entry): entry is NonNullable<typeof entry> =>
            Boolean(entry),
          ),
        ),
    snapshot: observedSnapshot,
  };
}
