import { describe, expect, it } from "vitest";

import {
  assertDeadlineNotAfterOpeningKickoff,
  getEffectiveSubmissionDeadline,
  getOpeningKickoff,
  hasSeasonStarted,
  parseOptionalUtcDeadline,
} from "@/features/seasons/deadline";

describe("active season deadline", () => {
  const kickoff = new Date("2026-08-21T19:00:00.000Z");

  it("uses the verified opening kickoff as the automatic ceiling", () => {
    expect(getOpeningKickoff()).toEqual(kickoff);
    expect(getEffectiveSubmissionDeadline(null)).toEqual(kickoff);
    expect(
      getEffectiveSubmissionDeadline(new Date("2026-08-22T12:00:00.000Z")),
    ).toEqual(kickoff);
  });

  it("retains an earlier owner deadline", () => {
    const earlier = new Date("2026-08-20T19:00:00.000Z");
    expect(getEffectiveSubmissionDeadline(earlier)).toEqual(earlier);
  });

  it("rejects configuring a later deadline", () => {
    expect(() =>
      assertDeadlineNotAfterOpeningKickoff(
        new Date("2026-08-21T19:00:00.001Z"),
      ),
    ).toThrow("cannot be after the Gameweek 1 opening kickoff");
  });

  it("starts the season at the exact kickoff instant", () => {
    expect(hasSeasonStarted(new Date("2026-08-21T18:59:59.999Z"))).toBe(false);
    expect(hasSeasonStarted(kickoff)).toBe(true);
  });

  it("parses blank, earlier, and exact-kickoff administrator values", () => {
    expect(parseOptionalUtcDeadline("", kickoff)).toBeNull();
    expect(parseOptionalUtcDeadline("2026-08-20T19:00", kickoff)).toEqual(
      new Date("2026-08-20T19:00:00.000Z"),
    );
    expect(parseOptionalUtcDeadline("2026-08-21T19:00", kickoff)).toBeNull();
  });

  it("rejects a later or impossible administrator value", () => {
    expect(() => parseOptionalUtcDeadline("2026-08-21T19:01", kickoff)).toThrow(
      "cannot be after the Gameweek 1 opening kickoff",
    );
    expect(() => parseOptionalUtcDeadline("2026-02-30T12:00", kickoff)).toThrow(
      "must be a real UTC time",
    );
  });
});
