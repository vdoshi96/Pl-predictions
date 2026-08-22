ALTER TABLE "seasons" ADD CONSTRAINT "seasons_final_active_snapshot_check" CHECK ("seasons"."final_snapshot_id" is null or "seasons"."final_snapshot_id" = "seasons"."active_snapshot_id");--> statement-breakpoint
CREATE FUNCTION "plp_enforce_prediction_item_season"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if not exists (
    select 1
    from "predictions"
    inner join "teams" on "teams"."id" = new."team_id"
    where "predictions"."id" = new."prediction_id"
      and "predictions"."season_id" = "teams"."season_id"
  ) then
    raise exception 'A predicted club must belong to the prediction season.'
      using errcode = '23514', constraint = 'prediction_items_team_season_check';
  end if;
  return new;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "prediction_items_team_season_trigger"
before insert or update of "prediction_id", "team_id"
on "prediction_items"
for each row
execute function "plp_enforce_prediction_item_season"();--> statement-breakpoint
CREATE FUNCTION "plp_enforce_standings_snapshot_update"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new."is_final" is distinct from old."is_final"
    and (to_jsonb(new) - 'is_final') = (to_jsonb(old) - 'is_final') then
    return new;
  end if;

  raise exception 'Standings snapshots are immutable except for the final marker.'
    using errcode = '23514', constraint = 'standings_snapshots_immutable';
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "standings_snapshots_immutable_trigger"
before update
on "standings_snapshots"
for each row
execute function "plp_enforce_standings_snapshot_update"();--> statement-breakpoint
CREATE FUNCTION "plp_prevent_standings_item_update"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  raise exception 'Standings items are immutable.'
    using errcode = '23514', constraint = 'standings_items_immutable';
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "standings_items_immutable_trigger"
before update
on "standings_items"
for each row
execute function "plp_prevent_standings_item_update"();--> statement-breakpoint
CREATE FUNCTION "plp_protect_standings_snapshot_delete"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if pg_trigger_depth() <= 1
    and (
      exists (
        select 1 from "seasons"
        where "active_snapshot_id" = old."id"
          or "final_snapshot_id" = old."id"
      )
      or exists (
        select 1 from "standings_import_runs"
        where "snapshot_id" = old."id"
      )
    ) then
    raise exception 'Standings snapshots and items cannot be deleted.'
      using errcode = '23514', constraint = 'standings_facts_referenced_delete_check';
  end if;
  return old;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "standings_snapshots_delete_trigger"
before delete
on "standings_snapshots"
for each row
execute function "plp_protect_standings_snapshot_delete"();--> statement-breakpoint
CREATE FUNCTION "plp_protect_standings_item_delete"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if pg_trigger_depth() <= 1
    and (
      exists (
        select 1 from "seasons"
        where "active_snapshot_id" = old."snapshot_id"
          or "final_snapshot_id" = old."snapshot_id"
      )
      or exists (
        select 1 from "standings_import_runs"
        where "snapshot_id" = old."snapshot_id"
      )
    ) then
    raise exception 'Standings snapshots and items cannot be deleted.'
      using errcode = '23514', constraint = 'standings_facts_referenced_delete_check';
  end if;
  return old;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "standings_items_delete_trigger"
before delete
on "standings_items"
for each row
execute function "plp_protect_standings_item_delete"();--> statement-breakpoint
CREATE FUNCTION "plp_cascade_standings_for_deleted_season"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  delete from "standings_snapshots" where "season_id" = old."id";
  return old;
end;
$function$;--> statement-breakpoint
CREATE TRIGGER "seasons_standings_delete_trigger"
before delete
on "seasons"
for each row
execute function "plp_cascade_standings_for_deleted_season"();
