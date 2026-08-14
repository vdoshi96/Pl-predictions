import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  buildCloseSeasonPermanentlyQuery,
  parseSeasonClosureIntent,
} from "@/features/seasons/closure";

const seasonId = "00000000-0000-4000-8000-000000000001";

describe("permanent season closure", () => {
  it("validates each exact typed phrase on the server", () => {
    expect(
      parseSeasonClosureIntent({ confirmationPhrase: "LOCK", intent: "lock" }),
    ).toBe("lock");
    expect(
      parseSeasonClosureIntent({
        confirmationPhrase: "REVEAL",
        intent: "reveal",
      }),
    ).toBe("reveal");
    expect(
      parseSeasonClosureIntent({ confirmationPhrase: "lock", intent: "lock" }),
    ).toBeNull();
    expect(
      parseSeasonClosureIntent({
        confirmationPhrase: "LOCK",
        intent: "reveal",
      }),
    ).toBeNull();
  });

  it("locks the season before sampling database time for the CAS and audit", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildCloseSeasonPermanentlyQuery({
        intent: "reveal",
        requestId: "request-1",
        seasonId,
      }),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(statement).toContain("clock_timestamp()");
    expect(statement).toContain("locked_season as materialized");
    expect(statement).toContain("for update");
    expect(statement).toContain(
      'authoritative_time as materialized ( select clock_timestamp() as "now" from locked_season',
    );
    expect(statement.indexOf("locked_season as materialized")).toBeLessThan(
      statement.indexOf("clock_timestamp()"),
    );
    expect(statement).toContain('"submissions_locked" = true');
    expect(statement).toContain('"reveal_predictions" = true');
    expect(statement).toContain('"submissions_locked" = false');
    expect(statement).toContain('"reveal_predictions" = false');
    expect(statement).toContain('"opening_kickoff" > authoritative_time."now"');
    expect(statement).toContain("from transitioned_season");
    expect(rendered.params).toContain("season.predictions_revealed_early");
    expect(rendered.params).toContain("request-1");
  });

  it("accepts the fail-closed isolated database clock at the same boundary", () => {
    const fixedNow = new Date("2026-08-08T12:00:00.000Z");
    const rendered = new PgDialect().sqlToQuery(
      buildCloseSeasonPermanentlyQuery({
        authoritativeNow: sql<Date>`${fixedNow}::timestamptz`,
        intent: "lock",
        requestId: "request-2",
        seasonId,
      }),
    );

    expect(rendered.sql).not.toContain("clock_timestamp()");
    expect(rendered.params).toContain(fixedNow);
    expect(rendered.params).toContain("season.submissions_locked");
  });
});
