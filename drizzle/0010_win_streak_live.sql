CREATE TABLE "win_streak_fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"source_fixture_id" varchar(192) NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"result" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "win_streak_fixtures_distinct_teams_check" CHECK ("win_streak_fixtures"."home_team_id" <> "win_streak_fixtures"."away_team_id"),
	CONSTRAINT "win_streak_fixtures_source_id_check" CHECK (btrim("win_streak_fixtures"."source_fixture_id") <> ''),
	CONSTRAINT "win_streak_fixtures_result_check" CHECK ("win_streak_fixtures"."result" is null or "win_streak_fixtures"."result" in ('home_win', 'draw', 'away_win', 'void'))
);
--> statement-breakpoint
CREATE TABLE "win_streak_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"fixture_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at_pick" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "win_streak_picks_deadline_check" CHECK ("win_streak_picks"."picked_at" < "win_streak_picks"."deadline_at_pick")
);
--> statement-breakpoint
CREATE TABLE "win_streak_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"joined_round_id" uuid NOT NULL,
	"participant_name" varchar(40) NOT NULL,
	"normalized_participant_name" varchar(40) NOT NULL,
	"receipt_token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "win_streak_profiles_participant_name_check" CHECK (char_length("win_streak_profiles"."participant_name") between 2 and 40),
	CONSTRAINT "win_streak_profiles_normalized_name_check" CHECK (char_length("win_streak_profiles"."normalized_participant_name") between 2 and 40),
	CONSTRAINT "win_streak_profiles_receipt_hash_check" CHECK ("win_streak_profiles"."receipt_token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "win_streak_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"matchweek" smallint NOT NULL,
	"pick_deadline" timestamp with time zone NOT NULL,
	"fixture_source" varchar(64) NOT NULL,
	"fixture_source_reference" text NOT NULL,
	"fixture_verified_at" timestamp with time zone NOT NULL,
	"fixture_content_hash" varchar(64) NOT NULL,
	"result_source" varchar(64),
	"result_source_reference" text,
	"result_captured_at" timestamp with time zone,
	"result_content_hash" varchar(64),
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "win_streak_rounds_matchweek_check" CHECK ("win_streak_rounds"."matchweek" between 2 and 38),
	CONSTRAINT "win_streak_rounds_fixture_source_check" CHECK (btrim("win_streak_rounds"."fixture_source") <> '' and btrim("win_streak_rounds"."fixture_source_reference") <> ''),
	CONSTRAINT "win_streak_rounds_fixture_hash_check" CHECK ("win_streak_rounds"."fixture_content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "win_streak_rounds_result_state_check" CHECK ((
        "win_streak_rounds"."resolved_at" is null
        and "win_streak_rounds"."result_source" is null
        and "win_streak_rounds"."result_source_reference" is null
        and "win_streak_rounds"."result_captured_at" is null
        and "win_streak_rounds"."result_content_hash" is null
      ) or (
        "win_streak_rounds"."resolved_at" is not null
        and btrim("win_streak_rounds"."result_source") <> ''
        and btrim("win_streak_rounds"."result_source_reference") <> ''
        and "win_streak_rounds"."result_captured_at" is not null
        and "win_streak_rounds"."result_content_hash" ~ '^[0-9a-f]{64}$'
        and "win_streak_rounds"."resolved_at" >= "win_streak_rounds"."result_captured_at"
      ))
);
--> statement-breakpoint
ALTER TABLE "security_rate_limits" DROP CONSTRAINT "security_rate_limits_scope_check";--> statement-breakpoint
ALTER TABLE "win_streak_fixtures" ADD CONSTRAINT "win_streak_fixtures_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_fixtures" ADD CONSTRAINT "win_streak_fixtures_round_id_win_streak_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."win_streak_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_fixtures" ADD CONSTRAINT "win_streak_fixtures_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_fixtures" ADD CONSTRAINT "win_streak_fixtures_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_picks" ADD CONSTRAINT "win_streak_picks_profile_id_win_streak_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."win_streak_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_picks" ADD CONSTRAINT "win_streak_picks_round_id_win_streak_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."win_streak_rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_picks" ADD CONSTRAINT "win_streak_picks_fixture_id_win_streak_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."win_streak_fixtures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_picks" ADD CONSTRAINT "win_streak_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_profiles" ADD CONSTRAINT "win_streak_profiles_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_profiles" ADD CONSTRAINT "win_streak_profiles_joined_round_id_win_streak_rounds_id_fk" FOREIGN KEY ("joined_round_id") REFERENCES "public"."win_streak_rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_streak_rounds" ADD CONSTRAINT "win_streak_rounds_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "win_streak_fixtures_season_source_unique" ON "win_streak_fixtures" USING btree ("season_id","source_fixture_id");--> statement-breakpoint
CREATE UNIQUE INDEX "win_streak_fixtures_season_pairing_unique" ON "win_streak_fixtures" USING btree ("season_id","home_team_id","away_team_id");--> statement-breakpoint
CREATE INDEX "win_streak_fixtures_round_idx" ON "win_streak_fixtures" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "win_streak_fixtures_home_team_idx" ON "win_streak_fixtures" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "win_streak_fixtures_away_team_idx" ON "win_streak_fixtures" USING btree ("away_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "win_streak_picks_profile_round_unique" ON "win_streak_picks" USING btree ("profile_id","round_id");--> statement-breakpoint
CREATE INDEX "win_streak_picks_round_idx" ON "win_streak_picks" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "win_streak_picks_fixture_idx" ON "win_streak_picks" USING btree ("fixture_id");--> statement-breakpoint
CREATE INDEX "win_streak_picks_team_idx" ON "win_streak_picks" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "win_streak_profiles_season_name_unique" ON "win_streak_profiles" USING btree ("season_id","normalized_participant_name");--> statement-breakpoint
CREATE UNIQUE INDEX "win_streak_profiles_receipt_hash_unique" ON "win_streak_profiles" USING btree ("receipt_token_hash");--> statement-breakpoint
CREATE INDEX "win_streak_profiles_season_created_idx" ON "win_streak_profiles" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE INDEX "win_streak_profiles_joined_round_idx" ON "win_streak_profiles" USING btree ("joined_round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "win_streak_rounds_season_matchweek_unique" ON "win_streak_rounds" USING btree ("season_id","matchweek");--> statement-breakpoint
CREATE INDEX "win_streak_rounds_season_resolution_idx" ON "win_streak_rounds" USING btree ("season_id","resolved_at","matchweek");--> statement-breakpoint
ALTER TABLE "security_rate_limits" ADD CONSTRAINT "security_rate_limits_scope_check" CHECK ("security_rate_limits"."scope" in ('admin_login', 'standings_ingest', 'win_streak_create', 'win_streak_pick'));--> statement-breakpoint
CREATE FUNCTION "plp_enforce_win_streak_fixture_scope"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if not exists (
    select 1
    from "win_streak_rounds"
    where "id" = new."round_id"
      and "season_id" = new."season_id"
  ) or not exists (
    select 1
    from "teams"
    where "id" = new."home_team_id"
      and "season_id" = new."season_id"
  ) or not exists (
    select 1
    from "teams"
    where "id" = new."away_team_id"
      and "season_id" = new."season_id"
  ) then
    raise exception 'A Win Streak fixture and both clubs must belong to the same season and round.'
      using errcode = '23514', constraint = 'win_streak_fixtures_scope_check';
  end if;

  if exists (
    select 1
    from "win_streak_fixtures"
    where "round_id" = new."round_id"
      and "id" <> new."id"
      and (
        "home_team_id" in (new."home_team_id", new."away_team_id")
        or "away_team_id" in (new."home_team_id", new."away_team_id")
      )
  ) then
    raise exception 'A club can appear only once in a Win Streak round.'
      using errcode = '23514', constraint = 'win_streak_fixtures_round_team_unique';
  end if;

  return new;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_fixtures_scope_trigger"
before insert or update of "season_id", "round_id", "home_team_id", "away_team_id"
on "win_streak_fixtures"
for each row
execute function "plp_enforce_win_streak_fixture_scope"();--> statement-breakpoint
CREATE FUNCTION "plp_enforce_win_streak_profile_scope"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  joined_matchweek smallint;
  joined_resolved_at timestamptz;
begin
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

  if tg_op = 'UPDATE' and (
    new."id" is distinct from old."id"
    or new."season_id" is distinct from old."season_id"
    or new."joined_round_id" is distinct from old."joined_round_id"
    or new."participant_name" is distinct from old."participant_name"
    or new."normalized_participant_name" is distinct from old."normalized_participant_name"
    or new."receipt_token_hash" is distinct from old."receipt_token_hash"
    or new."created_at" is distinct from old."created_at"
  ) then
    raise exception 'Win Streak profile identity fields are immutable.'
      using errcode = '23514', constraint = 'win_streak_profiles_immutable';
  end if;

  return new;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_profiles_scope_trigger"
before insert or update
on "win_streak_profiles"
for each row
execute function "plp_enforce_win_streak_profile_scope"();--> statement-breakpoint
CREATE FUNCTION "plp_enforce_win_streak_pick_insert"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  database_now timestamptz;
  fixture_away_team_id uuid;
  fixture_home_team_id uuid;
  fixture_round_id uuid;
  fixture_season_id uuid;
  joined_matchweek smallint;
  profile_season_id uuid;
  target_deadline timestamptz;
  target_matchweek smallint;
  target_resolved_at timestamptz;
  target_season_id uuid;
begin
  select
    target_round."season_id",
    target_round."matchweek",
    target_round."pick_deadline",
    target_round."resolved_at",
    profile."season_id",
    joined_round."matchweek"
  into
    target_season_id,
    target_matchweek,
    target_deadline,
    target_resolved_at,
    profile_season_id,
    joined_matchweek
  from "win_streak_rounds" as target_round
  inner join "win_streak_profiles" as profile
    on profile."id" = new."profile_id"
  inner join "win_streak_rounds" as joined_round
    on joined_round."id" = profile."joined_round_id"
  where target_round."id" = new."round_id"
  for update of target_round;

  if target_season_id is null
    or profile_season_id <> target_season_id
    or target_matchweek < joined_matchweek then
    raise exception 'A Win Streak pick must belong to its profile season after the joined round.'
      using errcode = '23514', constraint = 'win_streak_picks_profile_round_check';
  end if;
  if target_resolved_at is not null or exists (
    select 1
    from "win_streak_rounds"
    where "season_id" = target_season_id
      and "resolved_at" is null
      and "matchweek" < target_matchweek
  ) then
    raise exception 'A Win Streak pick must target the current unresolved round.'
      using errcode = '23514', constraint = 'win_streak_picks_current_round_check';
  end if;

  select "season_id", "round_id", "home_team_id", "away_team_id"
  into
    fixture_season_id,
    fixture_round_id,
    fixture_home_team_id,
    fixture_away_team_id
  from "win_streak_fixtures"
  where "id" = new."fixture_id";

  if fixture_season_id is null
    or fixture_season_id <> target_season_id
    or fixture_round_id <> new."round_id" then
    raise exception 'A Win Streak pick must reference a fixture in its round and season.'
      using errcode = '23514', constraint = 'win_streak_picks_fixture_round_check';
  end if;
  if new."team_id" not in (fixture_home_team_id, fixture_away_team_id) then
    raise exception 'A Win Streak pick must select a club in its fixture.'
      using errcode = '23514', constraint = 'win_streak_picks_fixture_team_check';
  end if;

  if exists (
    with prior_outcomes as (
      select
        prior_round."matchweek",
        prior_pick."team_id",
        case
          when prior_fixture."result" = 'void' then 'void'
          when prior_fixture."result" = 'draw' then 'break'
          when prior_fixture."result" = 'home_win'
            and prior_pick."team_id" = prior_fixture."home_team_id" then 'win'
          when prior_fixture."result" = 'away_win'
            and prior_pick."team_id" = prior_fixture."away_team_id" then 'win'
          else 'break'
        end as outcome
      from "win_streak_picks" as prior_pick
      inner join "win_streak_rounds" as prior_round
        on prior_round."id" = prior_pick."round_id"
      inner join "win_streak_fixtures" as prior_fixture
        on prior_fixture."id" = prior_pick."fixture_id"
      where prior_pick."profile_id" = new."profile_id"
        and prior_round."matchweek" < target_matchweek
        and prior_fixture."result" is not null
    ), latest_break as (
      select coalesce(max("matchweek"), 1) as "matchweek"
      from prior_outcomes
      where outcome = 'break'
    )
    select 1
    from prior_outcomes
    cross join latest_break
    where prior_outcomes.outcome = 'win'
      and prior_outcomes."matchweek" > latest_break."matchweek"
      and prior_outcomes."team_id" = new."team_id"
  ) then
    raise exception 'That club is unavailable during the current Win Streak.'
      using errcode = '23514', constraint = 'win_streak_picks_club_reuse_check';
  end if;

  database_now := clock_timestamp();
  if database_now >= target_deadline then
    raise exception 'The Win Streak pick deadline has passed.'
      using errcode = '23514', constraint = 'win_streak_picks_deadline_check';
  end if;
  new."picked_at" := database_now;
  new."deadline_at_pick" := target_deadline;
  return new;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_picks_insert_trigger"
before insert
on "win_streak_picks"
for each row
execute function "plp_enforce_win_streak_pick_insert"();--> statement-breakpoint
CREATE FUNCTION "plp_prevent_win_streak_pick_update"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  raise exception 'Win Streak picks are immutable.'
    using errcode = '23514', constraint = 'win_streak_picks_immutable';
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_picks_immutable_trigger"
before update
on "win_streak_picks"
for each row
execute function "plp_prevent_win_streak_pick_update"();--> statement-breakpoint
CREATE FUNCTION "plp_protect_win_streak_pick_delete"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if pg_trigger_depth() <= 1 and exists (
    select 1 from "win_streak_profiles" where "id" = old."profile_id"
  ) then
    raise exception 'Win Streak picks can be deleted only with their profile.'
      using errcode = '23514', constraint = 'win_streak_picks_profile_delete_check';
  end if;
  return old;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_picks_delete_trigger"
before delete
on "win_streak_picks"
for each row
execute function "plp_protect_win_streak_pick_delete"();--> statement-breakpoint
CREATE FUNCTION "plp_enforce_win_streak_round_update"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  result_changed boolean;
  schedule_changed boolean;
begin
  if new."id" is distinct from old."id"
    or new."season_id" is distinct from old."season_id"
    or new."matchweek" is distinct from old."matchweek"
    or new."created_at" is distinct from old."created_at" then
    raise exception 'Win Streak round identity fields are immutable.'
      using errcode = '23514', constraint = 'win_streak_rounds_identity_immutable';
  end if;

  schedule_changed :=
    new."pick_deadline" is distinct from old."pick_deadline"
    or new."fixture_source" is distinct from old."fixture_source"
    or new."fixture_source_reference" is distinct from old."fixture_source_reference"
    or new."fixture_verified_at" is distinct from old."fixture_verified_at"
    or new."fixture_content_hash" is distinct from old."fixture_content_hash";
  result_changed :=
    new."result_source" is distinct from old."result_source"
    or new."result_source_reference" is distinct from old."result_source_reference"
    or new."result_captured_at" is distinct from old."result_captured_at"
    or new."result_content_hash" is distinct from old."result_content_hash"
    or new."resolved_at" is distinct from old."resolved_at";

  if old."resolved_at" is not null and (
    schedule_changed or result_changed
  ) then
    raise exception 'Resolved Win Streak rounds are immutable.'
      using errcode = '23514', constraint = 'win_streak_rounds_resolved_immutable';
  end if;
  if schedule_changed then
    if result_changed
      or exists (
        select 1 from "win_streak_picks" where "round_id" = old."id"
      )
      or clock_timestamp() >= old."pick_deadline"
      or clock_timestamp() >= new."pick_deadline" then
      raise exception 'A Win Streak schedule can change only before its deadline, before picks, and before resolution.'
        using errcode = '23514', constraint = 'win_streak_rounds_schedule_update_check';
    end if;
  end if;
  if result_changed and (
    schedule_changed
    or old."resolved_at" is not null
    or new."resolved_at" is null
  ) then
    raise exception 'A Win Streak round can be resolved only once.'
      using errcode = '23514', constraint = 'win_streak_rounds_result_transition_check';
  end if;
  return new;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_rounds_update_trigger"
before update
on "win_streak_rounds"
for each row
execute function "plp_enforce_win_streak_round_update"();--> statement-breakpoint
CREATE FUNCTION "plp_enforce_win_streak_fixture_update"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  round_deadline timestamptz;
  round_resolved_at timestamptz;
  result_changed boolean;
  schedule_changed boolean;
begin
  if new."id" is distinct from old."id"
    or new."season_id" is distinct from old."season_id"
    or new."round_id" is distinct from old."round_id"
    or new."source_fixture_id" is distinct from old."source_fixture_id"
    or new."home_team_id" is distinct from old."home_team_id"
    or new."away_team_id" is distinct from old."away_team_id"
    or new."created_at" is distinct from old."created_at" then
    raise exception 'Win Streak fixture identity fields are immutable.'
      using errcode = '23514', constraint = 'win_streak_fixtures_identity_immutable';
  end if;

  schedule_changed := new."kickoff_at" is distinct from old."kickoff_at";
  result_changed := new."result" is distinct from old."result";
  if old."result" is not null and result_changed then
    raise exception 'Resolved Win Streak fixture results are immutable.'
      using errcode = '23514', constraint = 'win_streak_fixtures_result_immutable';
  end if;
  if result_changed and (schedule_changed or new."result" is null) then
    raise exception 'A Win Streak fixture result can be recorded only once.'
      using errcode = '23514', constraint = 'win_streak_fixtures_result_transition_check';
  end if;

  if schedule_changed then
    select "pick_deadline", "resolved_at"
    into round_deadline, round_resolved_at
    from "win_streak_rounds"
    where "id" = old."round_id"
    for update;

    if result_changed
      or old."result" is not null
      or round_resolved_at is not null
      or exists (
        select 1 from "win_streak_picks" where "round_id" = old."round_id"
      )
      or clock_timestamp() >= round_deadline then
      raise exception 'A Win Streak fixture kickoff can change only before its deadline, before picks, and before resolution.'
        using errcode = '23514', constraint = 'win_streak_fixtures_schedule_update_check';
    end if;
  end if;
  return new;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_fixtures_update_trigger"
before update
on "win_streak_fixtures"
for each row
execute function "plp_enforce_win_streak_fixture_update"();--> statement-breakpoint
CREATE FUNCTION "plp_protect_win_streak_schedule_delete"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if pg_trigger_depth() <= 1 then
    if tg_table_name = 'win_streak_rounds' and exists (
      select 1 from "seasons" where "id" = old."season_id"
    ) then
      raise exception 'Win Streak rounds can be deleted only with their season.'
        using errcode = '23514', constraint = 'win_streak_rounds_season_delete_check';
    elsif tg_table_name = 'win_streak_fixtures' and exists (
      select 1 from "win_streak_rounds" where "id" = old."round_id"
    ) then
      raise exception 'Win Streak fixtures can be deleted only with their round.'
        using errcode = '23514', constraint = 'win_streak_fixtures_round_delete_check';
    end if;
  end if;
  return old;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "win_streak_rounds_delete_trigger"
before delete
on "win_streak_rounds"
for each row
execute function "plp_protect_win_streak_schedule_delete"();--> statement-breakpoint
CREATE TRIGGER "win_streak_fixtures_delete_trigger"
before delete
on "win_streak_fixtures"
for each row
execute function "plp_protect_win_streak_schedule_delete"();--> statement-breakpoint
CREATE FUNCTION "plp_enforce_win_streak_round_integrity"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  distinct_team_count integer;
  fixture_count integer;
  fixture_result_count integer;
  round_deadline timestamptz;
  target_round_id uuid;
  round_resolved_at timestamptz;
begin
  if tg_table_name = 'win_streak_rounds' then
    if tg_op = 'DELETE' then
      target_round_id := old."id";
    else
      target_round_id := new."id";
    end if;
  elsif tg_op = 'DELETE' then
    target_round_id := old."round_id";
  else
    target_round_id := new."round_id";
  end if;

  select "pick_deadline", "resolved_at"
  into round_deadline, round_resolved_at
  from "win_streak_rounds"
  where "id" = target_round_id;
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select
    count(*),
    count("result"),
    min("kickoff_at")
  into fixture_count, fixture_result_count, round_deadline
  from "win_streak_fixtures"
  where "round_id" = target_round_id;

  select count(*)
  into distinct_team_count
  from (
    select "home_team_id" as "team_id"
    from "win_streak_fixtures"
    where "round_id" = target_round_id
    union
    select "away_team_id" as "team_id"
    from "win_streak_fixtures"
    where "round_id" = target_round_id
  ) as round_teams;

  if fixture_count <> 10 or distinct_team_count <> 20 then
    raise exception 'Each Win Streak round must contain ten fixtures and all 20 clubs exactly once.'
      using errcode = '23514', constraint = 'win_streak_rounds_fixture_coverage_check';
  end if;
  if round_deadline is distinct from (
    select "pick_deadline" from "win_streak_rounds" where "id" = target_round_id
  ) then
    raise exception 'A Win Streak round deadline must equal its earliest fixture kickoff.'
      using errcode = '23514', constraint = 'win_streak_rounds_deadline_check';
  end if;
  if (round_resolved_at is null and fixture_result_count <> 0)
    or (round_resolved_at is not null and fixture_result_count <> 10) then
    raise exception 'A Win Streak round must resolve all ten fixture results together.'
      using errcode = '23514', constraint = 'win_streak_rounds_result_coverage_check';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "win_streak_rounds_integrity_trigger"
after insert or update
on "win_streak_rounds"
deferrable initially deferred
for each row
execute function "plp_enforce_win_streak_round_integrity"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "win_streak_fixtures_integrity_trigger"
after insert or update or delete
on "win_streak_fixtures"
deferrable initially deferred
for each row
execute function "plp_enforce_win_streak_round_integrity"();--> statement-breakpoint
CREATE FUNCTION "plp_cascade_win_streak_for_deleted_season"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  delete from "win_streak_profiles" where "season_id" = old."id";
  delete from "win_streak_rounds" where "season_id" = old."id";
  return old;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "seasons_win_streak_delete_trigger"
before delete
on "seasons"
for each row
execute function "plp_cascade_win_streak_for_deleted_season"();
