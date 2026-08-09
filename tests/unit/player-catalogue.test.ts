import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
  PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
  PREMIER_LEAGUE_2026_27_PLAYERS,
  PREMIER_LEAGUE_2026_27_TEAMS,
} from "@/data";
import {
  normalizePlayerCatalogue,
  SOURCE_TEAM_SLUG_MAP,
} from "../../scripts/normalize-player-catalogue";
import { buildPlayerSeedValues } from "../../scripts/seed";

describe("normalized 2026/27 player catalogue", () => {
  it("contains the exact reviewed roster and portrait coverage", () => {
    expect(PREMIER_LEAGUE_2026_27_PLAYERS).toHaveLength(
      PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
    );
    expect(
      new Set(
        PREMIER_LEAGUE_2026_27_PLAYERS.map((player) => player.externalId),
      ),
    ).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);
    expect(
      PREMIER_LEAGUE_2026_27_PLAYERS.every(
        (player) =>
          Number.isSafeInteger(player.externalId) && player.externalId > 0,
      ),
    ).toBe(true);
    expect(
      new Set(
        PREMIER_LEAGUE_2026_27_PLAYERS.map((player) =>
          player.displayName.normalize("NFKC").toLocaleLowerCase("en-GB"),
        ),
      ),
    ).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);

    const portraits = PREMIER_LEAGUE_2026_27_PLAYERS.filter(
      (player) => player.assetPath !== null,
    );
    const fallbacks = PREMIER_LEAGUE_2026_27_PLAYERS.filter(
      (player) => player.assetPath === null,
    );
    expect(portraits).toHaveLength(
      PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
    );
    expect(new Set(portraits.map((player) => player.assetPath))).toHaveLength(
      PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
    );
    expect(
      portraits.every(
        (player) =>
          player.assetPath !== null &&
          existsSync(join(process.cwd(), "public", player.assetPath.slice(1))),
      ),
    ).toBe(true);
    expect(fallbacks.map((player) => player.displayName).toSorted()).toEqual([
      "Aidan Harris",
      "Alysson",
      "David Akintola",
      "Denner",
      "Jack Fletcher",
      "Kota Takai",
      "Tom McGill",
    ]);
  });

  it("maps all source clubs to the canonical 20-team fixture", () => {
    expect(Object.keys(SOURCE_TEAM_SLUG_MAP)).toHaveLength(20);
    expect(new Set(Object.values(SOURCE_TEAM_SLUG_MAP))).toEqual(
      new Set(PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug)),
    );
    expect(
      new Set(PREMIER_LEAGUE_2026_27_PLAYERS.map((player) => player.teamSlug)),
    ).toEqual(new Set(PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug)));
  });

  it("builds active seed rows with canonical team IDs and null fallbacks", () => {
    const teamIdBySlug = new Map(
      PREMIER_LEAGUE_2026_27_TEAMS.map((team) => [
        team.slug,
        `team:${team.slug}`,
      ]),
    );
    const rows = buildPlayerSeedValues("season:2026-27", teamIdBySlug);

    expect(rows).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);
    expect(rows.every((row) => row.isActive)).toBe(true);
    expect(rows.filter((row) => row.assetPath === null)).toHaveLength(7);
    expect(rows.every((row) => row.teamId.startsWith("team:"))).toBe(true);
    expect(rows.find((row) => row.displayName === "Bukayo Saka")).toMatchObject(
      {
        assetPath: "/player-faces/fc_arsenal_saka_bukayo.png",
        teamId: "team:arsenal",
      },
    );
    expect(rows.find((row) => row.displayName === "Alysson")).toMatchObject({
      assetPath: null,
      teamId: "team:aston-villa",
    });
  });

  it("fails closed when a player references an unavailable canonical team", () => {
    expect(() => buildPlayerSeedValues("season:2026-27", new Map())).toThrow(
      "references unavailable team",
    );
  });
});

describe("player catalogue normalizer", () => {
  const expectations = {
    imageCount: 1,
    missingImageCount: 1,
    playerCount: 2,
    requireAllSourceTeams: false,
  };
  const sourceRows = [
    {
      club_slug: "fc-arsenal",
      image_filename: "alex_test.png",
      image_found: "Yes",
      player_name: "  A\u0301lex   Test  ",
      tm_player_id: "7",
    },
    {
      club_slug: "aston-villa",
      image_filename: "",
      image_found: "No",
      player_name: "Alysson",
      tm_player_id: "8",
    },
  ];

  it("normalizes names, IDs, team slugs, and missing portraits", () => {
    const players = normalizePlayerCatalogue(
      sourceRows,
      new Set(["alex_test.png"]),
      expectations,
    );

    expect(players).toEqual([
      {
        assetPath: "/player-faces/alex_test.png",
        displayName: "\u00c1lex Test",
        externalId: 7,
        firstName: "\u00c1lex",
        lastName: "Test",
        slug: "alex-test-7",
        sortName: "Test, \u00c1lex",
        teamSlug: "arsenal",
      },
      {
        assetPath: null,
        displayName: "Alysson",
        externalId: 8,
        firstName: "Alysson",
        lastName: null,
        slug: "alysson-8",
        sortName: "Alysson",
        teamSlug: "aston-villa",
      },
    ]);
  });

  it("rejects duplicate positive external IDs and unreferenced images", () => {
    expect(() =>
      normalizePlayerCatalogue(
        [sourceRows[0], { ...sourceRows[1], tm_player_id: "7" }],
        new Set(["alex_test.png"]),
        expectations,
      ),
    ).toThrow("duplicates tm_player_id 7");

    expect(() =>
      normalizePlayerCatalogue(
        sourceRows,
        new Set(["different.png"]),
        expectations,
      ),
    ).toThrow("references missing PNG alex_test.png");
  });
});
