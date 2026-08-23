// @vitest-environment node

import { randomUUID } from "node:crypto";

import { and, count, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { ACTIVE_SEASON } from "@/data";
import { getDb } from "@/db/client";
import {
  seasons,
  teams,
  winStreakFixtures,
  winStreakPicks,
  winStreakProfiles,
  winStreakRounds,
} from "@/db/schema";
import {
  insertWinStreakPickAtomically,
  insertWinStreakProfileAtomically,
} from "@/features/win-streak/atomic";
import { seedWinStreakFixtures } from "../../scripts/seed-win-streak-fixtures";
import { assertIsolatedDatabaseEnvironment } from "../test-environment-safety";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
if (enabled) {
  assertIsolatedDatabaseEnvironment(
    process.env,
    "Win Streak Neon integration tests",
  );
}

const createdProfileIds = new Set<string>();

async function expectDatabaseConstraint(
  operation: Promise<unknown>,
  constraint: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    cause: { code: "23514", constraint },
  });
}

afterEach(async () => {
  if (!enabled || createdProfileIds.size === 0) return;
  const db = getDb();
  for (const profileId of createdProfileIds) {
    await db
      .delete(winStreakProfiles)
      .where(eq(winStreakProfiles.id, profileId));
  }
  createdProfileIds.clear();
});

async function activeWinStreakFixture() {
  const db = getDb();
  const [season] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug))
    .limit(1);
  if (!season) throw new Error("The seeded active season is required.");

  const [round] = await db
    .select()
    .from(winStreakRounds)
    .where(
      and(
        eq(winStreakRounds.seasonId, season.id),
        eq(winStreakRounds.matchweek, 2),
      ),
    )
    .limit(1);
  if (!round) throw new Error("Seeded Matchweek 2 is required.");

  const fixtures = await db
    .select()
    .from(winStreakFixtures)
    .where(eq(winStreakFixtures.roundId, round.id));
  if (fixtures.length !== 10) {
    throw new Error("Seeded Matchweek 2 must contain ten fixtures.");
  }
  return { db, fixtures, round, season };
}

describe.runIf(enabled)("Win Streak database", () => {
  it("creates a current-round profile and authenticates one atomic pick", async () => {
    await seedWinStreakFixtures();
    const { db, season } = await activeWinStreakFixture();
    const profileId = randomUUID();
    const receiptTokenHash = profileId.replaceAll("-", "").repeat(2);
    createdProfileIds.add(profileId);

    await expect(
      insertWinStreakProfileAtomically(db, {
        id: profileId,
        normalizedParticipantName: `atomic ${profileId.slice(0, 8)}`,
        participantName: `Atomic ${profileId.slice(0, 8)}`,
        receiptTokenHash,
        seasonId: season.id,
      }),
    ).resolves.toBe(true);
    await expect(
      insertWinStreakPickAtomically(db, {
        id: randomUUID(),
        profileId,
        receiptTokenHash: "f".repeat(64),
        teamSlug: "arsenal",
      }),
    ).resolves.toBe(false);
    await expect(
      insertWinStreakPickAtomically(db, {
        id: randomUUID(),
        profileId,
        receiptTokenHash,
        teamSlug: "arsenal",
      }),
    ).resolves.toBe(true);
    await expect(
      insertWinStreakPickAtomically(db, {
        id: randomUUID(),
        profileId,
        receiptTokenHash,
        teamSlug: "chelsea",
      }),
    ).rejects.toThrow();
  }, 30_000);

  it("seeds the canonical schedule idempotently without duplicating rows", async () => {
    const first = await seedWinStreakFixtures();
    const second = await seedWinStreakFixtures();

    expect(first).toMatchObject({ fixtureCount: 370, roundCount: 37 });
    expect(second).toMatchObject({
      fixtureCount: 370,
      insertedRoundCount: 0,
      roundCount: 37,
      updatedRoundCount: 0,
      unchangedRoundCount: 37,
    });

    const db = getDb();
    const [roundCount] = await db
      .select({ value: count() })
      .from(winStreakRounds);
    const [fixtureCount] = await db
      .select({ value: count() })
      .from(winStreakFixtures);
    expect(roundCount?.value).toBeGreaterThanOrEqual(37);
    expect(fixtureCount?.value).toBeGreaterThanOrEqual(370);
  }, 30_000);

  it("enforces immutable one-per-round picks and deletes them only with the profile", async () => {
    await seedWinStreakFixtures();
    const { db, fixtures, round, season } = await activeWinStreakFixture();
    const profileId = randomUUID();
    createdProfileIds.add(profileId);
    const nameSuffix = profileId.slice(0, 8);
    await db.insert(winStreakProfiles).values({
      id: profileId,
      joinedRoundId: round.id,
      normalizedParticipantName: `db streak ${nameSuffix}`,
      participantName: `DB Streak ${nameSuffix}`,
      receiptTokenHash: profileId.replaceAll("-", "").repeat(2),
      seasonId: season.id,
    });

    const fixture = fixtures[0];
    const otherFixture = fixtures[1];
    if (!fixture || !otherFixture) {
      throw new Error("Two seeded fixtures are required.");
    }
    const pickId = randomUUID();
    await db.insert(winStreakPicks).values({
      fixtureId: fixture.id,
      id: pickId,
      profileId,
      roundId: round.id,
      teamId: fixture.homeTeamId,
    });

    await expectDatabaseConstraint(
      db
        .update(winStreakPicks)
        .set({ teamId: fixture.awayTeamId })
        .where(eq(winStreakPicks.id, pickId)),
      "win_streak_picks_immutable",
    );

    await expect(
      db.insert(winStreakPicks).values({
        fixtureId: otherFixture.id,
        profileId,
        roundId: round.id,
        teamId: otherFixture.homeTeamId,
      }),
    ).rejects.toThrow();

    await expectDatabaseConstraint(
      db.delete(winStreakPicks).where(eq(winStreakPicks.id, pickId)),
      "win_streak_picks_profile_delete_check",
    );

    await db
      .delete(winStreakProfiles)
      .where(eq(winStreakProfiles.id, profileId));
    createdProfileIds.delete(profileId);
    const [remainingPick] = await db
      .select({ value: count() })
      .from(winStreakPicks)
      .where(eq(winStreakPicks.id, pickId));
    expect(remainingPick?.value).toBe(0);
  }, 30_000);

  it("rejects a pick for a club outside the selected fixture", async () => {
    await seedWinStreakFixtures();
    const { db, fixtures, round, season } = await activeWinStreakFixture();
    const profileId = randomUUID();
    createdProfileIds.add(profileId);
    const nameSuffix = profileId.slice(0, 8);
    await db.insert(winStreakProfiles).values({
      id: profileId,
      joinedRoundId: round.id,
      normalizedParticipantName: `db scope ${nameSuffix}`,
      participantName: `DB Scope ${nameSuffix}`,
      receiptTokenHash: profileId.replaceAll("-", "").repeat(2),
      seasonId: season.id,
    });

    const fixture = fixtures[0];
    const otherFixture = fixtures[1];
    if (!fixture || !otherFixture) {
      throw new Error("Two seeded fixtures are required.");
    }
    await expectDatabaseConstraint(
      db.insert(winStreakPicks).values({
        fixtureId: fixture.id,
        profileId,
        roundId: round.id,
        teamId: otherFixture.homeTeamId,
      }),
      "win_streak_picks_fixture_team_check",
    );
  }, 30_000);

  it("rejects cross-season profile and fixture references", async () => {
    await seedWinStreakFixtures();
    const { db, round } = await activeWinStreakFixture();
    const seasonSuffix = randomUUID().slice(0, 8);
    const [otherSeason] = await db
      .insert(seasons)
      .values({
        competitionCode: "TEST",
        name: `Win Streak constraint ${seasonSuffix}`,
        openingKickoff: new Date("2026-08-21T19:00:00.000Z"),
        slug: `win-streak-${seasonSuffix}`,
        startYear: 2026,
      })
      .returning({ id: seasons.id });
    if (!otherSeason) throw new Error("A test season is required.");

    try {
      await expectDatabaseConstraint(
        db.insert(winStreakProfiles).values({
          joinedRoundId: round.id,
          normalizedParticipantName: `cross season ${seasonSuffix}`,
          participantName: "Cross Season",
          receiptTokenHash: randomUUID().replaceAll("-", "").repeat(2),
          seasonId: otherSeason.id,
        }),
        "win_streak_profiles_round_season_check",
      );
    } finally {
      await db.delete(seasons).where(eq(seasons.id, otherSeason.id));
    }
  }, 30_000);

  it("keeps all seeded fixtures scoped to teams in the active season", async () => {
    await seedWinStreakFixtures();
    const { db, season } = await activeWinStreakFixture();
    const activeTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.seasonId, season.id));
    const activeTeamIds = new Set(activeTeams.map((team) => team.id));
    const fixtures = await db
      .select({
        awayTeamId: winStreakFixtures.awayTeamId,
        homeTeamId: winStreakFixtures.homeTeamId,
      })
      .from(winStreakFixtures)
      .where(eq(winStreakFixtures.seasonId, season.id));

    expect(fixtures).toHaveLength(370);
    expect(
      fixtures.every(
        (fixture) =>
          activeTeamIds.has(fixture.homeTeamId) &&
          activeTeamIds.has(fixture.awayTeamId),
      ),
    ).toBe(true);
  }, 30_000);
});
