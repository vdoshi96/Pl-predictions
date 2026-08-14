import { pathToFileURL } from "node:url";

import { and, asc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import {
  ACTIVE_SEASON,
  PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
  PREMIER_LEAGUE_2026_27_PLAYERS,
  PREMIER_LEAGUE_2026_27_TEAMS,
} from "@/data";
import { getDb, type Database } from "@/db/client";
import { players, seasons, spotlightResultStates, teams } from "@/db/schema";
import { SPOTLIGHT_RESULT_DATASETS } from "@/features/results/types";

export function buildPlayerSeedValues(
  seasonId: string,
  teamIdBySlug: ReadonlyMap<string, string>,
) {
  return PREMIER_LEAGUE_2026_27_PLAYERS.map((player) => {
    const teamId = teamIdBySlug.get(player.teamSlug);
    if (!teamId) {
      throw new Error(
        `Player ${player.displayName} references unavailable team ${player.teamSlug}.`,
      );
    }

    return {
      assetPath: player.assetPath,
      displayName: player.displayName,
      externalId: player.externalId,
      firstName: player.firstName,
      isActive: true,
      lastName: player.lastName,
      seasonId,
      slug: player.slug,
      sortName: player.sortName,
      teamId,
    };
  });
}

export async function seedDatabase(db: Database = getDb()): Promise<{
  playerCount: number;
  seasonId: string;
  teamCount: number;
}> {
  await db
    .insert(seasons)
    .values({
      competitionCode: ACTIVE_SEASON.competitionCode,
      name: ACTIVE_SEASON.name,
      openingKickoff: new Date(ACTIVE_SEASON.openingFixture.kickoffIso),
      slug: ACTIVE_SEASON.slug,
      startYear: ACTIVE_SEASON.startYear,
    })
    .onConflictDoNothing({ target: seasons.slug });

  const [season] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug))
    .limit(1);

  if (!season) {
    throw new Error("The active season could not be created or loaded.");
  }

  await db
    .insert(spotlightResultStates)
    .values(
      SPOTLIGHT_RESULT_DATASETS.map((dataset) => ({
        dataset,
        seasonId: season.id,
      })),
    )
    .onConflictDoNothing();

  const updatedAt = new Date();
  const teamUpserts = PREMIER_LEAGUE_2026_27_TEAMS.map((team) =>
    db
      .insert(teams)
      .values({
        assetPath: team.assetPath,
        crestUrl: null,
        displayName: team.displayName,
        externalId: team.externalId,
        seasonId: season.id,
        shortName: team.shortName,
        slug: team.slug,
        sortName: team.sortName,
      })
      .onConflictDoUpdate({
        target: [teams.seasonId, teams.slug],
        set: {
          assetPath: team.assetPath,
          displayName: team.displayName,
          externalId: team.externalId,
          shortName: team.shortName,
          sortName: team.sortName,
          updatedAt,
        },
      }),
  );

  await db.batch(
    teamUpserts as unknown as readonly [BatchItem<"pg">, ...BatchItem<"pg">[]],
  );

  const seededTeams = await db
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(eq(teams.seasonId, season.id))
    .orderBy(asc(teams.sortName));

  const expectedTeamSlugs = new Set<string>(
    PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug),
  );
  if (
    seededTeams.length !== expectedTeamSlugs.size ||
    seededTeams.some((team) => !expectedTeamSlugs.has(team.slug))
  ) {
    throw new Error(
      "The active season does not contain exactly the verified 20-team fixture.",
    );
  }

  const teamIdBySlug = new Map(
    seededTeams.map((team) => [team.slug, team.id] as const),
  );
  const playerValues = buildPlayerSeedValues(season.id, teamIdBySlug);
  const playerUpsert = db
    .insert(players)
    .values(playerValues)
    .onConflictDoUpdate({
      target: [players.seasonId, players.externalId],
      set: {
        assetPath: sql`excluded.asset_path`,
        displayName: sql`excluded.display_name`,
        firstName: sql`excluded.first_name`,
        isActive: true,
        lastName: sql`excluded.last_name`,
        slug: sql`excluded.slug`,
        sortName: sql`excluded.sort_name`,
        teamId: sql`excluded.team_id`,
        updatedAt,
      },
    });
  const deactivateExistingPlayers = db
    .update(players)
    .set({ isActive: false, updatedAt })
    .where(eq(players.seasonId, season.id));

  await db.batch([
    deactivateExistingPlayers,
    playerUpsert,
  ] as unknown as readonly [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  const seededPlayers = await db
    .select({
      assetPath: players.assetPath,
      externalId: players.externalId,
      slug: players.slug,
      teamId: players.teamId,
    })
    .from(players)
    .where(and(eq(players.seasonId, season.id), eq(players.isActive, true)))
    .orderBy(asc(players.sortName));
  const expectedPlayersByExternalId = new Map(
    playerValues.map((player) => [player.externalId, player] as const),
  );
  if (
    seededPlayers.length !== expectedPlayersByExternalId.size ||
    seededPlayers.some((player) => {
      const expected = player.externalId
        ? expectedPlayersByExternalId.get(player.externalId)
        : undefined;
      return (
        !expected ||
        player.assetPath !== expected.assetPath ||
        player.slug !== expected.slug ||
        player.teamId !== expected.teamId
      );
    })
  ) {
    throw new Error(
      `The active season does not contain exactly the verified ${PREMIER_LEAGUE_2026_27_PLAYER_COUNT}-player fixture.`,
    );
  }

  return {
    playerCount: seededPlayers.length,
    seasonId: season.id,
    teamCount: seededTeams.length,
  };
}

async function main(): Promise<void> {
  const result = await seedDatabase();
  process.stdout.write(
    `Seeded ${result.teamCount} teams and ${result.playerCount} players for ${ACTIVE_SEASON.name}.\n`,
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown seed error";
    process.stderr.write(`Seed failed: ${message}\n`);
    process.exitCode = 1;
  });
}
