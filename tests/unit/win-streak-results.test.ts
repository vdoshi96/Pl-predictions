import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/client";
import {
  allWinStreakFixtureKickoffsHavePassed,
  buildResolveWinStreakRoundQuery,
  parseWinStreakResultSubmission,
  resolveWinStreakRoundAtomically,
} from "@/features/win-streak/results";

const fixtureIds = Array.from(
  { length: 10 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const input = {
  auditId: "00000000-0000-4000-8000-000000000099",
  capturedAt: new Date("2026-08-31T21:00:00.000Z"),
  requestId: "iad1::win-streak-results",
  results: fixtureIds.map((fixtureId, index) => ({
    fixtureId,
    result: index === 0 ? ("void" as const) : ("home_win" as const),
  })),
  roundId: "00000000-0000-4000-8000-000000000011",
  seasonId: "00000000-0000-4000-8000-000000000012",
  sourceReference: "https://www.premierleague.com/match-centre",
};

describe("Win Streak result validation", () => {
  it("accepts exactly ten unique fixture outcomes from a reviewed HTTPS source", () => {
    expect(
      parseWinStreakResultSubmission(
        {
          capturedAt: input.capturedAt.toISOString(),
          results: input.results,
          roundId: input.roundId,
          sourceReference: input.sourceReference,
        },
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toMatchObject({
      capturedAt: input.capturedAt,
      results: input.results,
      roundId: input.roundId,
      sourceReference: input.sourceReference,
    });
  });

  it("rejects missing, duplicate, invalid, and future result facts", () => {
    expect(() =>
      parseWinStreakResultSubmission(
        { ...input, results: input.results.slice(0, 9) },
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toThrow("Enter one result for each of the ten fixtures.");
    expect(() =>
      parseWinStreakResultSubmission(
        {
          ...input,
          results: input.results.map((result, index) =>
            index === 1 ? { ...result, fixtureId: fixtureIds[0] } : result,
          ),
        },
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toThrow("Each fixture can have only one result.");
    expect(() =>
      parseWinStreakResultSubmission(
        { ...input, sourceReference: "http://example.com/results" },
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toThrow("Enter an HTTPS source URL.");
    expect(() =>
      parseWinStreakResultSubmission(
        { ...input, capturedAt: "August 31, 2026 21:00 UTC" },
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toThrow("Enter a valid captured-at time in UTC.");
    expect(() =>
      parseWinStreakResultSubmission(
        { ...input, capturedAt: "2026-09-01T00:00:00.000Z" },
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toThrow("Captured at cannot be in the future.");
  });
});

describe("Win Streak result timing", () => {
  it("waits until all ten scheduled fixture kickoffs have passed", () => {
    const kickoffAts = Array.from(
      { length: 10 },
      (_, index) =>
        new Date(
          `2026-08-31T${String(12 + index).padStart(2, "0")}:00:00.000Z`,
        ),
    );

    expect(
      allWinStreakFixtureKickoffsHavePassed(
        kickoffAts,
        new Date("2026-08-31T20:59:59.999Z"),
      ),
    ).toBe(false);
    expect(
      allWinStreakFixtureKickoffsHavePassed(
        kickoffAts,
        new Date("2026-08-31T21:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      allWinStreakFixtureKickoffsHavePassed(
        kickoffAts.slice(0, 9),
        new Date("2026-08-31T22:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("atomic Win Streak round resolution", () => {
  it("locks and resolves the exact eligible round, fixtures, provenance, and audit together", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildResolveWinStreakRoundQuery(input),
    );
    const statement = rendered.sql.replaceAll(/\s+/gu, " ").trim();

    expect(statement).toContain('"locked_round" as materialized');
    expect(statement).toContain("for update");
    expect(statement).toContain('clock_timestamp() as "checked_at"');
    expect(statement).toContain(
      'checked_round."pick_deadline" <= checked_round."checked_at"',
    );
    expect(statement).toContain('"resolved_at" is null');
    expect(statement).toContain('fixture."result" is null');
    expect(statement).toContain(
      'unstarted_fixture."kickoff_at" > checked_round."checked_at"',
    );
    expect(statement).toContain('(select count(*) from "input_results") = 10');
    expect(statement).toContain('update "win_streak_fixtures"');
    expect(statement).toContain('update "win_streak_rounds"');
    expect(statement).toContain('insert into "admin_audit_logs"');
    expect(statement).toContain("win_streak.round_resolved");
    expect(rendered.params[0]).toContain('"fixture_id"');
    expect(rendered.params).toContain(input.roundId);
    expect(rendered.params).toContain(input.seasonId);
    expect(rendered.params).toContain(input.sourceReference);
  });

  it("reports only the fully applied compare-and-swap as success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ applied: true, matchweek: 2 }] })
      .mockResolvedValueOnce({ rows: [{ applied: false, matchweek: null }] });
    const db = { execute } as unknown as Database;

    await expect(resolveWinStreakRoundAtomically(db, input)).resolves.toEqual({
      applied: true,
      matchweek: 2,
    });
    await expect(resolveWinStreakRoundAtomically(db, input)).resolves.toEqual({
      applied: false,
      matchweek: null,
    });
  });
});
