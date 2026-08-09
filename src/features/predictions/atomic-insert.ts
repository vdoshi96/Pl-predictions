import "server-only";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { PREMIER_LEAGUE_TEAM_COUNT } from "@/data";
import { authoritativeDatabaseTimeSql } from "@/features/seasons/clock";

import { PREDICTION_CATEGORIES } from "./categories";
import type { ValidatedPredictionCategoryPick } from "./validation";
import { normalizedDisplayTextKey } from "./normalization";

export type AtomicPredictionItem = {
  predictedPosition: number;
  teamId: string;
};

export type AtomicPredictionInsertInput = {
  categoryPicks: readonly ValidatedPredictionCategoryPick[];
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
  pickCount: number;
};

function assertAtomicPredictionCardinality(
  input: AtomicPredictionInsertInput,
): void {
  if (input.items.length !== PREMIER_LEAGUE_TEAM_COUNT) {
    throw new RangeError(
      `Atomic prediction inserts require exactly ${PREMIER_LEAGUE_TEAM_COUNT} table items.`,
    );
  }
  if (input.categoryPicks.length !== PREDICTION_CATEGORIES.length) {
    throw new RangeError(
      `Atomic prediction inserts require exactly ${PREDICTION_CATEGORIES.length} spotlight picks.`,
    );
  }
}

/**
 * Locks the season row before deciding whether a prediction may be created.
 * The database clock is authoritative at the deadline boundary. All three
 * inserts depend on the guarded parent CTE, so a closed season cannot leave a
 * prediction, table item, or spotlight pick behind.
 */
export function buildAtomicPredictionInsertQuery(
  input: AtomicPredictionInsertInput,
  authoritativeNow: SQL<Date> = authoritativeDatabaseTimeSql(),
): SQL {
  assertAtomicPredictionCardinality(input);
  const itemsJson = JSON.stringify(
    input.items.map((item) => ({
      predicted_position: item.predictedPosition,
      team_id: item.teamId,
    })),
  );
  const categoryPicksJson = JSON.stringify(
    input.categoryPicks.map((pick) => ({
      category: pick.category,
      custom_player_name:
        "customPlayerName" in pick ? pick.customPlayerName : null,
      normalized_custom_player_name:
        "customPlayerName" in pick
          ? normalizedDisplayTextKey(pick.customPlayerName)
          : null,
      player_id: "playerId" in pick ? pick.playerId : null,
      team_id: "teamId" in pick ? pick.teamId : null,
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
    ),
    inserted_category_picks as (
      insert into "prediction_category_picks" (
        "prediction_id",
        "category",
        "player_id",
        "team_id",
        "custom_player_name",
        "normalized_custom_player_name"
      )
      select
        inserted_prediction."id",
        pick."category",
        pick."player_id",
        pick."team_id",
        pick."custom_player_name",
        pick."normalized_custom_player_name"
      from inserted_prediction
      cross join jsonb_to_recordset(${categoryPicksJson}::jsonb) as pick(
        "category" varchar(32),
        "player_id" uuid,
        "team_id" uuid,
        "custom_player_name" varchar(120),
        "normalized_custom_player_name" varchar(120)
      )
      returning "prediction_id"
    )
    select
      exists (select 1 from inserted_prediction) as "inserted",
      (select count(*)::integer from inserted_items) as "itemCount",
      (select count(*)::integer from inserted_category_picks) as "pickCount"
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

  const expectedItemCount = row.inserted ? PREMIER_LEAGUE_TEAM_COUNT : 0;
  const expectedPickCount = row.inserted ? PREDICTION_CATEGORIES.length : 0;
  if (row.itemCount !== expectedItemCount) {
    throw new Error("Atomic prediction insert returned an invalid item count.");
  }
  if (row.pickCount !== expectedPickCount) {
    throw new Error("Atomic prediction insert returned an invalid pick count.");
  }

  return row.inserted;
}
