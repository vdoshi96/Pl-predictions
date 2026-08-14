CREATE TABLE "spotlight_result_aliases" (
	"season_id" uuid NOT NULL,
	"normalized_custom_player_name" varchar(120) NOT NULL,
	"custom_player_name" varchar(120) NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotlight_result_aliases_season_name_pk" PRIMARY KEY("season_id","normalized_custom_player_name"),
	CONSTRAINT "spotlight_result_aliases_name_check" CHECK (char_length("spotlight_result_aliases"."custom_player_name") between 2 and 120
        and char_length("spotlight_result_aliases"."normalized_custom_player_name") between 2 and 120)
);
--> statement-breakpoint
CREATE TABLE "spotlight_result_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"player_id" uuid,
	"team_id" uuid,
	"metric_value" numeric(8, 3) NOT NULL,
	"outcome_rank" smallint NOT NULL,
	CONSTRAINT "spotlight_result_items_subject_check" CHECK ((
        "spotlight_result_items"."player_id" is not null
        and "spotlight_result_items"."team_id" is null
      ) or (
        "spotlight_result_items"."player_id" is null
        and "spotlight_result_items"."team_id" is not null
      )),
	CONSTRAINT "spotlight_result_items_metric_check" CHECK ("spotlight_result_items"."metric_value" >= 0),
	CONSTRAINT "spotlight_result_items_rank_check" CHECK ("spotlight_result_items"."outcome_rank" between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "spotlight_result_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"dataset" varchar(32) NOT NULL,
	"source" varchar(64) NOT NULL,
	"source_reference" text,
	"captured_at" timestamp with time zone NOT NULL,
	"covered_through_rank" smallint,
	"content_hash" varchar(64) NOT NULL,
	"sealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotlight_result_snapshots_dataset_check" CHECK ("spotlight_result_snapshots"."dataset" in ('goals', 'assists', 'clean_sheets', 'player_ratings')),
	CONSTRAINT "spotlight_result_snapshots_coverage_check" CHECK ("spotlight_result_snapshots"."covered_through_rank" is null or "spotlight_result_snapshots"."covered_through_rank" between 1 and 1000),
	CONSTRAINT "spotlight_result_snapshots_content_hash_check" CHECK (char_length("spotlight_result_snapshots"."content_hash") = 64),
	CONSTRAINT "spotlight_result_snapshots_sealed_at_check" CHECK ("spotlight_result_snapshots"."sealed_at" is null or "spotlight_result_snapshots"."sealed_at" >= "spotlight_result_snapshots"."created_at")
);
--> statement-breakpoint
CREATE TABLE "spotlight_result_states" (
	"season_id" uuid NOT NULL,
	"dataset" varchar(32) NOT NULL,
	"working_snapshot_id" uuid,
	"active_snapshot_id" uuid,
	"final_snapshot_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotlight_result_states_season_dataset_pk" PRIMARY KEY("season_id","dataset"),
	CONSTRAINT "spotlight_result_states_dataset_check" CHECK ("spotlight_result_states"."dataset" in ('goals', 'assists', 'clean_sheets', 'player_ratings')),
	CONSTRAINT "spotlight_result_states_final_active_check" CHECK ("spotlight_result_states"."final_snapshot_id" is null or "spotlight_result_states"."final_snapshot_id" = "spotlight_result_states"."active_snapshot_id")
);
--> statement-breakpoint
ALTER TABLE "spotlight_result_aliases" ADD CONSTRAINT "spotlight_result_aliases_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_aliases" ADD CONSTRAINT "spotlight_result_aliases_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "spotlight_result_items" ADD CONSTRAINT "spotlight_result_items_snapshot_id_spotlight_result_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."spotlight_result_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_items" ADD CONSTRAINT "spotlight_result_items_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_items" ADD CONSTRAINT "spotlight_result_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_snapshots" ADD CONSTRAINT "spotlight_result_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_states" ADD CONSTRAINT "spotlight_result_states_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_states" ADD CONSTRAINT "spotlight_result_states_working_snapshot_id_spotlight_result_snapshots_id_fk" FOREIGN KEY ("working_snapshot_id") REFERENCES "public"."spotlight_result_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_states" ADD CONSTRAINT "spotlight_result_states_active_snapshot_id_spotlight_result_snapshots_id_fk" FOREIGN KEY ("active_snapshot_id") REFERENCES "public"."spotlight_result_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_states" ADD CONSTRAINT "spotlight_result_states_final_snapshot_id_spotlight_result_snapshots_id_fk" FOREIGN KEY ("final_snapshot_id") REFERENCES "public"."spotlight_result_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spotlight_result_aliases_player_idx" ON "spotlight_result_aliases" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_season_normalized_display_name_unique" ON "players" USING btree ("season_id", lower(regexp_replace(btrim("display_name"), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
CREATE UNIQUE INDEX "spotlight_result_items_snapshot_player_unique" ON "spotlight_result_items" USING btree ("snapshot_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spotlight_result_items_snapshot_team_unique" ON "spotlight_result_items" USING btree ("snapshot_id","team_id");--> statement-breakpoint
CREATE INDEX "spotlight_result_items_player_idx" ON "spotlight_result_items" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "spotlight_result_items_team_idx" ON "spotlight_result_items" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "spotlight_result_snapshots_content_idx" ON "spotlight_result_snapshots" USING btree ("season_id","dataset","content_hash");--> statement-breakpoint
CREATE INDEX "spotlight_result_snapshots_season_dataset_created_idx" ON "spotlight_result_snapshots" USING btree ("season_id","dataset","created_at");--> statement-breakpoint
CREATE FUNCTION "prevent_spotlight_result_fact_update"()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'spotlight_result_snapshots'
    and old."sealed_at" is null
    and new."sealed_at" is not null
    and (to_jsonb(new) - 'sealed_at') = (to_jsonb(old) - 'sealed_at') then
    return new;
  end if;

  raise exception 'Spotlight result snapshots and items are immutable.'
    using errcode = '23514', constraint = 'spotlight_result_facts_immutable';
end;
$$;--> statement-breakpoint
CREATE TRIGGER "spotlight_result_snapshots_immutable_trigger"
before update
on "spotlight_result_snapshots"
for each row
execute function "prevent_spotlight_result_fact_update"();--> statement-breakpoint
CREATE FUNCTION "seal_new_spotlight_result_snapshot"()
returns trigger
language plpgsql
as $$
begin
  update "spotlight_result_snapshots"
  set "sealed_at" = greatest(clock_timestamp(), "created_at")
  where "id" = new."id"
    and "sealed_at" is null;

  if not exists (
    select 1
    from "spotlight_result_snapshots"
    where "id" = new."id"
      and "sealed_at" is not null
  ) then
    raise exception 'Spotlight result snapshot could not be sealed.'
      using errcode = '23514', constraint = 'spotlight_result_snapshots_sealed_check';
  end if;
  return new;
end;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "spotlight_result_snapshots_seal_trigger"
after insert
on "spotlight_result_snapshots"
deferrable initially deferred
for each row
execute function "seal_new_spotlight_result_snapshot"();--> statement-breakpoint
CREATE TRIGGER "spotlight_result_items_immutable_trigger"
before update
on "spotlight_result_items"
for each row
execute function "prevent_spotlight_result_fact_update"();--> statement-breakpoint
CREATE FUNCTION "require_open_spotlight_result_snapshot_for_insert"()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from "spotlight_result_snapshots"
    where "id" = new."snapshot_id"
      and "sealed_at" is null
  ) then
    raise exception 'Cannot append facts to a sealed spotlight result snapshot.'
      using errcode = '23514', constraint = 'spotlight_result_snapshot_append_check';
  end if;
  return new;
end;
$$;--> statement-breakpoint
CREATE TRIGGER "spotlight_result_items_append_trigger"
before insert
on "spotlight_result_items"
for each row
execute function "require_open_spotlight_result_snapshot_for_insert"();--> statement-breakpoint
CREATE FUNCTION "protect_referenced_spotlight_result_fact_delete"()
returns trigger
language plpgsql
as $$
declare
  protected_snapshot_id uuid;
  snapshot_season_id uuid;
begin
  if tg_table_name = 'spotlight_result_items' then
    protected_snapshot_id := old."snapshot_id";
  else
    protected_snapshot_id := old."id";
  end if;

  select "season_id"
  into snapshot_season_id
  from "spotlight_result_snapshots"
  where "id" = protected_snapshot_id;

  if pg_trigger_depth() <= 1
    and exists (select 1 from "seasons" where "id" = snapshot_season_id) then
    raise exception 'Spotlight result snapshots and items cannot be deleted.'
      using errcode = '23514', constraint = 'spotlight_result_facts_referenced_delete_check';
  end if;
  return old;
end;
$$;--> statement-breakpoint
CREATE TRIGGER "spotlight_result_snapshots_delete_trigger"
before delete
on "spotlight_result_snapshots"
for each row
execute function "protect_referenced_spotlight_result_fact_delete"();--> statement-breakpoint
CREATE FUNCTION "cascade_spotlight_results_for_deleted_season"()
returns trigger
language plpgsql
as $$
begin
  delete from "spotlight_result_states"
  where "season_id" = old."id";

  delete from "spotlight_result_snapshots"
  where "season_id" = old."id";

  return old;
end;
$$;--> statement-breakpoint
CREATE TRIGGER "seasons_spotlight_results_delete_trigger"
before delete
on "seasons"
for each row
execute function "cascade_spotlight_results_for_deleted_season"();--> statement-breakpoint
CREATE TRIGGER "spotlight_result_items_delete_trigger"
before delete
on "spotlight_result_items"
for each row
execute function "protect_referenced_spotlight_result_fact_delete"();--> statement-breakpoint
CREATE FUNCTION "enforce_spotlight_result_alias_season"()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from "players"
    where "players"."id" = new."player_id"
      and "players"."season_id" = new."season_id"
  ) then
    raise exception 'Spotlight result aliases must reference a player in the same season.'
      using errcode = '23514', constraint = 'spotlight_result_aliases_player_season_check';
  end if;
  return new;
end;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "spotlight_result_aliases_season_trigger"
after insert or update
on "spotlight_result_aliases"
deferrable initially deferred
for each row
execute function "enforce_spotlight_result_alias_season"();--> statement-breakpoint
CREATE FUNCTION "enforce_spotlight_result_item_subject"()
returns trigger
language plpgsql
as $$
declare
  snapshot_dataset varchar(32);
  snapshot_season_id uuid;
begin
  select "dataset", "season_id"
  into snapshot_dataset, snapshot_season_id
  from "spotlight_result_snapshots"
  where "id" = new."snapshot_id";

  if snapshot_dataset is null then
    raise exception 'Unknown spotlight result snapshot.'
      using errcode = '23503', constraint = 'spotlight_result_items_snapshot_id_spotlight_result_snapshots_id_fk';
  end if;

  if snapshot_dataset = 'clean_sheets' then
    if new."team_id" is null or new."player_id" is not null or not exists (
      select 1 from "teams"
      where "teams"."id" = new."team_id"
        and "teams"."season_id" = snapshot_season_id
    ) then
      raise exception 'Clean-sheet results must reference a club in the snapshot season.'
        using errcode = '23514', constraint = 'spotlight_result_items_team_season_check';
    end if;
  else
    if new."player_id" is null or new."team_id" is not null or not exists (
      select 1 from "players"
      where "players"."id" = new."player_id"
        and "players"."season_id" = snapshot_season_id
    ) then
      raise exception 'Player results must reference a player in the snapshot season.'
        using errcode = '23514', constraint = 'spotlight_result_items_player_season_check';
    end if;
  end if;

  if snapshot_dataset = 'player_ratings' then
    if new."metric_value" > 10 then
      raise exception 'Player ratings must be between 0 and 10.'
        using errcode = '23514', constraint = 'spotlight_result_items_rating_check';
    end if;
  elsif new."metric_value" <> trunc(new."metric_value") then
    raise exception 'Count result metrics must be whole numbers.'
      using errcode = '23514', constraint = 'spotlight_result_items_count_check';
  end if;

  return new;
end;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "spotlight_result_items_subject_trigger"
after insert or update
on "spotlight_result_items"
deferrable initially deferred
for each row
execute function "enforce_spotlight_result_item_subject"();--> statement-breakpoint
CREATE FUNCTION "enforce_spotlight_result_state_pointers"()
returns trigger
language plpgsql
as $$
declare
  pointer_id uuid;
begin
  foreach pointer_id in array array[
    new."working_snapshot_id",
    new."active_snapshot_id",
    new."final_snapshot_id"
  ] loop
    if pointer_id is not null and not exists (
      select 1
      from "spotlight_result_snapshots"
      where "spotlight_result_snapshots"."id" = pointer_id
        and "spotlight_result_snapshots"."season_id" = new."season_id"
        and "spotlight_result_snapshots"."dataset" = new."dataset"
        and "spotlight_result_snapshots"."sealed_at" is not null
    ) then
      raise exception 'Spotlight result state pointers must target the same season and dataset.'
        using errcode = '23514', constraint = 'spotlight_result_states_pointer_scope_check';
    end if;
  end loop;
  return new;
end;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "spotlight_result_states_pointer_trigger"
after insert or update
on "spotlight_result_states"
deferrable initially deferred
for each row
execute function "enforce_spotlight_result_state_pointers"();--> statement-breakpoint
INSERT INTO "spotlight_result_states" ("season_id", "dataset")
select "seasons"."id", datasets."dataset"
from "seasons"
cross join (
  values
    ('goals'),
    ('assists'),
    ('clean_sheets'),
    ('player_ratings')
) as datasets("dataset")
on conflict do nothing;
