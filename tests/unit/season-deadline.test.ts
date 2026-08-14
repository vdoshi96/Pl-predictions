import { describe, expect, it } from "vitest";

import {
  getEffectiveSubmissionDeadline,
  getOpeningKickoff,
  hasSeasonStarted,
} from "@/features/seasons/deadline";

describe("active season deadline", () => {
  const kickoff = new Date("2026-08-21T19:00:00.000Z");

  it("uses the verified opening kickoff as the automatic ceiling", () => {
    expect(getOpeningKickoff()).toEqual(kickoff);
    expect(getEffectiveSubmissionDeadline()).toEqual(kickoff);
  });

  it("uses the owning season kickoff when one is supplied", () => {
    const historicalKickoff = new Date("2025-08-15T19:00:00.000Z");
    expect(getEffectiveSubmissionDeadline(historicalKickoff)).toEqual(
      historicalKickoff,
    );
  });

  it("starts the season at the exact kickoff instant", () => {
    expect(hasSeasonStarted(new Date("2026-08-21T18:59:59.999Z"))).toBe(false);
    expect(hasSeasonStarted(kickoff)).toBe(true);
  });
});
