import "server-only";

import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";

import { authoritativeDatabaseTimeSql } from "./clock";

const seasonClosureSchema = z.discriminatedUnion("intent", [
  z.object({
    confirmationPhrase: z.literal("LOCK"),
    intent: z.literal("lock"),
  }),
  z.object({
    confirmationPhrase: z.literal("REVEAL"),
    intent: z.literal("reveal"),
  }),
]);

export type SeasonClosureIntent = "lock" | "reveal";

type SeasonClosureResultRow = { changed: boolean };

export function parseSeasonClosureIntent(
  input: unknown,
): SeasonClosureIntent | null {
  const parsed = seasonClosureSchema.safeParse(input);
  return parsed.success ? parsed.data.intent : null;
}

export function buildCloseSeasonPermanentlyQuery({
  authoritativeNow = authoritativeDatabaseTimeSql(),
  intent,
  requestId,
  seasonId,
}: {
  authoritativeNow?: SQL<Date>;
  intent: SeasonClosureIntent;
  requestId: string | null;
  seasonId: string;
}): SQL {
  const action =
    intent === "lock"
      ? "season.submissions_locked"
      : "season.predictions_revealed_early";

  return sql`
    with locked_season as materialized (
      select "id"
      from "seasons"
      where "id" = ${seasonId}::uuid
      for update
    ),
    authoritative_time as materialized (
      select ${authoritativeNow} as "now"
      from locked_season
    ),
    transitioned_season as (
      update "seasons"
      set
        "submissions_locked" = true,
        "reveal_predictions" = true,
        "updated_at" = authoritative_time."now"
      from locked_season, authoritative_time
      where "seasons"."id" = locked_season."id"
        and "seasons"."submissions_locked" = false
        and "seasons"."reveal_predictions" = false
        and "seasons"."opening_kickoff" > authoritative_time."now"
      returning "seasons"."id"
    ),
    recorded_audit as (
      insert into "admin_audit_logs" (
        "season_id",
        "actor",
        "action",
        "target_type",
        "target_id",
        "request_id",
        "metadata"
      )
      select
        transitioned_season."id",
        'admin',
        ${action},
        'season',
        transitioned_season."id"::text,
        ${requestId},
        jsonb_build_object(
          'fairnessRule', 'reveal-is-irreversible',
          'intent', ${intent}::text
        )
      from transitioned_season
      returning "id"
    )
    select (
      exists (select 1 from transitioned_season)
      and exists (select 1 from recorded_audit)
    ) as "changed"
  `;
}

export async function closeSeasonPermanentlyAtomically(
  db: Database,
  input: Parameters<typeof buildCloseSeasonPermanentlyQuery>[0],
): Promise<boolean> {
  const result = await db.execute<SeasonClosureResultRow>(
    buildCloseSeasonPermanentlyQuery(input),
  );
  return result.rows[0]?.changed === true;
}
