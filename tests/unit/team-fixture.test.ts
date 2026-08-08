import { describe, expect, it } from "vitest";

import {
  PREMIER_LEAGUE_2026_27_TEAMS,
  PREMIER_LEAGUE_TEAM_COUNT,
} from "@/data";

describe("2026/27 team fixture", () => {
  it("contains exactly 20 unique clubs, external IDs, and monogram paths", () => {
    expect(PREMIER_LEAGUE_2026_27_TEAMS).toHaveLength(
      PREMIER_LEAGUE_TEAM_COUNT,
    );
    expect(
      new Set(PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug)).size,
    ).toBe(PREMIER_LEAGUE_TEAM_COUNT);
    expect(
      new Set(PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.externalId)).size,
    ).toBe(PREMIER_LEAGUE_TEAM_COUNT);
    expect(
      PREMIER_LEAGUE_2026_27_TEAMS.every((team) =>
        team.assetPath.startsWith("/team-marks/"),
      ),
    ).toBe(true);
  });

  it("pins all verified FotMob mappings", () => {
    expect(
      Object.fromEntries(
        PREMIER_LEAGUE_2026_27_TEAMS.map((team) => [
          team.slug,
          team.externalId,
        ]),
      ),
    ).toEqual({
      "afc-bournemouth": 8678,
      arsenal: 9825,
      "aston-villa": 10252,
      brentford: 9937,
      "brighton-and-hove-albion": 10204,
      chelsea: 8455,
      "coventry-city": 8669,
      "crystal-palace": 9826,
      everton: 8668,
      fulham: 9879,
      "hull-city": 8667,
      "ipswich-town": 9902,
      "leeds-united": 8463,
      liverpool: 8650,
      "manchester-city": 8456,
      "manchester-united": 10260,
      "newcastle-united": 10261,
      "nottingham-forest": 10203,
      sunderland: 8472,
      "tottenham-hotspur": 8586,
    });
  });

  it("sorts AFC Bournemouth under Bournemouth", () => {
    const bournemouth = PREMIER_LEAGUE_2026_27_TEAMS.find(
      (team) => team.slug === "afc-bournemouth",
    );
    expect(bournemouth).toMatchObject({
      displayName: "AFC Bournemouth",
      sortName: "Bournemouth",
    });
  });
});
