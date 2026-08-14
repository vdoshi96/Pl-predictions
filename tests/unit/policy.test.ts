import { describe, expect, it } from "vitest";
import { getSeasonAccess } from "@/shared/policy";

const before = new Date("2026-08-14T17:59:59.999Z");
const openingKickoff = new Date("2026-08-21T19:00:00.000Z");

describe("getSeasonAccess", () => {
  it("stays open until kickoff", () => {
    expect(
      getSeasonAccess(
        {
          openingKickoff,
          revealPredictions: false,
          submissionsLocked: false,
        },
        before,
      ),
    ).toEqual({
      deadlinePassed: false,
      predictionsRevealed: false,
      seasonStarted: false,
      submissionDeadline: openingKickoff,
      submissionsOpen: true,
    });
  });

  it("closes and reveals at the exact opening kickoff", () => {
    expect(
      getSeasonAccess(
        {
          openingKickoff,
          revealPredictions: false,
          submissionsLocked: false,
        },
        openingKickoff,
      ),
    ).toEqual({
      deadlinePassed: true,
      predictionsRevealed: true,
      seasonStarted: true,
      submissionDeadline: openingKickoff,
      submissionsOpen: false,
    });
  });

  it("closes submissions whenever predictions are revealed early", () => {
    expect(
      getSeasonAccess(
        {
          openingKickoff,
          revealPredictions: true,
          submissionsLocked: false,
        },
        before,
      ),
    ).toMatchObject({ predictionsRevealed: true, submissionsOpen: false });
  });

  it("manual lock closes and reveals entries", () => {
    const access = getSeasonAccess(
      {
        openingKickoff,
        revealPredictions: false,
        submissionsLocked: true,
      },
      before,
    );
    expect(access.submissionsOpen).toBe(false);
    expect(access.predictionsRevealed).toBe(true);
  });

  it("uses the opening kickoff when no earlier deadline is configured", () => {
    expect(
      getSeasonAccess(
        {
          openingKickoff,
          revealPredictions: false,
          submissionsLocked: false,
        },
        new Date("2026-08-21T18:59:59.999Z"),
      ),
    ).toEqual({
      deadlinePassed: false,
      predictionsRevealed: false,
      seasonStarted: false,
      submissionDeadline: openingKickoff,
      submissionsOpen: true,
    });

    expect(
      getSeasonAccess(
        {
          openingKickoff,
          revealPredictions: false,
          submissionsLocked: false,
        },
        openingKickoff,
      ),
    ).toEqual({
      deadlinePassed: true,
      predictionsRevealed: true,
      seasonStarted: true,
      submissionDeadline: openingKickoff,
      submissionsOpen: false,
    });
  });

  it("uses the owning season kickoff instead of global active-season time", () => {
    const historicalKickoff = new Date("2025-08-15T19:00:00.000Z");
    expect(
      getSeasonAccess(
        {
          openingKickoff: historicalKickoff,
          revealPredictions: false,
          submissionsLocked: false,
        },
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toMatchObject({
      predictionsRevealed: true,
      seasonStarted: true,
      submissionDeadline: historicalKickoff,
      submissionsOpen: false,
    });
  });
});
