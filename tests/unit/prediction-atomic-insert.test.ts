import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/client";
import {
  buildAtomicPredictionInsertQuery,
  insertPredictionAtomically,
  type AtomicPredictionInsertInput,
} from "@/features/predictions/atomic-insert";

const input: AtomicPredictionInsertInput = {
  id: "00000000-0000-4000-8000-000000000001",
  items: Array.from({ length: 20 }, (_, index) => ({
    predictedPosition: index + 1,
    teamId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
  })),
  normalizedParticipantName: "deadline tester",
  participantName: "Deadline Tester",
  receiptTokenHash: "a".repeat(64),
  seasonId: "00000000-0000-4000-8000-000000000002",
};

describe("atomic prediction insertion", () => {
  it("locks the season before checking the wall clock and either insert", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildAtomicPredictionInsertQuery(input),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(statement).toContain("locked_season as materialized");
    expect(statement).toContain("deadline_check as materialized");
    expect(statement).toContain("eligible_season as materialized");
    expect(statement).toContain('where "submissions_locked" = false');
    expect(statement).toContain('and "reveal_predictions" = false');
    expect(statement).toContain('and "checked_at" < "opening_kickoff"');
    expect(statement).toContain('or "checked_at" < "submission_deadline"');
    expect(statement).toContain('clock_timestamp() as "checked_at"');
    expect(statement).toContain("for update");
    expect(statement).toContain(
      "from inserted_prediction cross join jsonb_to_recordset",
    );
    expect(statement).toContain('returning "prediction_id"');
    expect(rendered.params).toContain(input.seasonId);
    expect(rendered.params).not.toContainEqual(expect.any(Date));
  });

  it("reports a lost guard without accepting any item rows", async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ inserted: false, itemCount: 0 }],
    });
    const db = { execute } as unknown as Database;

    await expect(insertPredictionAtomically(db, input)).resolves.toBe(false);
  });

  it("accepts only a complete result from the guarded statement", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ inserted: true, itemCount: input.items.length }],
      })
      .mockResolvedValueOnce({ rows: [{ inserted: true, itemCount: 19 }] });
    const db = { execute } as unknown as Database;

    await expect(insertPredictionAtomically(db, input)).resolves.toBe(true);
    await expect(insertPredictionAtomically(db, input)).rejects.toThrow(
      "invalid item count",
    );
  });
});
