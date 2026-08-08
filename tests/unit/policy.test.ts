import { describe, expect, it } from "vitest";
import { getSeasonAccess } from "@/shared/policy";

const before = new Date("2026-08-14T17:59:59.999Z");
const deadline = new Date("2026-08-14T18:00:00.000Z");

describe("getSeasonAccess", () => {
  it("accepts submissions and keeps entries private before the deadline", () => {
    expect(
      getSeasonAccess(
        {
          revealPredictions: false,
          submissionDeadline: deadline,
          submissionsLocked: false,
        },
        before,
      ),
    ).toEqual({
      deadlinePassed: false,
      predictionsRevealed: false,
      submissionsOpen: true,
    });
  });

  it("closes and reveals at the exact deadline", () => {
    expect(
      getSeasonAccess(
        {
          revealPredictions: false,
          submissionDeadline: deadline,
          submissionsLocked: false,
        },
        deadline,
      ),
    ).toEqual({
      deadlinePassed: true,
      predictionsRevealed: true,
      submissionsOpen: false,
    });
  });

  it("closes submissions whenever predictions are revealed early", () => {
    expect(
      getSeasonAccess(
        {
          revealPredictions: true,
          submissionDeadline: deadline,
          submissionsLocked: false,
        },
        before,
      ),
    ).toMatchObject({ predictionsRevealed: true, submissionsOpen: false });
  });

  it("manual lock closes and reveals entries", () => {
    const access = getSeasonAccess({
      revealPredictions: false,
      submissionDeadline: null,
      submissionsLocked: true,
    });
    expect(access.submissionsOpen).toBe(false);
    expect(access.predictionsRevealed).toBe(true);
  });
});
