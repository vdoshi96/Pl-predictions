import { describe, expect, it } from "vitest";

import {
  deriveWinStreakParticipant,
  rankWinStreakLeaderboard,
  type WinStreakPickFact,
  type WinStreakResult,
} from "@/features/win-streak/scoring";
import {
  getWinStreakFixtureForTeam,
  type WinStreakMatchweek,
  type WinStreakTeamSlug,
} from "@/features/win-streak/fixtures";

function resultForTeamWin(
  matchweek: WinStreakMatchweek,
  teamSlug: WinStreakTeamSlug,
): Exclude<WinStreakResult, "draw" | "void" | null> {
  const fixture = getWinStreakFixtureForTeam(matchweek, teamSlug);
  return fixture.homeTeamSlug === teamSlug ? "home_win" : "away_win";
}

function resultForTeamLoss(
  matchweek: WinStreakMatchweek,
  teamSlug: WinStreakTeamSlug,
): Exclude<WinStreakResult, "draw" | "void" | null> {
  return resultForTeamWin(matchweek, teamSlug) === "home_win"
    ? "away_win"
    : "home_win";
}

function pick(
  matchweek: WinStreakMatchweek,
  teamSlug: WinStreakTeamSlug,
  result: WinStreakResult,
): WinStreakPickFact {
  const fixture = getWinStreakFixtureForTeam(matchweek, teamSlug);
  return {
    awayTeamSlug: fixture.awayTeamSlug,
    homeTeamSlug: fixture.homeTeamSlug,
    kickoffAt: fixture.kickoffAt,
    matchweek,
    result,
    teamSlug,
  };
}

describe("Win Streak scoring", () => {
  it("increments the streak and locks only winning clubs", () => {
    const projection = deriveWinStreakParticipant({
      displayName: "Alex",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(3, "liverpool", resultForTeamWin(3, "liverpool")),
      ],
      resolvedThroughMatchweek: 3,
    });

    expect(projection).toMatchObject({
      bestStreak: 2,
      currentStreak: 2,
      displayName: "Alex",
      usedWinningTeamSlugs: ["arsenal", "liverpool"],
    });
    expect(projection.history.map((entry) => entry.outcome)).toEqual([
      "win",
      "win",
    ]);
  });

  it("resets and unlocks after a draw or loss", () => {
    const afterDraw = deriveWinStreakParticipant({
      displayName: "Morgan",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(3, "liverpool", "draw"),
        pick(4, "arsenal", resultForTeamWin(4, "arsenal")),
      ],
      resolvedThroughMatchweek: 4,
    });
    expect(afterDraw.currentStreak).toBe(1);
    expect(afterDraw.bestStreak).toBe(1);
    expect(afterDraw.usedWinningTeamSlugs).toEqual(["arsenal"]);
    expect(afterDraw.history.map((entry) => entry.outcome)).toEqual([
      "win",
      "draw",
      "win",
    ]);

    const afterLoss = deriveWinStreakParticipant({
      displayName: "Jordan",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(3, "liverpool", resultForTeamLoss(3, "liverpool")),
      ],
      resolvedThroughMatchweek: 3,
    });
    expect(afterLoss).toMatchObject({
      bestStreak: 1,
      currentStreak: 0,
      usedWinningTeamSlugs: [],
    });
    expect(afterLoss.history.at(-1)?.outcome).toBe("loss");
  });

  it("preserves streaks through missed rounds", () => {
    const projection = deriveWinStreakParticipant({
      displayName: "Sam",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(4, "chelsea", resultForTeamWin(4, "chelsea")),
      ],
      resolvedThroughMatchweek: 4,
    });

    expect(projection.currentStreak).toBe(2);
    expect(projection.bestStreak).toBe(2);
    expect(projection.usedWinningTeamSlugs).toEqual(["arsenal", "chelsea"]);
    expect(projection.history.map((entry) => entry.outcome)).toEqual([
      "win",
      "missed",
      "win",
    ]);
  });

  it("preserves a streak on void and makes the voided club reusable", () => {
    const projection = deriveWinStreakParticipant({
      displayName: "Taylor",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", "void"),
        pick(3, "arsenal", resultForTeamWin(3, "arsenal")),
      ],
      resolvedThroughMatchweek: 3,
    });

    expect(projection).toMatchObject({
      bestStreak: 1,
      currentStreak: 1,
      usedWinningTeamSlugs: ["arsenal"],
    });
    expect(projection.history.map((entry) => entry.outcome)).toEqual([
      "void",
      "win",
    ]);
  });

  it("starts late joiners at their joined matchweek", () => {
    const projection = deriveWinStreakParticipant({
      displayName: "Riley",
      joinedMatchweek: 5,
      picks: [pick(6, "fulham", resultForTeamWin(6, "fulham"))],
      resolvedThroughMatchweek: 6,
    });

    expect(projection.history.map((entry) => entry.matchweek)).toEqual([5, 6]);
    expect(projection.history.map((entry) => entry.outcome)).toEqual([
      "missed",
      "win",
    ]);
    expect(projection.currentStreak).toBe(1);
  });

  it("exposes the unresolved next pick without changing the streak", () => {
    const projection = deriveWinStreakParticipant({
      displayName: "Casey",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(3, "chelsea", null),
      ],
      resolvedThroughMatchweek: 2,
    });

    expect(projection.currentStreak).toBe(1);
    expect(projection.history.at(-1)).toMatchObject({
      matchweek: 3,
      outcome: "pending",
      teamSlug: "chelsea",
    });
    expect(projection.nextPick).toMatchObject({
      matchweek: 3,
      teamSlug: "chelsea",
    });
    expect(projection).not.toHaveProperty("id");
    expect(projection.nextPick).not.toHaveProperty("id");
    expect(projection.history.at(-1)).not.toHaveProperty("fixtureId");
  });

  it("rejects a winning club reused before the streak resets", () => {
    expect(() =>
      deriveWinStreakParticipant({
        displayName: "Avery",
        joinedMatchweek: 2,
        picks: [
          pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
          pick(3, "arsenal", resultForTeamWin(3, "arsenal")),
        ],
        resolvedThroughMatchweek: 3,
      }),
    ).toThrow(/reuses Arsenal during the active streak/u);
  });

  it("uses competition ranks by personal best and alphabetizes ties", () => {
    const ada = deriveWinStreakParticipant({
      displayName: "Ada",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(3, "liverpool", resultForTeamWin(3, "liverpool")),
        pick(4, "chelsea", "draw"),
      ],
      resolvedThroughMatchweek: 4,
    });
    const zoe = deriveWinStreakParticipant({
      displayName: "Zoe",
      joinedMatchweek: 2,
      picks: [
        pick(2, "arsenal", resultForTeamWin(2, "arsenal")),
        pick(3, "liverpool", resultForTeamWin(3, "liverpool")),
      ],
      resolvedThroughMatchweek: 3,
    });
    const liam = deriveWinStreakParticipant({
      displayName: "Liam",
      joinedMatchweek: 2,
      picks: [pick(2, "arsenal", resultForTeamWin(2, "arsenal"))],
      resolvedThroughMatchweek: 2,
    });

    expect(
      rankWinStreakLeaderboard([liam, zoe, ada]).map((entry) => ({
        best: entry.bestStreak,
        current: entry.currentStreak,
        name: entry.displayName,
        rank: entry.rank,
      })),
    ).toEqual([
      { best: 2, current: 0, name: "Ada", rank: 1 },
      { best: 2, current: 2, name: "Zoe", rank: 1 },
      { best: 1, current: 1, name: "Liam", rank: 3 },
    ]);
  });
});
