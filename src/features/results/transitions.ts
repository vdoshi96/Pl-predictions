import { randomUUID } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";

import type { SpotlightResultDataset } from "./types";
import type { RankedSpotlightResultRow } from "./validation";

type TransitionResultRow = {
  applied: boolean;
  pinnedAliases?: unknown;
  playerId?: string;
  snapshotId?: string;
};

export type PinnedSpotlightResultAlias = Readonly<{
  normalizedCustomPlayerName: string;
  playerId: string;
}>;

export type SaveResultDraftInput = Readonly<{
  auditId?: string;
  capturedAt: Date;
  contentHash: string;
  coveredThroughRank: number | null;
  dataset: SpotlightResultDataset;
  expectedWorkingSnapshotId: string | null;
  now?: Date;
  requestId: string | null;
  rows: readonly RankedSpotlightResultRow[];
  seasonId: string;
  source: string;
  sourceReference: string | null;
  snapshotId?: string;
  subject: "player" | "team";
}>;

function resultPointerPredicate(
  column: "active_snapshot_id" | "working_snapshot_id",
  expected: string | null,
) {
  const pointer =
    column === "active_snapshot_id"
      ? sql`state."active_snapshot_id"`
      : sql`state."working_snapshot_id"`;
  return expected
    ? sql`${pointer} = ${expected}::uuid`
    : sql`${pointer} is null`;
}

function resultAliasCategoryPredicate(dataset: SpotlightResultDataset): SQL {
  switch (dataset) {
    case "goals":
      return sql`pick."category" = 'top_scorer'`;
    case "assists":
      return sql`pick."category" = 'top_assister'`;
    case "player_ratings":
      return sql`pick."category" in ('underdog_player', 'overrated_player')`;
    case "clean_sheets":
      return sql`false`;
  }
}

export function buildSaveResultDraftQuery({
  auditId = randomUUID(),
  capturedAt,
  contentHash,
  coveredThroughRank,
  dataset,
  expectedWorkingSnapshotId,
  now = new Date(),
  requestId,
  rows,
  seasonId,
  source,
  sourceReference,
  snapshotId = randomUUID(),
  subject,
}: SaveResultDraftInput): SQL {
  const timestamp = now.toISOString();
  const serializedRows = JSON.stringify(
    rows.map((row) => ({
      id: randomUUID(),
      metric_value: row.metricValue,
      outcome_rank: row.outcomeRank,
      subject_id: row.subjectId,
    })),
  );
  const expectedWorking = resultPointerPredicate(
    "working_snapshot_id",
    expectedWorkingSnapshotId,
  );

  return sql`
    with eligible_state as materialized (
      select state."season_id"
      from "spotlight_result_states" as state
      where state."season_id" = ${seasonId}::uuid
        and state."dataset" = ${dataset}
        and ${expectedWorking}
        and state."final_snapshot_id" is null
      for update
    ),
    live_aliases as materialized (
      select
        alias."normalized_custom_player_name",
        alias."custom_player_name",
        alias."player_id"
      from "spotlight_result_aliases" as alias
      where alias."season_id" = ${seasonId}::uuid
        and exists (
          select 1
          from "prediction_category_picks" as pick
          inner join "predictions" as prediction
            on prediction."id" = pick."prediction_id"
          where prediction."season_id" = ${seasonId}::uuid
            and pick."normalized_custom_player_name" =
              alias."normalized_custom_player_name"
            and ${resultAliasCategoryPredicate(dataset)}
        )
    ),
    alias_identity as materialized (
      select coalesce(
        string_agg(
          jsonb_build_array(
            live_aliases."normalized_custom_player_name",
            live_aliases."custom_player_name",
            live_aliases."player_id"::text
          )::text,
          ',' order by live_aliases."normalized_custom_player_name"
        ),
        ''
      ) as "value"
      from live_aliases
    ),
    candidate_snapshot as (
      insert into "spotlight_result_snapshots" (
        "id", "season_id", "dataset", "source", "source_reference",
        "captured_at", "covered_through_rank", "content_hash"
      )
      select
        ${snapshotId}::uuid, ${seasonId}::uuid, ${dataset}, ${source},
        ${sourceReference}, ${capturedAt.toISOString()}::timestamptz,
        ${coveredThroughRank},
        md5(${contentHash}::text || '|' || alias_identity."value") ||
          md5('spotlight-results-v2|' || ${contentHash}::text || '|' || alias_identity."value")
      from eligible_state
      cross join alias_identity
      returning "id"
    ),
    claimed_state as (
      update "spotlight_result_states" as state
      set
        "working_snapshot_id" = candidate_snapshot."id",
        "updated_at" = ${timestamp}::timestamptz
      from candidate_snapshot
      where state."season_id" = ${seasonId}::uuid
        and state."dataset" = ${dataset}
        and ${expectedWorking}
        and state."final_snapshot_id" is null
        and exists (select 1 from eligible_state)
      returning candidate_snapshot."id" as "snapshot_id"
    ),
    inserted_items as (
      insert into "spotlight_result_items" (
        "id", "snapshot_id", "player_id", "team_id", "metric_value",
        "outcome_rank"
      )
      select
        item."id",
        claimed_state."snapshot_id",
        case when ${subject} = 'player' then item."subject_id" else null end,
        case when ${subject} = 'team' then item."subject_id" else null end,
        item."metric_value",
        item."outcome_rank"
      from claimed_state
      cross join jsonb_to_recordset(${serializedRows}::jsonb) as item(
        "id" uuid,
        "subject_id" uuid,
        "metric_value" numeric,
        "outcome_rank" smallint
      )
      returning "id"
    ),
    copied_aliases as (
      insert into "spotlight_result_snapshot_aliases" (
        "snapshot_id", "normalized_custom_player_name", "custom_player_name",
        "player_id"
      )
      select
        claimed_state."snapshot_id",
        alias."normalized_custom_player_name",
        alias."custom_player_name",
        alias."player_id"
      from claimed_state
      cross join live_aliases as alias
      returning "normalized_custom_player_name", "player_id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        ${seasonId}::uuid,
        'admin',
        'spotlight_results.draft_saved',
        'spotlight_result_snapshot',
        claimed_state."snapshot_id"::text,
        ${requestId}::text,
        jsonb_build_object(
          'dataset', ${dataset}::text,
          'coveredThroughRank', ${coveredThroughRank}::integer,
          'itemCount', ${rows.length}::integer,
          'pinnedAliasCount', (select count(*) from copied_aliases)
        ),
        ${timestamp}::timestamptz
      from claimed_state
      returning "id"
    )
    select
      (
        exists (select 1 from claimed_state)
        and exists (select 1 from recorded_audit)
        and (select count(*) from inserted_items) = ${rows.length}
      ) as "applied",
      (select "snapshot_id" from claimed_state limit 1) as "snapshotId",
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'normalizedCustomPlayerName', copied_aliases."normalized_custom_player_name",
              'playerId', copied_aliases."player_id"
            )
            order by copied_aliases."normalized_custom_player_name"
          )
          from copied_aliases
        ),
        '[]'::jsonb
      ) as "pinnedAliases"
  `;
}

function parsePinnedAliases(value: unknown): PinnedSpotlightResultAlias[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "normalizedCustomPlayerName" in candidate &&
      "playerId" in candidate &&
      typeof candidate.normalizedCustomPlayerName === "string" &&
      typeof candidate.playerId === "string"
    ) {
      return [
        {
          normalizedCustomPlayerName: candidate.normalizedCustomPlayerName,
          playerId: candidate.playerId,
        },
      ];
    }
    return [];
  });
}

export async function saveResultDraftAtomically(
  db: Database,
  input: SaveResultDraftInput,
): Promise<{
  applied: boolean;
  pinnedAliases: PinnedSpotlightResultAlias[];
  snapshotId: string | null;
}> {
  const result = await db.execute<TransitionResultRow>(
    buildSaveResultDraftQuery(input),
  );
  return {
    applied: result.rows[0]?.applied === true,
    pinnedAliases: parsePinnedAliases(result.rows[0]?.pinnedAliases),
    snapshotId: result.rows[0]?.snapshotId ?? null,
  };
}

export type ResultPointerTransitionInput = Readonly<{
  activeSnapshotId: string | null;
  auditId?: string;
  dataset: SpotlightResultDataset;
  finalSnapshotId: string | null;
  now?: Date;
  requestId: string | null;
  seasonId: string;
  workingSnapshotId: string | null;
}>;

export function buildPublishResultQuery({
  activeSnapshotId,
  auditId = randomUUID(),
  coverageAttested,
  dataset,
  expectedBracketCount,
  finalSnapshotId,
  now = new Date(),
  requestId,
  seasonId,
  workingSnapshotId,
}: ResultPointerTransitionInput & {
  coverageAttested: true;
  expectedBracketCount: number;
}): SQL {
  if (!workingSnapshotId)
    throw new Error("A working result snapshot is required.");
  if (!Number.isInteger(expectedBracketCount) || expectedBracketCount < 1) {
    throw new Error("At least one submitted bracket is required.");
  }
  if (coverageAttested !== true) {
    throw new Error("Explicit result coverage attestation is required.");
  }
  const timestamp = now.toISOString();
  const expectedActive = resultPointerPredicate(
    "active_snapshot_id",
    activeSnapshotId,
  );
  const expectedFinal = finalSnapshotId
    ? sql`state."final_snapshot_id" = ${finalSnapshotId}::uuid`
    : sql`state."final_snapshot_id" is null`;

  return sql`
    with claimed_state as (
      update "spotlight_result_states" as state
      set
        "active_snapshot_id" = ${workingSnapshotId}::uuid,
        "updated_at" = ${timestamp}::timestamptz
      where state."season_id" = ${seasonId}::uuid
        and state."dataset" = ${dataset}
        and state."working_snapshot_id" = ${workingSnapshotId}::uuid
        and state."active_snapshot_id" is distinct from ${workingSnapshotId}::uuid
        and ${expectedActive}
        and ${expectedFinal}
        and exists (
          select 1
          from "seasons" as season
          where season."id" = ${seasonId}::uuid
            and (
              season."reveal_predictions" = true
              or season."submissions_locked" = true
              or season."opening_kickoff" <= clock_timestamp()
            )
        )
        and (
          select count(*)::integer
          from "predictions" as prediction
          where prediction."season_id" = ${seasonId}::uuid
        ) = ${expectedBracketCount}
        and not exists (
          select 1
          from "prediction_category_picks" as pick
          inner join "predictions" as prediction
            on prediction."id" = pick."prediction_id"
          left join "spotlight_result_snapshot_aliases" as alias
            on alias."snapshot_id" = ${workingSnapshotId}::uuid
           and alias."normalized_custom_player_name" = pick."normalized_custom_player_name"
          where prediction."season_id" = ${seasonId}::uuid
            and ${resultAliasCategoryPredicate(dataset)}
            and pick."normalized_custom_player_name" is not null
            and alias."player_id" is null
        )
        and exists (
          select 1
          from "spotlight_result_snapshots" as snapshot
          where snapshot."id" = ${workingSnapshotId}::uuid
            and snapshot."season_id" = ${seasonId}::uuid
            and snapshot."dataset" = ${dataset}
            and snapshot."covered_through_rank" = ${expectedBracketCount}
            and snapshot."sealed_at" is not null
        )
      returning state."season_id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        claimed_state."season_id",
        'admin',
        'spotlight_results.published',
        'spotlight_result_snapshot',
        ${workingSnapshotId},
        ${requestId}::text,
        jsonb_build_object(
          'dataset', ${dataset}::text,
          'bracketCount', ${expectedBracketCount}::integer,
          'coveredThroughRank', ${expectedBracketCount}::integer,
          'coverageAttested', ${coverageAttested}::boolean
        ),
        ${timestamp}::timestamptz
      from claimed_state
      returning "id"
    )
    select (
      exists (select 1 from claimed_state)
      and exists (select 1 from recorded_audit)
    ) as "applied"
  `;
}

export function buildFinalizeResultQuery({
  activeSnapshotId,
  auditId = randomUUID(),
  dataset,
  finalSnapshotId,
  now = new Date(),
  requestId,
  seasonId,
}: ResultPointerTransitionInput): SQL {
  if (!activeSnapshotId)
    throw new Error("An active result snapshot is required.");
  if (finalSnapshotId) throw new Error("The result snapshot is already final.");
  const timestamp = now.toISOString();

  return sql`
    with claimed_state as (
      update "spotlight_result_states" as state
      set
        "final_snapshot_id" = ${activeSnapshotId}::uuid,
        "updated_at" = ${timestamp}::timestamptz
      where state."season_id" = ${seasonId}::uuid
        and state."dataset" = ${dataset}
        and state."active_snapshot_id" = ${activeSnapshotId}::uuid
        and state."final_snapshot_id" is null
      returning state."season_id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        claimed_state."season_id",
        'admin',
        'spotlight_results.finalized',
        'spotlight_result_snapshot',
        ${activeSnapshotId},
        ${requestId}::text,
        jsonb_build_object('dataset', ${dataset}::text),
        ${timestamp}::timestamptz
      from claimed_state
      returning "id"
    )
    select (
      exists (select 1 from claimed_state)
      and exists (select 1 from recorded_audit)
    ) as "applied"
  `;
}

export function buildUndoFinalResultQuery({
  activeSnapshotId,
  auditId = randomUUID(),
  dataset,
  finalSnapshotId,
  now = new Date(),
  requestId,
  seasonId,
}: ResultPointerTransitionInput): SQL {
  if (!activeSnapshotId || finalSnapshotId !== activeSnapshotId) {
    throw new Error("The exact active final result snapshot is required.");
  }
  const timestamp = now.toISOString();

  return sql`
    with claimed_state as (
      update "spotlight_result_states" as state
      set
        "final_snapshot_id" = null,
        "updated_at" = ${timestamp}::timestamptz
      where state."season_id" = ${seasonId}::uuid
        and state."dataset" = ${dataset}
        and state."active_snapshot_id" = ${activeSnapshotId}::uuid
        and state."final_snapshot_id" = ${finalSnapshotId}::uuid
      returning state."season_id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        claimed_state."season_id",
        'admin',
        'spotlight_results.finalization_undone',
        'spotlight_result_snapshot',
        ${activeSnapshotId},
        ${requestId}::text,
        jsonb_build_object('dataset', ${dataset}::text),
        ${timestamp}::timestamptz
      from claimed_state
      returning "id"
    )
    select (
      exists (select 1 from claimed_state)
      and exists (select 1 from recorded_audit)
    ) as "applied"
  `;
}

export async function applyResultPointerTransition(
  db: Database,
  query: SQL,
): Promise<boolean> {
  const result = await db.execute<TransitionResultRow>(query);
  return result.rows[0]?.applied === true;
}

export function buildSaveResultAliasQuery({
  auditId = randomUUID(),
  customPlayerName,
  normalizedCustomPlayerName,
  now = new Date(),
  playerId,
  requestId,
  seasonId,
}: {
  auditId?: string;
  customPlayerName: string;
  normalizedCustomPlayerName: string;
  now?: Date;
  playerId: string;
  requestId: string | null;
  seasonId: string;
}): SQL {
  const timestamp = now.toISOString();
  return sql`
    with matched_player as (
      select "id"
      from "players"
      where "id" = ${playerId}::uuid
        and "season_id" = ${seasonId}::uuid
    ),
    saved_alias as (
      insert into "spotlight_result_aliases" (
        "season_id", "normalized_custom_player_name", "custom_player_name",
        "player_id", "created_at", "updated_at"
      )
      select
        ${seasonId}::uuid,
        ${normalizedCustomPlayerName},
        ${customPlayerName},
        matched_player."id",
        ${timestamp}::timestamptz,
        ${timestamp}::timestamptz
      from matched_player
      on conflict ("season_id", "normalized_custom_player_name") do update
      set
        "custom_player_name" = excluded."custom_player_name",
        "player_id" = excluded."player_id",
        "updated_at" = excluded."updated_at"
      returning "player_id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        ${seasonId}::uuid,
        'admin',
        'spotlight_results.alias_saved',
        'spotlight_result_alias',
        ${normalizedCustomPlayerName},
        ${requestId}::text,
        jsonb_build_object('playerId', saved_alias."player_id"),
        ${timestamp}::timestamptz
      from saved_alias
      returning "id"
    )
    select (
      exists (select 1 from saved_alias)
      and exists (select 1 from recorded_audit)
    ) as "applied"
  `;
}

export function buildCreateResultOnlyPlayerQuery({
  auditId = randomUUID(),
  customPlayerName,
  normalizedCustomPlayerName,
  now = new Date(),
  playerId = randomUUID(),
  requestId,
  seasonId,
  slug,
}: {
  auditId?: string;
  customPlayerName: string;
  normalizedCustomPlayerName: string;
  now?: Date;
  playerId?: string;
  requestId: string | null;
  seasonId: string;
  slug: string;
}): SQL {
  const timestamp = now.toISOString();
  return sql`
    with submitted_name as (
      select pick."custom_player_name"
      from "prediction_category_picks" as pick
      inner join "predictions" as prediction
        on prediction."id" = pick."prediction_id"
      where prediction."season_id" = ${seasonId}::uuid
        and pick."normalized_custom_player_name" = ${normalizedCustomPlayerName}
        and not exists (
          select 1
          from "players" as existing_player
          where existing_player."season_id" = ${seasonId}::uuid
            and lower(
              regexp_replace(
                btrim(existing_player."display_name"),
                '[[:space:]]+',
                ' ',
                'g'
              )
            ) = ${normalizedCustomPlayerName}
        )
      limit 1
    ),
    claimed_alias as (
      insert into "spotlight_result_aliases" (
        "season_id", "normalized_custom_player_name", "custom_player_name",
        "player_id", "created_at", "updated_at"
      )
      select
        ${seasonId}::uuid,
        ${normalizedCustomPlayerName},
        ${customPlayerName},
        ${playerId}::uuid,
        ${timestamp}::timestamptz,
        ${timestamp}::timestamptz
      from submitted_name
      on conflict ("season_id", "normalized_custom_player_name") do nothing
      returning "player_id"
    ),
    created_player as (
      insert into "players" (
        "id", "season_id", "team_id", "slug", "external_id",
        "first_name", "last_name", "display_name", "sort_name",
        "asset_path", "is_active", "created_at", "updated_at"
      )
      select
        claimed_alias."player_id",
        ${seasonId}::uuid,
        null,
        ${slug},
        null,
        null,
        null,
        ${customPlayerName},
        ${normalizedCustomPlayerName},
        null,
        false,
        ${timestamp}::timestamptz,
        ${timestamp}::timestamptz
      from claimed_alias
      returning "id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        ${seasonId}::uuid,
        'admin',
        'spotlight_results.result_only_player_created',
        'player',
        created_player."id"::text,
        ${requestId}::text,
        jsonb_build_object(
          'customPlayerName', ${customPlayerName}::text,
          'normalizedCustomPlayerName', ${normalizedCustomPlayerName}::text,
          'isActive', false
        ),
        ${timestamp}::timestamptz
      from created_player
      returning "id"
    )
    select
      (
        exists (select 1 from claimed_alias)
        and exists (select 1 from created_player)
        and exists (select 1 from recorded_audit)
      ) as "applied",
      (select "id" from created_player limit 1) as "playerId"
  `;
}

export async function createResultOnlyPlayerAtomically(
  db: Database,
  input: Parameters<typeof buildCreateResultOnlyPlayerQuery>[0],
): Promise<{ applied: boolean; playerId: string | null }> {
  const result = await db.execute<TransitionResultRow>(
    buildCreateResultOnlyPlayerQuery(input),
  );
  return {
    applied: result.rows[0]?.applied === true,
    playerId: result.rows[0]?.playerId ?? null,
  };
}

export function buildCreateStandaloneResultOnlyPlayerQuery({
  auditId = randomUUID(),
  displayName,
  normalizedDisplayName,
  now = new Date(),
  playerId = randomUUID(),
  requestId,
  seasonId,
  slug,
}: {
  auditId?: string;
  displayName: string;
  normalizedDisplayName: string;
  now?: Date;
  playerId?: string;
  requestId: string | null;
  seasonId: string;
  slug: string;
}): SQL {
  const timestamp = now.toISOString();
  return sql`
    with created_player as (
      insert into "players" (
        "id", "season_id", "team_id", "slug", "external_id",
        "first_name", "last_name", "display_name", "sort_name",
        "asset_path", "is_active", "created_at", "updated_at"
      )
      select
        ${playerId}::uuid,
        ${seasonId}::uuid,
        null,
        ${slug},
        null,
        null,
        null,
        ${displayName},
        ${normalizedDisplayName},
        null,
        false,
        ${timestamp}::timestamptz,
        ${timestamp}::timestamptz
      where not exists (
        select 1
        from "players" as existing_player
        where existing_player."season_id" = ${seasonId}::uuid
          and lower(
            regexp_replace(
              btrim(existing_player."display_name"),
              '[[:space:]]+',
              ' ',
              'g'
            )
          ) = ${normalizedDisplayName}
      )
      on conflict do nothing
      returning "id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        ${seasonId}::uuid,
        'admin',
        'spotlight_results.result_only_player_created',
        'player',
        created_player."id"::text,
        ${requestId}::text,
        jsonb_build_object(
          'displayName', ${displayName}::text,
          'normalizedDisplayName', ${normalizedDisplayName}::text,
          'isActive', false,
          'aliasCreated', false
        ),
        ${timestamp}::timestamptz
      from created_player
      returning "id"
    )
    select
      (
        exists (select 1 from created_player)
        and exists (select 1 from recorded_audit)
      ) as "applied",
      (select "id" from created_player limit 1) as "playerId"
  `;
}

export async function createStandaloneResultOnlyPlayerAtomically(
  db: Database,
  input: Parameters<typeof buildCreateStandaloneResultOnlyPlayerQuery>[0],
): Promise<{ applied: boolean; playerId: string | null }> {
  const result = await db.execute<TransitionResultRow>(
    buildCreateStandaloneResultOnlyPlayerQuery(input),
  );
  return {
    applied: result.rows[0]?.applied === true,
    playerId: result.rows[0]?.playerId ?? null,
  };
}
