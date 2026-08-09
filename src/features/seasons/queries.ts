import "server-only";

import { asc, eq } from "drizzle-orm";

import { ACTIVE_SEASON } from "@/data/season";
import { getDb } from "@/db/client";
import {
  players,
  seasons,
  teams,
  type Player,
  type Season,
  type Team,
} from "@/db/schema";

import { authoritativeDatabaseTimeSql } from "./clock";

export type ActiveSeasonView = {
  databaseNow: Date;
  players: Player[];
  season: Season;
  teams: Team[];
};

export async function getActiveSeasonView(): Promise<ActiveSeasonView> {
  const db = getDb();
  const [activeSeason] = await db
    .select({
      databaseNow: authoritativeDatabaseTimeSql().mapWith(seasons.updatedAt),
      season: seasons,
    })
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug))
    .limit(1);

  if (!activeSeason) {
    throw new Error("The active season has not been seeded.");
  }

  const { databaseNow, season } = activeSeason;

  const [seasonTeams, seasonPlayers] = await Promise.all([
    db
      .select()
      .from(teams)
      .where(eq(teams.seasonId, season.id))
      .orderBy(asc(teams.sortName), asc(teams.displayName)),
    db
      .select()
      .from(players)
      .where(eq(players.seasonId, season.id))
      .orderBy(asc(players.sortName), asc(players.displayName)),
  ]);

  return {
    databaseNow,
    players: seasonPlayers.filter((player) => player.isActive),
    season,
    teams: seasonTeams,
  };
}
