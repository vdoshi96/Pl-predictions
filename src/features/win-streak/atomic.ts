import "server-only";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";

import type { WinStreakTeamSlug } from "./fixtures";

export const WIN_STREAK_PROFILE_LIMIT = 500;

export type AtomicWinStreakProfileInput = {
  id: string;
  normalizedParticipantName: string;
  participantName: string;
  receiptTokenHash: string;
  seasonId: string;
};

export type AtomicWinStreakPickInput = {
  id: string;
  profileId: string;
  receiptTokenHash: string;
  teamSlug: WinStreakTeamSlug;
};

export function buildCreateWinStreakProfileQuery(
  input: AtomicWinStreakProfileInput,
): SQL {
  return sql`
    with "locked_round" as materialized (
      select
        "id",
        "season_id",
        "pick_deadline"
      from "win_streak_rounds"
      where "season_id" = ${input.seasonId}
        and "resolved_at" is null
      order by "matchweek" asc
      limit 1
      for update
    ), "checked_round" as materialized (
      select
        "id",
        "season_id",
        "pick_deadline",
        clock_timestamp() as "checked_at"
      from "locked_round"
    )
    insert into "win_streak_profiles" (
      "id",
      "season_id",
      "joined_round_id",
      "participant_name",
      "normalized_participant_name",
      "receipt_token_hash"
    )
    select
      ${input.id},
      "season_id",
      "id",
      ${input.participantName},
      ${input.normalizedParticipantName},
      ${input.receiptTokenHash}
    from "checked_round"
    where "checked_at" < "pick_deadline"
      and (
        select count(*)
        from "win_streak_profiles"
        where "season_id" = "checked_round"."season_id"
      ) < ${WIN_STREAK_PROFILE_LIMIT}
    returning "id"
  `;
}

export async function insertWinStreakProfileAtomically(
  db: Database,
  input: AtomicWinStreakProfileInput,
): Promise<boolean> {
  const result = await db.execute<{ id: string }>(
    buildCreateWinStreakProfileQuery(input),
  );
  return result.rows.length === 1;
}

export function buildAtomicWinStreakPickQuery(
  input: AtomicWinStreakPickInput,
): SQL {
  return sql`
    with "locked_profile" as materialized (
      select "id", "season_id"
      from "win_streak_profiles"
      where "id" = ${input.profileId}
        and "receipt_token_hash" = ${input.receiptTokenHash}
      for update
    ), "locked_round" as materialized (
      select
        round."id",
        round."season_id",
        round."pick_deadline"
      from "win_streak_rounds" as round
      inner join "locked_profile" as profile
        on profile."season_id" = round."season_id"
      where round."resolved_at" is null
      order by round."matchweek" asc
      limit 1
      for update of round
    ), "checked_round" as materialized (
      select
        "id",
        "season_id",
        "pick_deadline",
        clock_timestamp() as "checked_at"
      from "locked_round"
    ), "candidate" as materialized (
      select
        checked_round."id" as "round_id",
        checked_round."pick_deadline",
        checked_round."checked_at",
        fixture."id" as "fixture_id",
        team."id" as "team_id"
      from "checked_round"
      inner join "win_streak_fixtures" as fixture
        on fixture."round_id" = checked_round."id"
      inner join "teams" as team
        on team."id" in (fixture."home_team_id", fixture."away_team_id")
        and team."season_id" = checked_round."season_id"
      where team."slug" = ${input.teamSlug}
        and checked_round."checked_at" < checked_round."pick_deadline"
    )
    insert into "win_streak_picks" (
      "id",
      "profile_id",
      "round_id",
      "fixture_id",
      "team_id",
      "picked_at",
      "deadline_at_pick"
    )
    select
      ${input.id},
      ${input.profileId},
      "round_id",
      "fixture_id",
      "team_id",
      "checked_at",
      "pick_deadline"
    from "candidate"
    returning "id"
  `;
}

export async function insertWinStreakPickAtomically(
  db: Database,
  input: AtomicWinStreakPickInput,
): Promise<boolean> {
  const result = await db.execute<{ id: string }>(
    buildAtomicWinStreakPickQuery(input),
  );
  return result.rows.length === 1;
}
