import { randomUUID } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";

export type FinalizeSnapshotInput = {
  auditId?: string;
  now?: Date;
  requestId: string | null;
  seasonId: string;
  snapshotId: string;
};

type FinalizationResultRow = {
  finalized: boolean;
};

type UndoFinalizationResultRow = {
  undone: boolean;
};

/**
 * Claims the exact active snapshot before marking it final. The season update,
 * snapshot flag, and audit record are one statement so a concurrent import can
 * never move the active pointer between those operations.
 */
export function buildFinalizeSnapshotQuery({
  auditId = randomUUID(),
  now = new Date(),
  requestId,
  seasonId,
  snapshotId,
}: FinalizeSnapshotInput): SQL {
  const timestamp = now.toISOString();

  return sql`
    with claimed_season as (
      update "seasons"
      set
        "final_snapshot_id" = ${snapshotId}::uuid,
        "updated_at" = ${timestamp}::timestamptz
      where "id" = ${seasonId}::uuid
        and "active_snapshot_id" = ${snapshotId}::uuid
        and "final_snapshot_id" is null
        and exists (
          select 1
          from "standings_snapshots"
          where "id" = ${snapshotId}::uuid
            and "season_id" = ${seasonId}::uuid
        )
      returning "id"
    ),
    marked_snapshot as (
      update "standings_snapshots"
      set "is_final" = true
      where "id" = ${snapshotId}::uuid
        and "season_id" = ${seasonId}::uuid
        and exists (select 1 from claimed_season)
      returning "id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id",
        "season_id",
        "actor",
        "action",
        "target_type",
        "target_id",
        "request_id",
        "metadata",
        "created_at"
      )
      select
        ${auditId}::uuid,
        claimed_season."id",
        'admin',
        'standings.finalized',
        'standings_snapshot',
        ${snapshotId}::text,
        ${requestId}::text,
        '{}'::jsonb,
        ${timestamp}::timestamptz
      from claimed_season
      inner join marked_snapshot on true
      returning "id"
    )
    select (
      exists (select 1 from claimed_season)
      and exists (select 1 from marked_snapshot)
      and exists (select 1 from recorded_audit)
    ) as "finalized"
  `;
}

export async function finalizeSnapshotAtomically(
  db: Database,
  input: FinalizeSnapshotInput,
): Promise<boolean> {
  const result = await db.execute<FinalizationResultRow>(
    buildFinalizeSnapshotQuery(input),
  );

  return result.rows[0]?.finalized === true;
}

/**
 * Clears final status only while the caller's exact snapshot remains both the
 * active and final pointer. Pointer, snapshot flag, and audit either all change
 * in this statement or none do, so a stale undo cannot clear a newer final.
 */
export function buildUndoFinalSnapshotQuery({
  auditId = randomUUID(),
  now = new Date(),
  requestId,
  seasonId,
  snapshotId,
}: FinalizeSnapshotInput): SQL {
  const timestamp = now.toISOString();

  return sql`
    with claimed_season as (
      update "seasons"
      set
        "final_snapshot_id" = null,
        "updated_at" = ${timestamp}::timestamptz
      where "id" = ${seasonId}::uuid
        and "active_snapshot_id" = ${snapshotId}::uuid
        and "final_snapshot_id" = ${snapshotId}::uuid
      returning "id"
    ),
    unmarked_snapshot as (
      update "standings_snapshots"
      set "is_final" = false
      where "id" = ${snapshotId}::uuid
        and "season_id" = ${seasonId}::uuid
        and exists (select 1 from claimed_season)
      returning "id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id",
        "season_id",
        "actor",
        "action",
        "target_type",
        "target_id",
        "request_id",
        "metadata",
        "created_at"
      )
      select
        ${auditId}::uuid,
        claimed_season."id",
        'admin',
        'standings.finalization_undone',
        'standings_snapshot',
        ${snapshotId}::text,
        ${requestId}::text,
        '{}'::jsonb,
        ${timestamp}::timestamptz
      from claimed_season
      inner join unmarked_snapshot on true
      returning "id"
    )
    select (
      exists (select 1 from claimed_season)
      and exists (select 1 from unmarked_snapshot)
      and exists (select 1 from recorded_audit)
    ) as "undone"
  `;
}

export async function undoFinalSnapshotAtomically(
  db: Database,
  input: FinalizeSnapshotInput,
): Promise<boolean> {
  const result = await db.execute<UndoFinalizationResultRow>(
    buildUndoFinalSnapshotQuery(input),
  );

  return result.rows[0]?.undone === true;
}
