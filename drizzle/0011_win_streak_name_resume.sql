CREATE OR REPLACE FUNCTION "plp_enforce_win_streak_profile_scope"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  joined_matchweek smallint;
  joined_resolved_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new."id" is distinct from old."id"
      or new."season_id" is distinct from old."season_id"
      or new."joined_round_id" is distinct from old."joined_round_id"
      or new."participant_name" is distinct from old."participant_name"
      or new."normalized_participant_name" is distinct from old."normalized_participant_name"
      or new."created_at" is distinct from old."created_at"
    then
      raise exception 'Win Streak profile identity fields are immutable.'
        using errcode = '23514', constraint = 'win_streak_profiles_immutable';
    end if;

    return new;
  end if;

  select "matchweek", "resolved_at"
  into joined_matchweek, joined_resolved_at
  from "win_streak_rounds"
  where "id" = new."joined_round_id"
    and "season_id" = new."season_id";

  if joined_matchweek is null then
    raise exception 'A Win Streak profile must join a round in its season.'
      using errcode = '23514', constraint = 'win_streak_profiles_round_season_check';
  end if;
  if joined_resolved_at is not null or exists (
    select 1
    from "win_streak_rounds"
    where "season_id" = new."season_id"
      and "resolved_at" is null
      and "matchweek" < joined_matchweek
  ) then
    raise exception 'A Win Streak profile must join the current unresolved round.'
      using errcode = '23514', constraint = 'win_streak_profiles_joined_round_check';
  end if;

  return new;
end;
$function$;
