import { describe, expect, it } from "vitest";

import {
  formatLeagueDateTime,
  formatLeagueDay,
  formatLeagueTime,
  formatUtcDateTime,
} from "@/shared/format";

describe("league-time formatting", () => {
  it("formats a summer instant as one short Chicago line", () => {
    expect(formatLeagueDateTime(new Date("2026-09-20T18:13:00.000Z"))).toBe(
      "Sun 20 Sep, 1:13 pm CDT",
    );
  });

  it("uses CST in winter and the Chicago calendar date, not the UTC date", () => {
    expect(formatLeagueDateTime("2026-12-22T01:15:00.000Z")).toBe(
      "Mon 21 Dec, 7:15 pm CST",
    );
  });

  it("writes midnight and noon as 12", () => {
    expect(formatLeagueDateTime("2026-10-10T05:00:00.000Z")).toBe(
      "Sat 10 Oct, 12:00 am CDT",
    );
    expect(formatLeagueDateTime("2026-10-10T17:00:00.000Z")).toBe(
      "Sat 10 Oct, 12:00 pm CDT",
    );
  });

  it("splits a kickoff into a Chicago day label and time label", () => {
    expect(formatLeagueDay("2026-10-10T11:30:00.000Z")).toBe("Sat 10 Oct");
    expect(formatLeagueTime("2026-10-10T11:30:00.000Z")).toBe("6:30 am");
    expect(formatLeagueDay("2026-10-11T01:00:00.000Z")).toBe("Sat 10 Oct");
    expect(formatLeagueTime("2026-10-11T01:00:00.000Z")).toBe("8:00 pm");
  });

  it("keeps a precise UTC form for tooltips", () => {
    expect(formatUtcDateTime("2026-09-20T18:13:00.000Z")).toBe(
      "20 Sep 2026, 18:13 UTC",
    );
  });
});
