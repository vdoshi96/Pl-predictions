CREATE TABLE "spotlight_result_snapshot_aliases" (
	"snapshot_id" uuid NOT NULL,
	"normalized_custom_player_name" varchar(120) NOT NULL,
	"custom_player_name" varchar(120) NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "spotlight_result_snapshot_aliases_snapshot_name_pk" PRIMARY KEY("snapshot_id","normalized_custom_player_name"),
	CONSTRAINT "spotlight_result_snapshot_aliases_name_check" CHECK (char_length("spotlight_result_snapshot_aliases"."custom_player_name") between 2 and 120
        and char_length("spotlight_result_snapshot_aliases"."normalized_custom_player_name") between 2 and 120)
);
--> statement-breakpoint
ALTER TABLE "spotlight_result_snapshot_aliases" ADD CONSTRAINT "spotlight_result_snapshot_aliases_snapshot_id_spotlight_result_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."spotlight_result_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_result_snapshot_aliases" ADD CONSTRAINT "spotlight_result_snapshot_aliases_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spotlight_result_snapshot_aliases_player_idx" ON "spotlight_result_snapshot_aliases" USING btree ("player_id");--> statement-breakpoint
CREATE FUNCTION "enforce_spotlight_result_snapshot_alias_season"()
returns trigger
language plpgsql
as $$
declare
  snapshot_season_id uuid;
begin
  select "season_id"
  into snapshot_season_id
  from "spotlight_result_snapshots"
  where "id" = new."snapshot_id";

  if snapshot_season_id is null or not exists (
    select 1
    from "players"
    where "id" = new."player_id"
      and "season_id" = snapshot_season_id
  ) then
    raise exception 'Snapshot aliases must reference a player in the snapshot season.'
      using errcode = '23514', constraint = 'spotlight_result_snapshot_aliases_player_season_check';
  end if;
  return new;
end;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "spotlight_result_snapshot_aliases_season_trigger"
after insert or update
on "spotlight_result_snapshot_aliases"
deferrable initially deferred
for each row
execute function "enforce_spotlight_result_snapshot_alias_season"();--> statement-breakpoint
CREATE TRIGGER "spotlight_result_snapshot_aliases_immutable_trigger"
before update
on "spotlight_result_snapshot_aliases"
for each row
execute function "prevent_spotlight_result_fact_update"();--> statement-breakpoint
CREATE TRIGGER "spotlight_result_snapshot_aliases_append_trigger"
before insert
on "spotlight_result_snapshot_aliases"
for each row
execute function "require_open_spotlight_result_snapshot_for_insert"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_referenced_spotlight_result_fact_delete"()
returns trigger
language plpgsql
as $$
declare
  protected_snapshot_id uuid;
  snapshot_season_id uuid;
begin
  if tg_table_name in ('spotlight_result_items', 'spotlight_result_snapshot_aliases') then
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
    raise exception 'Spotlight result snapshots and facts cannot be deleted.'
      using errcode = '23514', constraint = 'spotlight_result_facts_referenced_delete_check';
  end if;
  return old;
end;
$$;--> statement-breakpoint
CREATE TRIGGER "spotlight_result_snapshot_aliases_delete_trigger"
before delete
on "spotlight_result_snapshot_aliases"
for each row
execute function "protect_referenced_spotlight_result_fact_delete"();
