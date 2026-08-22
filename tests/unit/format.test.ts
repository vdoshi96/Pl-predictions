import { describe, expect, it } from "vitest";

import { formatChicagoUtcDateTime } from "@/shared/format";

describe("Chicago and UTC date-time formatting", () => {
  it("shows daylight time and UTC for a summer instant", () => {
    expect(formatChicagoUtcDateTime("2026-08-22T15:09:00.000Z")).toBe(
      "22 Aug 2026, 10:09 CDT · 22 Aug 2026, 15:09 UTC",
    );
  });

  it("shows standard time and both dates when the calendar day differs", () => {
    expect(formatChicagoUtcDateTime("2026-12-22T01:15:00.000Z")).toBe(
      "21 Dec 2026, 19:15 CST · 22 Dec 2026, 01:15 UTC",
    );
  });
});
