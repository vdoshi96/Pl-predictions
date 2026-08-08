import "server-only";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authoritativeDatabaseTimeSql } from "@/features/seasons/clock";

export type AtomicPredictionItem = {
  predictedPosition: number;
  teamId: string;
};

export type AtomicPredictionInsertInput = {
  id: string;
  items: readonly AtomicPredictionItem[];
  normalizedParticipantName: string;
  participantName: string;
  receiptTokenHash: string;
  seasonId: string;
};

type AtomicPredictionInsertResultRow = {
  inserted: boolean;
  itemCount: number;
};

/**
 * Locks the season row before deciding whether a prediction may be created.
 * The database clock is authoritative at the deadline boundary. Both inserts
 * depend on the guarded parent CTE, so a closed season cannot leave either a
 * prediction or any prediction items behind.
 */
export function buildAtomicPredictionInsertQuery(
  input: AtomicPredictionInsertInput,
  authoritativeNow: SQL<Date> = authoritativeDatabaseTimeSql(),
): SQL {
  const itemsJson = JSON.stringify(
    input.items.map((item) => ({
      predicted_position: item.predictedPosition,
      team_id: item.teamId,
    })),
  );

  return sql`
    with locked_season as materialized (
      select
        "id",
        "opening_kickoff",
        "reveal_predictions",
        "submission_deadline",
        "submissions_locked"
      from "seasons"
      where "id" = ${input.seasonId}::uuid
      for update
    ),
    deadline_check as materialized (
      select
        locked_season.*,
        ${authoritativeNow} as "checked_at"
      from locked_season
    ),
    eligible_season as materialized (
      select "id"
      from deadline_check
      where "submissions_locked" = false
        and "reveal_predictions" = false
        and "checked_at" < "opening_kickoff"
        and (
          "submission_deadline" is null
          or "checked_at" < "submission_deadline"
        )
    ),
    inserted_prediction as (
      insert into "predictions" (
        "id",
        "season_id",
        "participant_name",
        "normalized_participant_name",
        "receipt_token_hash"
      )
      select
        ${input.id}::uuid,
        eligible_season."id",
        ${input.participantName},
        ${input.normalizedParticipantName},
        ${input.receiptTokenHash}
      from eligible_season
      returning "id"
    ),
    inserted_items as (
      insert into "prediction_items" (
        "prediction_id",
        "team_id",
        "predicted_position"
      )
      select
        inserted_prediction."id",
        item."team_id",
        item."predicted_position"
      from inserted_prediction
      cross join jsonb_to_recordset(${itemsJson}::jsonb) as item(
        "team_id" uuid,
        "predicted_position" smallint
      )
      returning "prediction_id"
    )
    select
      exists (select 1 from inserted_prediction) as "inserted",
      (select count(*)::integer from inserted_items) as "itemCount"
  `;
}

export async function insertPredictionAtomically(
  db: Database,
  input: AtomicPredictionInsertInput,
): Promise<boolean> {
  const result = await db.execute<AtomicPredictionInsertResultRow>(
    buildAtomicPredictionInsertQuery(input),
  );
  const row = result.rows[0];

  if (!row) {
    throw new Error("Atomic prediction insert returned no result.");
  }

  const expectedItemCount = row.inserted ? input.items.length : 0;
  if (row.itemCount !== expectedItemCount) {
    throw new Error("Atomic prediction insert returned an invalid item count.");
  }

  return row.inserted;
}
