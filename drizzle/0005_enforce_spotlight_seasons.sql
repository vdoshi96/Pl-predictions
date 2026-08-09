create function "plp_enforce_player_team_season"()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new."team_id" is not null and not exists (
    select 1
    from "teams"
    where "teams"."id" = new."team_id"
      and "teams"."season_id" = new."season_id"
  ) then
    raise exception 'A player team must belong to the same season.'
      using errcode = '23514', constraint = 'players_team_season_check';
  end if;

  return new;
end;
$function$;
--> statement-breakpoint
create trigger "players_team_season_trigger"
before insert or update of "season_id", "team_id"
on "players"
for each row
execute function "plp_enforce_player_team_season"();
--> statement-breakpoint
create function "plp_enforce_prediction_pick_season"()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  prediction_season_id uuid;
begin
  select "season_id"
  into prediction_season_id
  from "predictions"
  where "id" = new."prediction_id";

  if prediction_season_id is null then
    raise exception 'A spotlight pick requires an existing prediction.'
      using errcode = '23503', constraint = 'prediction_category_picks_prediction_id_predictions_id_fk';
  end if;

  if new."team_id" is not null and not exists (
    select 1
    from "teams"
    where "teams"."id" = new."team_id"
      and "teams"."season_id" = prediction_season_id
  ) then
    raise exception 'A spotlight club must belong to the prediction season.'
      using errcode = '23514', constraint = 'prediction_category_picks_team_season_check';
  end if;

  if new."player_id" is not null and not exists (
    select 1
    from "players"
    where "players"."id" = new."player_id"
      and "players"."season_id" = prediction_season_id
  ) then
    raise exception 'A spotlight player must belong to the prediction season.'
      using errcode = '23514', constraint = 'prediction_category_picks_player_season_check';
  end if;

  return new;
end;
$function$;
--> statement-breakpoint
create trigger "prediction_category_picks_season_trigger"
before insert or update of "prediction_id", "player_id", "team_id"
on "prediction_category_picks"
for each row
execute function "plp_enforce_prediction_pick_season"();
