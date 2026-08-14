import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { ACTIVE_SEASON } from "@/data/season";
import { getDb } from "@/db/client";
import { players, seasons, teams } from "@/db/schema";

import { authoritativeDatabaseTimeSql } from "./clock";

export type ActiveSeasonContext = {
  databaseNow: Date;
  season: {
    activeSnapshotId: string | null;
    finalSnapshotId: string | null;
    id: string;
    name: string;
    openingKickoff: Date;
    revealPredictions: boolean;
    slug: string;
    standingsAcceptedThrough: Date | null;
    submissionsLocked: boolean;
  };
};

export type PlayerCatalogueItem = {
  assetPath: string | null;
  displayName: string;
  firstName: string | null;
  id: string;
  lastName: string | null;
};

export type SeasonTeam = {
  assetPath: string;
  displayName: string;
  id: string;
  shortName: string;
  slug: string;
  sortName: string;
};

export async function getActiveSeasonContext(): Promise<ActiveSeasonContext> {
  const db = getDb();
  const [activeSeason] = await db
    .select({
      databaseNow: authoritativeDatabaseTimeSql().mapWith(seasons.updatedAt),
      season: {
        activeSnapshotId: seasons.activeSnapshotId,
        finalSnapshotId: seasons.finalSnapshotId,
        id: seasons.id,
        name: seasons.name,
        openingKickoff: seasons.openingKickoff,
        revealPredictions: seasons.revealPredictions,
        slug: seasons.slug,
        standingsAcceptedThrough: seasons.standingsAcceptedThrough,
        submissionsLocked: seasons.submissionsLocked,
      },
    })
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug))
    .limit(1);

  if (!activeSeason) {
    throw new Error("The active season has not been seeded.");
  }

  return activeSeason;
}

export async function getSeasonTeams(seasonId: string): Promise<SeasonTeam[]> {
  return getDb()
    .select({
      assetPath: teams.assetPath,
      displayName: teams.displayName,
      id: teams.id,
      shortName: teams.shortName,
      slug: teams.slug,
      sortName: teams.sortName,
    })
    .from(teams)
    .where(eq(teams.seasonId, seasonId))
    .orderBy(asc(teams.sortName), asc(teams.displayName));
}

export async function getActiveSeasonPlayers(
  seasonId: string,
): Promise<PlayerCatalogueItem[]> {
  return getDb()
    .select({
      assetPath: players.assetPath,
      displayName: players.displayName,
      firstName: players.firstName,
      id: players.id,
      lastName: players.lastName,
    })
    .from(players)
    .where(and(eq(players.seasonId, seasonId), eq(players.isActive, true)))
    .orderBy(asc(players.sortName), asc(players.displayName));
}

export async function getActiveSeasonPlayerIds(
  seasonId: string,
  candidatePlayerIds: readonly string[],
): Promise<string[]> {
  const uniquePlayerIds = [...new Set(candidatePlayerIds)];
  if (uniquePlayerIds.length === 0) return [];

  const rows = await getDb()
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.seasonId, seasonId),
        eq(players.isActive, true),
        inArray(players.id, uniquePlayerIds),
      ),
    );

  return rows.map((row) => row.id);
}
