// @vitest-environment node

import { describe, expect, it } from "vitest";

import canonicalFixtureSnapshot from "@/data/win-streak-fixtures.json";
import {
  prepareWinStreakFixtureSeed,
  winStreakRoundContentHash,
} from "../../scripts/seed-win-streak-fixtures";

describe("Win Streak fixture database seed", () => {
  it("prepares all 37 complete rounds and derives each deadline", () => {
    const prepared = prepareWinStreakFixtureSeed(canonicalFixtureSnapshot);

    expect(prepared.rounds).toHaveLength(37);
    expect(
      prepared.rounds.reduce(
        (fixtureCount, round) => fixtureCount + round.fixtures.length,
        0,
      ),
    ).toBe(370);
    expect(prepared.rounds.map((round) => round.matchweek)).toEqual(
      Array.from({ length: 37 }, (_, index) => index + 2),
    );
    expect(prepared.rounds[0]).toMatchObject({
      matchweek: 2,
      pickDeadline: new Date("2026-08-28T19:00:00.000Z"),
    });
    expect(prepared.sourceReference).toBe(
      canonicalFixtureSnapshot.source.fixtureListUrl,
    );
    expect(prepared.sourceVerifiedAt).toEqual(
      new Date("2026-09-04T00:00:00.000Z"),
    );
  });

  it("uses a deterministic round hash that changes with the schedule", () => {
    const prepared = prepareWinStreakFixtureSeed(canonicalFixtureSnapshot);
    const round = prepared.rounds[0];
    expect(round).toBeDefined();
    if (!round) return;

    expect(round.fixtureContentHash).toMatch(/^[\da-f]{64}$/u);
    expect(winStreakRoundContentHash(round.fixtures)).toBe(
      round.fixtureContentHash,
    );

    const changedFixtures = round.fixtures.map((fixture, index) =>
      index === 0
        ? {
            ...fixture,
            kickoffAt: new Date(fixture.kickoffAt.getTime() + 60_000),
          }
        : fixture,
    );
    expect(winStreakRoundContentHash(changedFixtures)).not.toBe(
      round.fixtureContentHash,
    );
  });

  it("rejects incompatible, incomplete, and internally inconsistent data", () => {
    expect(() =>
      prepareWinStreakFixtureSeed({
        ...canonicalFixtureSnapshot,
        schemaVersion: 2,
      }),
    ).toThrow("fixture schema version must be 1");

    const incomplete = structuredClone(canonicalFixtureSnapshot);
    incomplete.rounds.pop();
    expect(() => prepareWinStreakFixtureSeed(incomplete)).toThrow(
      "expected Matchweeks 2 through 38",
    );

    const repeatedTeam = structuredClone(canonicalFixtureSnapshot);
    const firstRound = repeatedTeam.rounds[0];
    const firstFixture = firstRound?.fixtures[0];
    const secondFixture = firstRound?.fixtures[1];
    if (!firstRound || !firstFixture || !secondFixture) {
      throw new Error("The canonical test fixture is incomplete.");
    }
    secondFixture.homeTeamSlug = firstFixture.homeTeamSlug;
    secondFixture.id = `2026-27-mw02-${secondFixture.homeTeamSlug}-${secondFixture.awayTeamSlug}`;
    expect(() => prepareWinStreakFixtureSeed(repeatedTeam)).toThrow(
      "Matchweek 2 must contain every club exactly once",
    );

    const invalidKickoff = structuredClone(canonicalFixtureSnapshot);
    const invalidFixture = invalidKickoff.rounds[0]?.fixtures[0];
    if (!invalidFixture) {
      throw new Error("The canonical test fixture is incomplete.");
    }
    invalidFixture.kickoffAt = "2026-08-28T19:00:00Z";
    expect(() => prepareWinStreakFixtureSeed(invalidKickoff)).toThrow(
      "must use a canonical UTC ISO instant",
    );
  });
});
