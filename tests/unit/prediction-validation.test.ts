import { describe, expect, it } from "vitest";

import {
  normalizeParticipantName,
  normalizedParticipantNameKey,
} from "@/features/predictions/normalization";
import {
  createPredictionItemsSchema,
  participantNameSchema,
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
