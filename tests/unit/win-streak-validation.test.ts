import { describe, expect, it } from "vitest";

import {
  createWinStreakProfileInputSchema,
  winStreakPickInputSchema,
  winStreakRoundResultsInputSchema,
} from "@/features/win-streak/validation";

describe("Win Streak input validation", () => {
  it("normalizes the shared 2-40 character display-name contract", () => {
    expect(
      createWinStreakProfileInputSchema.parse({
        displayName: "  Ada   LOVELACE  ",
        website: "",
      }),
    ).toEqual({ displayName: "Ada LOVELACE", website: "" });

    expect(
      createWinStreakProfileInputSchema.safeParse({
        displayName: "a",
        website: "",
      }).success,
    ).toBe(false);
  });

  it("accepts only canonical season clubs for a pick", () => {
    expect(
      winStreakPickInputSchema.parse({ teamSlug: "arsenal" }),
    ).toEqual({ teamSlug: "arsenal" });
    expect(
      winStreakPickInputSchema.safeParse({ teamSlug: "not-a-club" }).success,
    ).toBe(false);
  });

  it("requires one reviewed result for each of ten distinct fixtures", () => {
    const fixtureIds = Array.from(
      { length: 10 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    );
    const input = {
      capturedAt: "2026-08-31T22:00:00.000Z",
      fixtures: fixtureIds.map((fixtureId, index) => ({
        fixtureId,
        result: index === 0 ? "void" : "home_win",
      })),
      matchweek: 2,
      source: "Official Premier League results",
      sourceReference: "https://www.premierleague.com/results",
    };

    expect(winStreakRoundResultsInputSchema.safeParse(input).success).toBe(
      true,
    );
    expect(
      winStreakRoundResultsInputSchema.safeParse({
        ...input,
        fixtures: [...input.fixtures.slice(0, 9), input.fixtures[0]],
      }).success,
    ).toBe(false);
    expect(
      winStreakRoundResultsInputSchema.safeParse({
        ...input,
        fixtures: input.fixtures.slice(0, 9),
      }).success,
    ).toBe(false);
  });
});
