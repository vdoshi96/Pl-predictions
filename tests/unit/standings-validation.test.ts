import { describe, expect, it } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data";
import {
  canonicalStandingsFailureSchema,
  canonicalStandingsSnapshotSchema,
  findStandingsFutureTimestampViolation,
  STANDINGS_TIMESTAMP_MAX_FUTURE_SKEW_MS,
} from "@/features/standings/validation";

const standings: Array<{
  actualPosition: number;
  leaguePoints: number;
  playedGames: number;
  teamSlug: string;
}> = PREMIER_LEAGUE_2026_27_TEAM_SLUGS.map((teamSlug, index) => ({
  actualPosition: index + 1,
  leaguePoints: 20 - index,
  playedGames: 10,
  teamSlug,
}));

const snapshot = {
  capturedAt: "2026-09-01T12:00:00.000Z",
  isFinal: false,
  kind: "snapshot" as const,
  matchweek: 3,
  seasonSlug: "2026-27",
  source: "owner-export",
  sourceReference: null,
  sourceUpdatedAt: null,
  standings,
  version: 1 as const,
};

describe("canonical standings validation", () => {
  it("accepts a complete known 20-team permutation", () => {
    expect(canonicalStandingsSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("rejects duplicate teams", () => {
    const duplicate = standings.map((item) => ({ ...item }));
    duplicate[19]!.teamSlug = duplicate[0]!.teamSlug;
    expect(
      canonicalStandingsSnapshotSchema.safeParse({
        ...snapshot,
        standings: duplicate,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate positions", () => {
    const duplicate = standings.map((item) => ({ ...item }));
    duplicate[19]!.actualPosition = duplicate[0]!.actualPosition;
    expect(
      canonicalStandingsSnapshotSchema.safeParse({
        ...snapshot,
        standings: duplicate,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown team in place of a known team", () => {
    const unknown = standings.map((item) => ({ ...item }));
    unknown[19]!.teamSlug = "not-a-premier-league-team";
    expect(
      canonicalStandingsSnapshotSchema.safeParse({
        ...snapshot,
        standings: unknown,
      }).success,
    ).toBe(false);
  });

  it("accepts a canonical source failure without standings", () => {
    expect(
      canonicalStandingsFailureSchema.parse({
        code: "source_unavailable",
        kind: "failure",
        message: "The owner export could not be obtained.",
        observedAt: "2026-09-01T12:00:00.000Z",
        seasonSlug: "2026-27",
        source: "owner-export",
        version: 1,
      }),
    ).toMatchObject({ code: "source_unavailable", kind: "failure" });
  });

  it("permits timestamps within the documented five-minute clock skew", () => {
    const authoritativeNow = new Date("2026-09-01T12:00:00.000Z");
    const latestAllowedAt = new Date(
      authoritativeNow.getTime() + STANDINGS_TIMESTAMP_MAX_FUTURE_SKEW_MS,
    ).toISOString();

    expect(
      findStandingsFutureTimestampViolation(
        {
          capturedAt: latestAllowedAt,
          sourceUpdatedAt: latestAllowedAt,
        },
        authoritativeNow,
      ),
    ).toBeNull();
  });

  it.each(["capturedAt", "sourceUpdatedAt"] as const)(
    "rejects an implausibly future %s timestamp",
    (field) => {
      const authoritativeNow = new Date("2026-09-01T12:00:00.000Z");
      const metadata = {
        capturedAt: authoritativeNow.toISOString(),
        sourceUpdatedAt: null as string | null,
      };
      metadata[field] = new Date(
        authoritativeNow.getTime() + STANDINGS_TIMESTAMP_MAX_FUTURE_SKEW_MS + 1,
      ).toISOString();

      expect(
        findStandingsFutureTimestampViolation(metadata, authoritativeNow),
      ).toMatchObject({ field });
    },
  );
});
