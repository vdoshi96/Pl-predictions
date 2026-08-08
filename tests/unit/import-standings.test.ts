import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data";
import { canonicalStandingsSnapshotSchema } from "@/features/standings/validation";
import {
  snapshotContentHash,
  standingsActivationGuard,
} from "../../scripts/import-standings";
import { parseSeedDeadline } from "../../scripts/seed";

const snapshot = canonicalStandingsSnapshotSchema.parse({
  capturedAt: "2026-09-01T12:00:00.000Z",
  isFinal: false,
  kind: "snapshot",
  matchweek: 3,
  seasonSlug: "2026-27",
  source: "owner-export",
  sourceReference: null,
  sourceUpdatedAt: null,
  standings: PREMIER_LEAGUE_2026_27_TEAM_SLUGS.map((teamSlug, index) => ({
    actualPosition: index + 1,
    leaguePoints: 20 - index,
    playedGames: 3,
    teamSlug,
  })),
  version: 1,
});

describe("source-neutral standings import helpers", () => {
  it("loses safely when finalization claims the season row first", () => {
    const rendered = new PgDialect().sqlToQuery(
      standingsActivationGuard({
        capturedAt: new Date(snapshot.capturedAt),
        expectedActiveSnapshotId: "00000000-0000-4000-8000-000000000001",
        seasonId: "00000000-0000-4000-8000-000000000002",
      }),
    );
    const predicate = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(predicate).toContain('"seasons"."final_snapshot_id" is null');
    expect(predicate).toContain('"seasons"."active_snapshot_id" = $');
    expect(predicate).toContain('"seasons"."standings_accepted_through" < $');
    expect(rendered.params).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
      snapshot.capturedAt,
    ]);
  });

  it("also compares an initially empty active pointer", () => {
    const rendered = new PgDialect().sqlToQuery(
      standingsActivationGuard({
        capturedAt: new Date(snapshot.capturedAt),
        expectedActiveSnapshotId: null,
        seasonId: "00000000-0000-4000-8000-000000000002",
      }),
    );

    expect(rendered.sql).toContain('"seasons"."active_snapshot_id" is null');
    expect(rendered.sql).toContain(
      '"seasons"."standings_accepted_through" is null',
    );
  });

  it("can advance only the exact final snapshot's duplicate watermark", () => {
    const finalSnapshotId = "00000000-0000-4000-8000-000000000001";
    const rendered = new PgDialect().sqlToQuery(
      standingsActivationGuard({
        capturedAt: new Date(snapshot.capturedAt),
        expectedActiveSnapshotId: finalSnapshotId,
        expectedFinalSnapshotId: finalSnapshotId,
        seasonId: "00000000-0000-4000-8000-000000000002",
      }),
    );

    expect(rendered.sql).toContain('"seasons"."final_snapshot_id" = $');
    expect(
      rendered.params.filter((value) => value === finalSnapshotId),
    ).toHaveLength(2);
  });

  it("hashes the canonical position order rather than input array order", () => {
    const reordered = {
      ...snapshot,
      standings: [...snapshot.standings].reverse(),
    };
    expect(snapshotContentHash(reordered)).toBe(snapshotContentHash(snapshot));
  });

  it("changes the hash when a standings fact changes", () => {
    const changed = {
      ...snapshot,
      standings: snapshot.standings.map((item) =>
        item.actualPosition === 1 ? { ...item, leaguePoints: 21 } : item,
      ),
    };
    expect(snapshotContentHash(changed)).not.toBe(
      snapshotContentHash(snapshot),
    );
  });

  it("does not treat polling time or source labels as standings content", () => {
    const sameFacts = {
      ...snapshot,
      capturedAt: "2026-09-02T12:00:00.000Z",
      source: "manual-owner-entry",
      sourceReference: "https://example.com/permitted-export",
    };
    expect(snapshotContentHash(sameFacts)).toBe(snapshotContentHash(snapshot));
  });

  it("does not treat a source finality claim as authoritative content", () => {
    expect(snapshotContentHash({ ...snapshot, isFinal: true })).toBe(
      snapshotContentHash(snapshot),
    );
  });
});

describe("seed deadline", () => {
  it("uses null as the automatic Gameweek 1 deadline sentinel", () => {
    expect(parseSeedDeadline("")).toBeNull();
    expect(parseSeedDeadline("2026-08-21T19:00:00.000Z")).toBeNull();
  });

  it("accepts an explicit ISO timestamp", () => {
    expect(parseSeedDeadline("2026-08-21T18:00:00.000Z")?.toISOString()).toBe(
      "2026-08-21T18:00:00.000Z",
    );
  });

  it("rejects an invalid timestamp", () => {
    expect(() => parseSeedDeadline("not-a-date")).toThrow(
      "PREDICTION_DEADLINE_ISO",
    );
  });

  it("rejects timestamps without an explicit timezone", () => {
    expect(() => parseSeedDeadline("2026-08-21T18:00:00")).toThrow(
      "explicit UTC offset",
    );
  });

  it("rejects a seed deadline after the opening kickoff", () => {
    expect(() => parseSeedDeadline("2026-08-21T19:00:00.001Z")).toThrow(
      "cannot be after the Gameweek 1 opening kickoff",
    );
  });
});
