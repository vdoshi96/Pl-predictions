import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/client";
import {
  buildFinalizeSnapshotQuery,
  buildUndoFinalSnapshotQuery,
  finalizeSnapshotAtomically,
  undoFinalSnapshotAtomically,
} from "@/features/standings/finalization";

const input = {
  auditId: "00000000-0000-4000-8000-000000000004",
  now: new Date("2027-05-24T18:00:00.000Z"),
  requestId: "iad1::finalize-test",
  seasonId: "00000000-0000-4000-8000-000000000002",
  snapshotId: "00000000-0000-4000-8000-000000000001",
};

describe("atomic standings finalization", () => {
  it("loses safely when an import changed the active snapshot first", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildFinalizeSnapshotQuery(input),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(statement).toContain('update "seasons"');
    expect(statement).toContain('and "active_snapshot_id" = $');
    expect(statement).toContain('and "final_snapshot_id" is null');
    expect(statement).toContain('update "standings_snapshots"');
    expect(statement).toContain("and exists (select 1 from claimed_season)");
    expect(statement).toContain(
      "from claimed_season inner join marked_snapshot",
    );
    expect(rendered.params).toContain(input.seasonId);
    expect(rendered.params).toContain(input.snapshotId);
  });

  it("reports success only when the season, snapshot, and audit all changed", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ finalized: true }] })
      .mockResolvedValueOnce({ rows: [{ finalized: false }] });
    const db = { execute } as unknown as Database;

    await expect(finalizeSnapshotAtomically(db, input)).resolves.toBe(true);
    await expect(finalizeSnapshotAtomically(db, input)).resolves.toBe(false);
  });
});

describe("atomic final-status undo", () => {
  it("claims the exact active and final snapshot before changing any state", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildUndoFinalSnapshotQuery(input),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(statement).toContain('update "seasons"');
    expect(statement).toContain('and "active_snapshot_id" = $');
    expect(statement).toContain('and "final_snapshot_id" = $');
    expect(statement).toContain('set "is_final" = false');
    expect(statement).toContain("and exists (select 1 from claimed_season)");
    expect(statement).toContain(
      "from claimed_season inner join unmarked_snapshot",
    );
  });

  it("reports success only when pointer, flag, and audit all changed", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ undone: true }] })
      .mockResolvedValueOnce({ rows: [{ undone: false }] });
    const db = { execute } as unknown as Database;

    await expect(undoFinalSnapshotAtomically(db, input)).resolves.toBe(true);
    await expect(undoFinalSnapshotAtomically(db, input)).resolves.toBe(false);
  });
});
