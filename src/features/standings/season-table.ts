import "server-only";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  predictionItems,
  predictions,
  standingsItems,
  standingsSnapshots,
} from "@/db/schema";
import { isStandingsScoringActive } from "@/features/scoring";
import { hasSeasonStarted } from "@/features/seasons/deadline";
import {
  getActiveSeasonContext,
  getSeasonTeams,
} from "@/features/seasons/queries";
import { getSeasonAccess } from "@/shared/policy";

import {
  buildSeasonTablePresentation,
  type SeasonTableCallout,
  type SeasonTableRow,
} from "./season-table-view";

export type SeasonTableView = Readonly<{
  callouts: {
    overachiever: SeasonTableCallout | null;
    underachiever: SeasonTableCallout | null;
  };
  consensusActive: boolean;
  entryCount: number;
  predictionsRevealed: boolean;
  rows: SeasonTableRow[] | null;
  seasonName: string;
  snapshot: {
    capturedAt: Date;
    isFinal: boolean;
    matchweek: number | null;
  } | null;
}>;

const emptyCallouts = {
  overachiever: null,
  underachiever: null,
} as const;

export async function getSeasonTableView(): Promise<SeasonTableView> {
  const { databaseNow, season } = await getActiveSeasonContext();
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );

  if (!access.predictionsRevealed) {
    return {
      callouts: emptyCallouts,
      consensusActive: false,
      entryCount: 0,
      predictionsRevealed: false,
      rows: null,
      seasonName: season.name,
      snapshot: null,
    };
  }

  const db = getDb();
  const [seasonTeams, entryRows] = await Promise.all([
    getSeasonTeams(season.id),
    db
      .select({ id: predictions.id })
      .from(predictions)
      .where(eq(predictions.seasonId, season.id)),
  ]);

  if (!season.activeSnapshotId) {
    return {
      callouts: emptyCallouts,
      consensusActive: false,
      entryCount: entryRows.length,
      predictionsRevealed: true,
      rows: null,
      seasonName: season.name,
      snapshot: null,
    };
  }

  const [snapshot] = await db
    .select({
      capturedAt: standingsSnapshots.capturedAt,
      id: standingsSnapshots.id,
      isFinal: standingsSnapshots.isFinal,
      matchweek: standingsSnapshots.matchweek,
    })
    .from(standingsSnapshots)
    .where(eq(standingsSnapshots.id, season.activeSnapshotId))
    .limit(1);
  if (!snapshot) {
    return {
      callouts: emptyCallouts,
      consensusActive: false,
      entryCount: entryRows.length,
      predictionsRevealed: true,
      rows: null,
      seasonName: season.name,
      snapshot: null,
    };
  }

  const actualTable = await db
    .select({
      actualPosition: standingsItems.actualPosition,
      leaguePoints: standingsItems.leaguePoints,
      playedGames: standingsItems.playedGames,
      teamId: standingsItems.teamId,
    })
    .from(standingsItems)
    .where(eq(standingsItems.snapshotId, snapshot.id));
  const observedCapturedAt =
    season.standingsAcceptedThrough ?? snapshot.capturedAt;
  const scoringWindowOpen =
    access.seasonStarted &&
    hasSeasonStarted(observedCapturedAt, season.openingKickoff);
  const consensusActive =
    scoringWindowOpen && isStandingsScoringActive(actualTable);
  const itemRows =
    consensusActive && entryRows.length > 0
      ? await db
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
          )
      : [];
  const itemsByPrediction = new Map<
    string,
    Array<{ predictedPosition: number; teamId: string }>
  >();
  for (const item of itemRows) {
    const group = itemsByPrediction.get(item.predictionId) ?? [];
    group.push(item);
    itemsByPrediction.set(item.predictionId, group);
  }
  const presentation = buildSeasonTablePresentation({
    actualTable,
    consensusActive,
    predictionTables: entryRows.map(
      (entry) => itemsByPrediction.get(entry.id) ?? [],
    ),
    teams: seasonTeams,
  });

  return {
    callouts: presentation.callouts,
    consensusActive,
    entryCount: entryRows.length,
    predictionsRevealed: true,
    rows: presentation.rows,
    seasonName: season.name,
    snapshot: {
      capturedAt: observedCapturedAt,
      isFinal: snapshot.isFinal,
      matchweek: snapshot.matchweek,
    },
  };
}
