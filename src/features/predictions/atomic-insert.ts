import "server-only";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";

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
): SQL {
  const itemsJson = JSON.stringify(
    input.items.map((item) => ({
      predicted_position: item.predictedPosition,
      team_id: item.teamId,
    })),
  );

  return sql`
    with eligible_season as materialized (
      select "id"
      from "seasons"
      where "id" = ${input.seasonId}::uuid
        and "submissions_locked" = false
        and "reveal_predictions" = false
        and (
          "submission_deadline" is null
          or now() < "submission_deadline"
        )
      for update
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
