import { describe, expect, it } from "vitest";

import {
  normalizeParticipantName,
  normalizedParticipantNameKey,
} from "@/features/predictions/normalization";
import {
  createPredictionCategoryPicksSchema,
  createPredictionItemsSchema,
  customPlayerNameSchema,
  participantNameSchema,
  predictionCategoryPicksSchema,
  predictionItemsSchema,
} from "@/features/predictions/validation";

const teamIds = Array.from(
  { length: 20 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const exactItems = teamIds.map((teamId, index) => ({
  predictedPosition: index + 1,
  teamId,
}));
const playerIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
] as const;
const exactCategoryPicks = [
  { category: "top_scorer", playerId: playerIds[0] },
  { category: "top_assister", customPlayerName: "  Bruno   Fernandes  " },
  { category: "most_clean_sheets", teamId: teamIds[0] },
  { category: "underdog_team", teamId: teamIds[1] },
  { category: "overrated_team", teamId: teamIds[2] },
  { category: "underdog_player", playerId: playerIds[1] },
  { category: "overrated_player", customPlayerName: "  Ｏｔｈｅｒ Player  " },
] as const;

describe("participant name normalization", () => {
  it("applies NFKC, trimming, and whitespace collapse", () => {
    expect(normalizeParticipantName("  Ｖｉｓｈａｌ\t\n Doshi  ")).toBe(
      "Vishal Doshi",
    );
    expect(normalizedParticipantNameKey("  VISHAL   Doshi ")).toBe(
      "vishal doshi",
    );
  });

  it("validates the normalized length", () => {
    expect(participantNameSchema.parse("  Ada  ")).toBe("Ada");
    expect(participantNameSchema.safeParse(" \t ").success).toBe(false);
    expect(participantNameSchema.safeParse("a").success).toBe(false);
    expect(participantNameSchema.safeParse("İ".repeat(40)).success).toBe(false);
  });

  it("removes invisible format characters and rejects control characters", () => {
    expect(normalizedParticipantNameKey("Vish\u200Bal")).toBe("vishal");
    expect(normalizedParticipantNameKey("Vi\u2066shal\u2069")).toBe("vishal");
    expect(participantNameSchema.safeParse("Vish\u0000al").success).toBe(false);
    expect(
      customPlayerNameSchema.safeParse("Erling\u0007Haaland").success,
    ).toBe(false);
  });
});

describe("prediction permutation validation", () => {
  it("accepts one copy of all 20 teams and positions", () => {
    expect(createPredictionItemsSchema(teamIds).parse(exactItems)).toEqual(
      exactItems,
    );
  });

  it("rejects duplicate teams", () => {
    const duplicate = exactItems.map((item) => ({ ...item }));
    duplicate[19]!.teamId = duplicate[0]!.teamId;
    expect(predictionItemsSchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects duplicate positions", () => {
    const duplicate = exactItems.map((item) => ({ ...item }));
    duplicate[19]!.predictedPosition = duplicate[0]!.predictedPosition;
    expect(predictionItemsSchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects missing and out-of-season teams", () => {
    const wrongTeam = exactItems.map((item) => ({ ...item }));
    wrongTeam[19]!.teamId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    expect(
      createPredictionItemsSchema(teamIds).safeParse(wrongTeam).success,
    ).toBe(false);
  });

  it("rejects a list shorter than 20", () => {
    expect(
      predictionItemsSchema.safeParse(exactItems.slice(0, 19)).success,
    ).toBe(false);
  });
});

describe("spotlight prediction validation", () => {
  it("accepts exactly one pick for all seven categories", () => {
    expect(
      createPredictionCategoryPicksSchema(teamIds, playerIds).parse(
        exactCategoryPicks,
      ),
    ).toEqual([
      { category: "top_scorer", playerId: playerIds[0] },
      { category: "top_assister", customPlayerName: "Bruno Fernandes" },
      { category: "most_clean_sheets", teamId: teamIds[0] },
      { category: "underdog_team", teamId: teamIds[1] },
      { category: "overrated_team", teamId: teamIds[2] },
      { category: "underdog_player", playerId: playerIds[1] },
      { category: "overrated_player", customPlayerName: "Other Player" },
    ]);
  });

  it("rejects a missing or duplicate category", () => {
    expect(
      predictionCategoryPicksSchema.safeParse(exactCategoryPicks.slice(0, 6))
        .success,
    ).toBe(false);

    const duplicateCategory: unknown[] = exactCategoryPicks.map((pick) => ({
      ...pick,
    }));
    duplicateCategory[6] = {
      category: "top_scorer",
      customPlayerName: "Replacement player",
    };
    expect(
      predictionCategoryPicksSchema.safeParse(duplicateCategory).success,
    ).toBe(false);
  });

  it("keeps club categories club-only and player categories player-only", () => {
    expect(
      predictionCategoryPicksSchema.safeParse([
        ...exactCategoryPicks.slice(0, 2),
        { category: "most_clean_sheets", customPlayerName: "A goalkeeper" },
        ...exactCategoryPicks.slice(3),
      ]).success,
    ).toBe(false);
    expect(
      predictionCategoryPicksSchema.safeParse([
        { category: "top_scorer", teamId: teamIds[0] },
        ...exactCategoryPicks.slice(1),
      ]).success,
    ).toBe(false);
  });

  it("rejects clubs and catalog players outside the active season", () => {
    const schema = createPredictionCategoryPicksSchema(teamIds, playerIds);
    expect(
      schema.safeParse([
        ...exactCategoryPicks.slice(0, 2),
        {
          category: "most_clean_sheets",
          teamId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        },
        ...exactCategoryPicks.slice(3),
      ]).success,
    ).toBe(false);
    expect(
      schema.safeParse([
        {
          category: "top_scorer",
          playerId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        },
        ...exactCategoryPicks.slice(1),
      ]).success,
    ).toBe(false);
  });

  it("requires a usable name when Other player is selected", () => {
    expect(
      predictionCategoryPicksSchema.safeParse([
        { category: "top_scorer", customPlayerName: " \t " },
        ...exactCategoryPicks.slice(1),
      ]).success,
    ).toBe(false);
  });

  it("rejects names whose canonical lowercase key exceeds storage", () => {
    expect(customPlayerNameSchema.safeParse("İ".repeat(120)).success).toBe(
      false,
    );
  });
});
