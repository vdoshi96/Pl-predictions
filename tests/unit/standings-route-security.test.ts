import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isStandingsIngestAuthorized } from "@/features/standings/ingest-security";

const PRIMARY = "primary-standings-secret-with-at-least-32-bytes";
const PREVIOUS = "previous-standings-secret-with-at-least-32-bytes";

function request(secret: string) {
  return new Request("https://example.com/api/automation/standings", {
    headers: { authorization: `Bearer ${secret}` },
    method: "POST",
  });
}

describe("standings ingest secret rotation", () => {
  it("accepts the primary and previous secret during a bounded rotation", () => {
    const environment = {
      STANDINGS_INGEST_SECRET: PRIMARY,
      STANDINGS_INGEST_SECRET_PREVIOUS: PREVIOUS,
    };

    expect(isStandingsIngestAuthorized(request(PRIMARY), environment)).toBe(
      true,
    );
    expect(isStandingsIngestAuthorized(request(PREVIOUS), environment)).toBe(
      true,
    );
    expect(isStandingsIngestAuthorized(request("wrong"), environment)).toBe(
      false,
    );
  });

  it("fails closed when neither configured secret is strong enough", () => {
    expect(
      isStandingsIngestAuthorized(request("short"), {
        STANDINGS_INGEST_SECRET: "short",
      }),
    ).toBe(false);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
