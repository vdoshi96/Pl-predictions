import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";

import { ACTIVE_SEASON } from "@/data/season";
import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import { getDb } from "@/db/client";
import {
  seasons,
  teams,
  winStreakFixtures,
  winStreakRounds,
} from "@/db/schema";
import { readFile } from "node:fs/promises";
import { assertIsolatedDatabaseEnvironment } from "./test-environment-safety";

/** Disposable future season: exercises real PostgreSQL cutoffs without time travel. */
export async function createWinStreakTestSeason(activate = false) {
  assertIsolatedDatabaseEnvironment(
    process.env,
    "Disposable Win Streak season",
  );
  const db = getDb();
  const seasonId = randomUUID();
  const roundId = randomUUID();
  const suffix = seasonId.slice(0, 8);
  const temporarySlug = `ws-qa-${suffix}`;
  const [original] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug));
  if (activate && !original)
    throw new Error("Seed the isolated active season first.");
  const time = await db.execute<{ now: string }>(
    sql`select clock_timestamp()::text as now`,
  );
  const future = new Date(
    new Date(time.rows[0]!.now).getTime() + 14 * 86400_000,
  );
  const teamRows = PREMIER_LEAGUE_2026_27_TEAMS.map((team) => ({
    ...team,
    id: randomUUID(),
    seasonId,
  }));
  const bySlug = new Map(
    teamRows.map((team) => [team.slug as string, team.id]),
  );
  const canonical = JSON.parse(
    await readFile(
      new URL("../src/data/win-streak-fixtures.json", import.meta.url),
      "utf8",
    ),
  ) as {
    rounds: {
      fixtures: { id: string; homeTeamSlug: string; awayTeamSlug: string }[];
    }[];
  };
  const roundRows = canonical.rounds.map((_, index) => ({
    id: index === 0 ? roundId : randomUUID(),
    seasonId,
    matchweek: index + 2,
    pickDeadline: new Date(future.getTime() + index * 7 * 86400_000),
    fixtureSource: "isolated-qa",
    fixtureSourceReference: "https://example.com/isolated-qa",
    fixtureVerifiedAt: new Date(),
    fixtureContentHash: "a".repeat(64),
  }));
  const allFixtureRows = canonical.rounds.flatMap((sourceRound, roundIndex) =>
    sourceRound.fixtures.map((fixture, index) => ({
      awayTeamId: bySlug.get(fixture.awayTeamSlug)!,
      homeTeamId: bySlug.get(fixture.homeTeamSlug)!,
      id: randomUUID(),
      kickoffAt: new Date(
        roundRows[roundIndex]!.pickDeadline.getTime() + index * 3600_000,
      ),
      roundId: roundRows[roundIndex]!.id,
      seasonId,
      sourceFixtureId: fixture.id,
    })),
  );
  const fixtureRows = allFixtureRows.filter(
    (fixture) => fixture.roundId === roundId,
  );
  let activated = false;
  const cleanup = async () => {
    if (activated && original) {
      await db.batch([
        db.delete(seasons).where(eq(seasons.id, seasonId)),
        db
          .update(seasons)
          .set({ slug: ACTIVE_SEASON.slug })
          .where(
            and(
              eq(seasons.id, original.id),
              eq(seasons.slug, `ws-original-${suffix}`),
            ),
          ),
      ]);
    } else await db.delete(seasons).where(eq(seasons.id, seasonId));
    const [remaining] = await db
      .select({ value: count() })
      .from(seasons)
      .where(eq(seasons.id, seasonId));
    if (remaining?.value !== 0)
      throw new Error("Disposable Win Streak season cleanup failed.");
    if (activated && original) {
      const [restored] = await db
        .select({ id: seasons.id })
        .from(seasons)
        .where(eq(seasons.slug, ACTIVE_SEASON.slug));
      if (restored?.id !== original.id)
        throw new Error("Original isolated season was not restored.");
    }
  };
  try {
    await db.insert(seasons).values({
      id: seasonId,
      slug: temporarySlug,
      name: "Win Streak disposable QA",
      competitionCode: "QA",
      startYear: 2026,
      openingKickoff: future,
    });
    await db.insert(teams).values(teamRows);
    await db.batch([
      db.insert(winStreakRounds).values(roundRows),
      db.insert(winStreakFixtures).values(allFixtureRows),
    ]);
    if (activate && original) {
      await db.batch([
        db
          .update(seasons)
          .set({ slug: `ws-original-${suffix}` })
          .where(eq(seasons.id, original.id)),
        db
          .update(seasons)
          .set({ slug: ACTIVE_SEASON.slug })
          .where(eq(seasons.id, seasonId)),
      ]);
      activated = true;
    }
    const [round] = await db
      .select()
      .from(winStreakRounds)
      .where(eq(winStreakRounds.id, roundId));
    return {
      db,
      fixtures: fixtureRows,
      round: round!,
      season: { id: seasonId },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
