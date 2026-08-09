import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  predictionItems,
  predictions,
  seasons,
  standingsItems,
  standingsSnapshots,
  teams,
} from "@/db/schema";
import { getAdminSession } from "@/features/admin";
import { hasPredictionReceipt } from "@/features/predictions/receipt";
import { getSpotlightPicksByPredictionId } from "@/features/leaderboard/pick-queries";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import type { SpotlightPickDisplay } from "@/features/leaderboard/spotlight-pick-grid";
import { authoritativeDatabaseTimeSql } from "@/features/seasons/clock";
import { hasSeasonStarted } from "@/features/seasons/deadline";
import {
  scorePredictionIfActive,
  type ScorePoints,
  type ScoreTier,
} from "@/features/scoring";
import { getSeasonAccess } from "@/shared/policy";

export type EntryComparisonItem = {
  actualPosition: number | null;
  assetPath: string;
  difference: number | null;
  displayName: string;
  points: ScorePoints | null;
  predictedPosition: number;
  shortName: string;
  teamId: string;
  tier: ScoreTier | null;
};

export type EntryComparisonView = {
  comparisonItems: EntryComparisonItem[];
  createdAt: Date;
  id: string;
  isOwnerReceipt: boolean;
  participantName: string;
  predictionsRevealed: boolean;
  snapshot: {
    capturedAt: Date;
    isFinal: boolean;
    matchweek: number | null;
  } | null;
  spotlightPicks: SpotlightPickDisplay[];
  spotlightScore: number | null;
  tableScore: number | null;
  totalScore: number | null;
};

export async function getEntryComparison(
  candidateId: string,
): Promise<EntryComparisonView | null> {
  const id = z.string().uuid().safeParse(candidateId);
  if (!id.success) return null;

  const db = getDb();
  const [entry] = await db
    .select({
      createdAt: predictions.createdAt,
      databaseNow: authoritativeDatabaseTimeSql().mapWith(seasons.updatedAt),
      id: predictions.id,
      participantName: predictions.participantName,
      receiptTokenHash: predictions.receiptTokenHash,
      season: seasons,
    })
    .from(predictions)
    .innerJoin(seasons, eq(seasons.id, predictions.seasonId))
    .where(eq(predictions.id, id.data))
    .limit(1);

  if (!entry) return null;

  const access = getSeasonAccess(
    {
      openingKickoff: entry.season.openingKickoff,
      revealPredictions: entry.season.revealPredictions,
      submissionDeadline: entry.season.submissionDeadline,
      submissionsLocked: entry.season.submissionsLocked,
    },
    entry.databaseNow,
  );
  const isOwnerReceipt = entry.receiptTokenHash
    ? await hasPredictionReceipt(entry.id, entry.receiptTokenHash)
    : false;
  const isAdmin = Boolean(await getAdminSession());

  if (!access.predictionsRevealed && !isOwnerReceipt && !isAdmin) return null;

  const spotlightPicks =
    (await getSpotlightPicksByPredictionId([entry.id])).get(entry.id) ?? [];

  const predictedRows = await db
    .select({
      assetPath: teams.assetPath,
      displayName: teams.displayName,
      predictedPosition: predictionItems.predictedPosition,
      shortName: teams.shortName,
      teamId: predictionItems.teamId,
    })
    .from(predictionItems)
    .innerJoin(teams, eq(teams.id, predictionItems.teamId))
    .where(eq(predictionItems.predictionId, entry.id))
    .orderBy(asc(predictionItems.predictedPosition));

  const [snapshot] = entry.season.activeSnapshotId
    ? await db
        .select()
        .from(standingsSnapshots)
        .where(eq(standingsSnapshots.id, entry.season.activeSnapshotId))
        .limit(1)
    : [];
  const actualRows = snapshot
    ? await db
        .select({
          actualPosition: standingsItems.actualPosition,
          playedGames: standingsItems.playedGames,
          teamId: standingsItems.teamId,
        })
        .from(standingsItems)
        .where(eq(standingsItems.snapshotId, snapshot.id))
    : [];
  const observedSnapshotAt = snapshot
    ? (entry.season.standingsAcceptedThrough ?? snapshot.capturedAt)
    : null;
  const snapshotObservedAfterKickoff = observedSnapshotAt
    ? hasSeasonStarted(observedSnapshotAt, entry.season.openingKickoff)
    : false;
  const scoring =
    snapshot && observedSnapshotAt
      ? scorePredictionIfActive(
          predictedRows,
          actualRows,
          access.seasonStarted && snapshotObservedAfterKickoff,
        )
      : { status: "not-started" as const };
  const scoredByTeam = new Map(
    scoring.status === "scored"
      ? scoring.summary.items.map((item) => [item.teamId, item] as const)
      : [],
  );
  const rankedLeaderboardEntry =
    scoring.status === "scored"
      ? (await getLeaderboardView()).scoredEntries?.find(
          (leaderboardEntry) => leaderboardEntry.id === entry.id,
        )
      : null;

  return {
    comparisonItems: predictedRows.map((item) => {
      const scored = scoredByTeam.get(item.teamId);
      return {
        ...item,
        actualPosition: scored?.actualPosition ?? null,
        difference: scored?.difference ?? null,
        points: scored?.points ?? null,
        tier: scored?.tier ?? null,
      };
    }),
    createdAt: entry.createdAt,
    id: entry.id,
    isOwnerReceipt,
    participantName: entry.participantName,
    predictionsRevealed: access.predictionsRevealed,
    snapshot: snapshot
      ? {
          capturedAt: observedSnapshotAt ?? snapshot.capturedAt,
          isFinal: snapshot.isFinal,
          matchweek: snapshot.matchweek,
        }
      : null,
    spotlightPicks: rankedLeaderboardEntry?.spotlightPicks ?? spotlightPicks,
    spotlightScore: rankedLeaderboardEntry?.spotlightScore ?? null,
    tableScore: scoring.status === "scored" ? scoring.summary.total : null,
    totalScore:
      rankedLeaderboardEntry?.totalScore ??
      (scoring.status === "scored" ? scoring.summary.total : null),
  };
}
