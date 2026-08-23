// @vitest-environment node

import { randomUUID } from "node:crypto";

import { count, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db/client";
import {
  adminAuditLogs,
  seasons,
  teams,
  winStreakFixtures,
  winStreakRounds,
} from "@/db/schema";
import {
  resolveWinStreakRoundAtomically,
  winStreakResultContentHash,
  type WinStreakFixtureResult,
} from "@/features/win-streak/results";

import { assertIsolatedDatabaseEnvironment } from "../test-environment-safety";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
if (enabled) {
  assertIsolatedDatabaseEnvironment(
    process.env,
    "Win Streak result Neon integration tests",
  );
}

describe.runIf(enabled)("Win Streak result resolution", () => {
  it("commits one reviewed ten-fixture result set and rejects a second resolution", async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
    const seasonId = randomUUID();
    const roundId = randomUUID();
    const auditId = randomUUID();
    const staleAuditId = randomUUID();
    const requestId = `win-streak-results-${suffix}`;
    const sourceReference = `https://example.com/results/${suffix}`;
    const capturedAt = new Date("2020-01-02T01:00:00.000Z");
    const teamRows = Array.from({ length: 20 }, (_, index) => ({
      assetPath: `/team-marks/win-streak-${suffix}-${index + 1}.png`,
      displayName: `Result Team ${index + 1}`,
      id: randomUUID(),
      seasonId,
      shortName: `Team ${index + 1}`,
      slug: `ws-${suffix}-${String(index + 1).padStart(2, "0")}`,
      sortName: `Result Team ${String(index + 1).padStart(2, "0")}`,
    }));
    const fixtureRows = Array.from({ length: 10 }, (_, index) => ({
      awayTeamId: teamRows[index * 2 + 1]!.id,
      homeTeamId: teamRows[index * 2]!.id,
      id: randomUUID(),
      kickoffAt: new Date(
        `2020-01-01T${String(12 + index).padStart(2, "0")}:00:00.000Z`,
      ),
      roundId,
      seasonId,
      sourceFixtureId: `result-${suffix}-${index + 1}`,
    }));
    const outcomes: readonly WinStreakFixtureResult[] = [
      "home_win",
      "draw",
      "away_win",
      "void",
      "home_win",
      "away_win",
      "draw",
      "home_win",
      "away_win",
      "home_win",
    ];
    const results = fixtureRows.map((fixture, index) => ({
      fixtureId: fixture.id,
      result: outcomes[index]!,
    }));

    const cleanup = async () => {
      await db
        .delete(adminAuditLogs)
        .where(inArray(adminAuditLogs.id, [auditId, staleAuditId]));
      await db.delete(seasons).where(eq(seasons.id, seasonId));
    };

    try {
      await db.insert(seasons).values({
        competitionCode: "QA",
        id: seasonId,
        name: `Win Streak results ${suffix}`,
        openingKickoff: new Date("2020-01-01T12:00:00.000Z"),
        slug: `ws-results-${suffix}`,
        startYear: 2020,
      });
      await db.insert(teams).values(teamRows);
      await db.batch([
        db.insert(winStreakRounds).values({
          fixtureContentHash: "a".repeat(64),
          fixtureSource: "integration-test",
          fixtureSourceReference: "https://example.com/fixtures",
          fixtureVerifiedAt: new Date("2019-12-01T12:00:00.000Z"),
          id: roundId,
          matchweek: 2,
          pickDeadline: fixtureRows[0]!.kickoffAt,
          seasonId,
        }),
        db.insert(winStreakFixtures).values(fixtureRows),
      ]);

      await expect(
        resolveWinStreakRoundAtomically(db, {
          auditId,
          capturedAt,
          requestId,
          results,
          roundId,
          seasonId,
          sourceReference,
        }),
      ).resolves.toEqual({ applied: true, matchweek: 2 });

      const [storedRound, storedFixtures, storedAudits] = await Promise.all([
        db
          .select()
          .from(winStreakRounds)
          .where(eq(winStreakRounds.id, roundId))
          .limit(1),
        db
          .select({
            id: winStreakFixtures.id,
            result: winStreakFixtures.result,
          })
          .from(winStreakFixtures)
          .where(eq(winStreakFixtures.roundId, roundId)),
        db.select().from(adminAuditLogs).where(eq(adminAuditLogs.id, auditId)),
      ]);
      expect(storedRound[0]).toMatchObject({
        resultCapturedAt: capturedAt,
        resultContentHash: winStreakResultContentHash(results),
        resultSource: "owner-reviewed-source",
        resultSourceReference: sourceReference,
      });
      expect(storedRound[0]?.resolvedAt).toBeInstanceOf(Date);
      expect(
        new Map(storedFixtures.map((fixture) => [fixture.id, fixture.result])),
      ).toEqual(
        new Map(results.map((result) => [result.fixtureId, result.result])),
      );
      expect(storedAudits).toHaveLength(1);
      expect(storedAudits[0]).toMatchObject({
        action: "win_streak.round_resolved",
        actor: "admin",
        requestId,
        seasonId,
        targetId: roundId,
        targetType: "win_streak_round",
      });
      expect(storedAudits[0]?.metadata).toMatchObject({
        capturedAt: capturedAt.toISOString(),
        fixtureCount: 10,
        matchweek: 2,
        sourceReference,
        voidCount: 1,
      });

      await expect(
        resolveWinStreakRoundAtomically(db, {
          auditId: staleAuditId,
          capturedAt,
          requestId: `${requestId}-stale`,
          results: results.map((result) => ({
            ...result,
            result: "draw" as const,
          })),
          roundId,
          seasonId,
          sourceReference: "https://example.com/changed-results",
        }),
      ).resolves.toEqual({ applied: false, matchweek: null });

      const [roundAfterStale, fixturesAfterStale, auditCount] =
        await Promise.all([
          db
            .select()
            .from(winStreakRounds)
            .where(eq(winStreakRounds.id, roundId))
            .limit(1),
          db
            .select({
              id: winStreakFixtures.id,
              result: winStreakFixtures.result,
            })
            .from(winStreakFixtures)
            .where(eq(winStreakFixtures.roundId, roundId)),
          db
            .select({ value: count() })
            .from(adminAuditLogs)
            .where(eq(adminAuditLogs.seasonId, seasonId)),
        ]);
      expect(roundAfterStale).toEqual(storedRound);
      expect(fixturesAfterStale).toEqual(storedFixtures);
      expect(auditCount[0]?.value).toBe(1);
    } finally {
      await cleanup();
    }

    const [seasonResidue, auditResidue] = await Promise.all([
      db
        .select({ value: count() })
        .from(seasons)
        .where(eq(seasons.id, seasonId)),
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(inArray(adminAuditLogs.id, [auditId, staleAuditId])),
    ]);
    expect(seasonResidue[0]?.value).toBe(0);
    expect(auditResidue[0]?.value).toBe(0);
  }, 30_000);
});
