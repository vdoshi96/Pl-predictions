import { buildStandingsDiff } from "@/features/standings/table-diff";
import { describe, expect, it } from "vitest";

describe("buildStandingsDiff", () => {
  const activeItems = [
    {
      teamSlug: "liverpool",
      actualPosition: 1,
      playedGames: 7,
      leaguePoints: 19,
    },
    {
      teamSlug: "arsenal",
      actualPosition: 2,
      playedGames: 7,
      leaguePoints: 16,
    },
  ];
  const labelBySlug = new Map([
    ["liverpool", "Liverpool"],
    ["arsenal", "Arsenal"],
  ] as const);

  it("reports unchanged rows as not changed", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "liverpool",
          actualPosition: 1,
          playedGames: 7,
          leaguePoints: 19,
        },
        {
          teamSlug: "arsenal",
          actualPosition: 2,
          playedGames: 7,
          leaguePoints: 16,
        },
      ],
    });
    expect(diff.movedCount).toBe(0);
    expect(diff.rows.every((row) => !row.changed)).toBe(true);
  });

  it("reports position and number changes", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "arsenal",
          actualPosition: 1,
          playedGames: 8,
          leaguePoints: 19,
        },
        {
          teamSlug: "liverpool",
          actualPosition: 2,
          playedGames: 8,
          leaguePoints: 19,
        },
      ],
    });
    expect(diff.movedCount).toBe(2);
    const arsenal = diff.rows.find((row) => row.teamSlug === "arsenal");
    expect(arsenal).toMatchObject({
      oldPosition: 2,
      newPosition: 1,
      oldPlayed: 7,
      newPlayed: 8,
    });
  });

  it("lists missing teams present in the active snapshot", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "liverpool",
          actualPosition: 1,
          playedGames: 7,
          leaguePoints: 19,
        },
      ],
    });
    expect(diff.missingTeams).toEqual(["arsenal"]);
  });

  it("sorts rows by new position", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "arsenal",
          actualPosition: 1,
          playedGames: 7,
          leaguePoints: 16,
        },
        {
          teamSlug: "liverpool",
          actualPosition: 2,
          playedGames: 7,
          leaguePoints: 19,
        },
      ],
    });
    expect(diff.rows.map((row) => row.teamSlug)).toEqual([
      "arsenal",
      "liverpool",
    ]);
  });
});
