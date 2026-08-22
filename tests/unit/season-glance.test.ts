import { describe, expect, it } from "vitest";

import { getEntryAvatar } from "@/features/leaderboard/entry-avatar";
import {
  computeRankMovement,
  selectPreviousMeaningfulSnapshot,
} from "@/features/leaderboard/movement";
import {
  buildSpotlightCategoryBoard,
  buildSpotlightMatrix,
  canLoadSpotlightCategoryData,
  parseSpotlightView,
} from "@/features/leaderboard/spotlight-board";
import { buildSeasonTablePresentation } from "@/features/standings/season-table-view";

describe("entry avatars", () => {
  it("uses up to two word initials and a deterministic palette color", () => {
    expect(getEntryAvatar("  Maya   Patel ")).toEqual(
      getEntryAvatar("Maya Patel"),
    );
    expect(getEntryAvatar("Maya Patel").initials).toBe("MP");
    expect(getEntryAvatar("Q").initials).toBe("Q");
  });

  it("falls back to the first grapheme for names without Latin word breaks", () => {
    expect(getEntryAvatar("李雷").initials).toBe("李");
    expect(getEntryAvatar("👩🏽‍💻").initials).toBe("👩🏽‍💻");
  });
});

describe("leaderboard movement", () => {
  const active = {
    capturedAt: new Date("2027-01-18T20:00:00.000Z"),
    id: "active",
    matchweek: 21,
  };

  it("prefers the latest earlier matchweek over capture order", () => {
    expect(
      selectPreviousMeaningfulSnapshot(
        [
          {
            capturedAt: new Date("2027-01-17T20:00:00.000Z"),
            id: "mw-19-newer",
            matchweek: 19,
          },
          {
            capturedAt: new Date("2027-01-10T20:00:00.000Z"),
            id: "mw-20",
            matchweek: 20,
          },
        ],
        active,
      )?.id,
    ).toBe("mw-20");
  });

  it("falls back to the latest earlier capture when matchweeks are unavailable", () => {
    expect(
      selectPreviousMeaningfulSnapshot(
        [
          {
            capturedAt: new Date("2027-01-16T20:00:00.000Z"),
            id: "older",
            matchweek: null,
          },
          {
            capturedAt: new Date("2027-01-17T20:00:00.000Z"),
            id: "latest",
            matchweek: null,
          },
        ],
        { ...active, matchweek: null },
      )?.id,
    ).toBe("latest");
  });

  it("uses shared ranks and returns null without a previous scored table", () => {
    const movement = computeRankMovement(
      [
        { id: "a", rank: 1 },
        { id: "b", rank: 1 },
        { id: "c", rank: 3 },
      ],
      [
        { id: "a", rank: 2 },
        { id: "b", rank: 2 },
        { id: "c", rank: 1 },
      ],
    );

    expect(movement.get("a")).toBe(1);
    expect(movement.get("b")).toBe(1);
    expect(movement.get("c")).toBe(-2);
    expect(computeRankMovement([{ id: "a", rank: 1 }], null).get("a")).toBe(
      null,
    );
  });
});

describe("season table presentation", () => {
  it("derives consensus averages and callouts with canonical expectation indexes", () => {
    const presentation = buildSeasonTablePresentation({
      actualTable: [
        { actualPosition: 1, leaguePoints: 50, teamId: "a" },
        { actualPosition: 2, leaguePoints: 45, teamId: "b" },
      ],
      consensusActive: true,
      predictionTables: [
        [
          { predictedPosition: 2, teamId: "a" },
          { predictedPosition: 1, teamId: "b" },
        ],
        [
          { predictedPosition: 2, teamId: "a" },
          { predictedPosition: 1, teamId: "b" },
        ],
      ],
      teams: [
        {
          assetPath: "/a.png",
          displayName: "Alpha",
          id: "a",
          shortName: "ALP",
        },
        {
          assetPath: "/b.png",
          displayName: "Beta",
          id: "b",
          shortName: "BET",
        },
      ],
    });

    expect(presentation.rows).toEqual([
      expect.objectContaining({ actualPosition: 1, avgPredicted: 2, delta: 1 }),
      expect.objectContaining({
        actualPosition: 2,
        avgPredicted: 1,
        delta: -1,
      }),
    ]);
    expect(presentation.callouts.overachiever?.team.displayName).toBe("Alpha");
    expect(presentation.callouts.underachiever?.team.displayName).toBe("Beta");
  });

  it("keeps consensus unavailable when inactive or there are no entries", () => {
    const base = {
      actualTable: [{ actualPosition: 1, leaguePoints: null, teamId: "a" }],
      teams: [
        {
          assetPath: "/a.png",
          displayName: "Alpha",
          id: "a",
          shortName: "ALP",
        },
      ],
    };
    expect(
      buildSeasonTablePresentation({
        ...base,
        consensusActive: false,
        predictionTables: [[{ predictedPosition: 1, teamId: "a" }]],
      }).rows[0],
    ).toMatchObject({ avgPredicted: null, delta: null });
    expect(
      buildSeasonTablePresentation({
        ...base,
        consensusActive: true,
        predictionTables: [],
      }).callouts,
    ).toEqual({ overachiever: null, underachiever: null });
  });
});

describe("spotlight board", () => {
  const entries = [
    {
      accuracyRank: 2,
      accuracyScore: 3,
      availableCategoryCount: 1,
      createdAt: new Date("2026-08-01T00:00:00Z"),
      id: "entry-b",
      participantName: "Ben",
      spotlightPicks: [
        {
          accuracyPoints: 0,
          assetPath: null,
          category: "top_scorer" as const,
          displayName: "Custom Star",
          label: "Top scorer",
          normalizedCustomPlayerName: "custom star",
          playerId: null,
          resultRank: 4,
          resultStatus: "outside-range" as const,
          shortName: null,
          subject: "player" as const,
          teamId: null,
        },
      ],
    },
    {
      accuracyRank: 1,
      accuracyScore: 5,
      availableCategoryCount: 1,
      createdAt: new Date("2026-08-01T00:00:00Z"),
      id: "entry-a",
      participantName: "Ada",
      spotlightPicks: [
        {
          accuracyPoints: 3,
          assetPath: "/star.png",
          category: "top_scorer" as const,
          displayName: "Canonical Star",
          label: "Top scorer",
          normalizedCustomPlayerName: null,
          playerId: "player-star",
          resultRank: 1,
          resultStatus: "ranked" as const,
          shortName: null,
          subject: "player" as const,
          teamId: null,
        },
      ],
    },
  ];

  it("merges snapshot-resolved aliases and distinguishes outside-range from pending", () => {
    const board = buildSpotlightCategoryBoard(entries, {
      aliases: [
        {
          assetPath: "/star.png",
          category: "top_scorer",
          displayName: "Canonical Star",
          normalizedCustomPlayerName: "custom star",
          playerId: "player-star",
        },
      ],
    });
    const scorer = board.find((category) => category.category === "top_scorer");

    expect(scorer?.rows).toHaveLength(1);
    expect(scorer?.rows[0]).toMatchObject({
      count: 2,
      displayName: "Canonical Star",
      isOther: false,
      resultRank: 1,
      resultStatus: "ranked",
    });

    const pending = buildSpotlightCategoryBoard([
      {
        ...entries[0]!,
        spotlightPicks: [
          {
            ...entries[0]!.spotlightPicks[0]!,
            accuracyPoints: null,
            resultRank: null,
            resultStatus: undefined,
          },
        ],
      },
    ]).find((category) => category.category === "top_scorer");
    expect(pending?.rows[0]).toMatchObject({
      accuracyPoints: null,
      isOther: true,
      resultStatus: "pending",
    });
  });

  it("orders the matrix by shared accuracy rank and name", () => {
    expect(
      buildSpotlightMatrix(entries).map((entry) => entry.participantName),
    ).toEqual(["Ada", "Ben"]);
  });

  it("defaults invalid view values to categories and keeps data behind reveal", () => {
    expect(parseSpotlightView(undefined)).toBe("categories");
    expect(parseSpotlightView("invalid")).toBe("categories");
    expect(parseSpotlightView(["matrix", "entries"])).toBe("matrix");
    for (const selectedView of ["categories", "entries", "matrix"] as const) {
      expect(
        canLoadSpotlightCategoryData({
          entryCount: 2,
          predictionsRevealed: false,
          view: selectedView,
        }),
      ).toBe(false);
    }
    expect(
      canLoadSpotlightCategoryData({
        entryCount: 2,
        predictionsRevealed: true,
        view: "categories",
      }),
    ).toBe(true);
  });
});
