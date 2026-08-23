import { describe, expect, it } from "vitest";

import canonicalFixtureSnapshot from "@/data/win-streak-fixtures.json";
import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data/teams";
import {
  WIN_STREAK_MATCHWEEKS,
  WIN_STREAK_ROUNDS,
  WIN_STREAK_SOURCE,
  WIN_STREAK_WORKSHOP_ROUNDS,
  getWinStreakFixtureById,
  getWinStreakFixtureForTeam,
  getWinStreakRound,
  getWinStreakRoundByMatchweek,
} from "@/features/win-streak/fixtures";

describe("Win Streak canonical fixture adapter", () => {
  it("exposes the tracked Matchweek 2-38 source metadata", () => {
    expect(WIN_STREAK_SOURCE).toEqual({
      checkedAt: canonicalFixtureSnapshot.source.checkedAt,
      finalMatchweekTimingUrl:
        canonicalFixtureSnapshot.source.finalMatchweekTimingUrl,
      fixtureListUrl: canonicalFixtureSnapshot.source.fixtureListUrl,
      normalizedFixtureSha256:
        canonicalFixtureSnapshot.source.normalizedFixtureSha256,
      subjectToChange: true,
      timeZone: canonicalFixtureSnapshot.timeZone,
    });
    expect(WIN_STREAK_MATCHWEEKS).toEqual(
      Array.from({ length: 37 }, (_, index) => index + 2),
    );
  });

  it("adapts 37 complete rounds without changing canonical fixture facts", () => {
    const expectedTeams = [...PREMIER_LEAGUE_2026_27_TEAM_SLUGS].sort();

    expect(WIN_STREAK_ROUNDS).toHaveLength(37);
    for (const round of WIN_STREAK_ROUNDS) {
      expect(round.id).toBe(`mw${round.matchweek}`);
      expect(round.fixtures).toHaveLength(10);
      expect(
        round.fixtures
          .flatMap((fixture) => [fixture.homeTeamSlug, fixture.awayTeamSlug])
          .sort(),
      ).toEqual(expectedTeams);
    }

    const firstCanonicalFixture =
      canonicalFixtureSnapshot.rounds[0]!.fixtures[0]!;
    expect(WIN_STREAK_ROUNDS[0]!.fixtures[0]).toMatchObject(
      firstCanonicalFixture,
    );
  });

  it("resolves rounds, fixtures, and each team fixture through typed helpers", () => {
    const round = getWinStreakRoundByMatchweek(2);
    expect(round).toMatchObject({ id: "mw2", matchweek: 2 });
    expect(getWinStreakRound("mw2")).toBe(round);

    const fixture = getWinStreakFixtureForTeam(2, "afc-bournemouth");
    expect(fixture).toMatchObject({
      awayTeamSlug: "everton",
      homeTeamSlug: "afc-bournemouth",
      id: "2026-27-mw02-afc-bournemouth-everton",
      kickoffAt: "2026-08-29T14:00:00.000Z",
      localTime: "15:00",
      matchweek: 2,
    });
    expect(getWinStreakFixtureById(fixture.id)).toBe(fixture);
  });

  it("retains the four-round localhost workshop view from canonical data", () => {
    expect(WIN_STREAK_WORKSHOP_ROUNDS.map((round) => round.matchweek)).toEqual([
      20, 21, 22, 23,
    ]);
  });
});
