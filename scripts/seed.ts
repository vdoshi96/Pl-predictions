import { pathToFileURL } from "node:url";

import { asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { ACTIVE_SEASON, PREMIER_LEAGUE_2026_27_TEAMS } from "@/data";
import { getDb, type Database } from "@/db/client";
import { seasons, teams } from "@/db/schema";

export function parseSeedDeadline(
  value = process.env.PREDICTION_DEADLINE_ISO,
): Date | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  const deadline = new Date(candidate);
  if (Number.isNaN(deadline.getTime())) {
    throw new Error("PREDICTION_DEADLINE_ISO must be a valid ISO timestamp.");
  }

  return deadline;
}

export async function seedDatabase(db: Database = getDb()): Promise<{
  seasonId: string;
  teamCount: number;
}> {
  await db
    .insert(seasons)
    .values({
      competitionCode: ACTIVE_SEASON.competitionCode,
      name: ACTIVE_SEASON.name,
      slug: ACTIVE_SEASON.slug,
      startYear: ACTIVE_SEASON.startYear,
      submissionDeadline: parseSeedDeadline(),
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
    .select({ slug: teams.slug })
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

  return { seasonId: season.id, teamCount: seededTeams.length };
}

async function main(): Promise<void> {
  const result = await seedDatabase();
  process.stdout.write(
    `Seeded ${result.teamCount} teams for ${ACTIVE_SEASON.name}.\n`,
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
