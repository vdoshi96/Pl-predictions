ALTER TABLE "prediction_category_picks" DROP CONSTRAINT "prediction_category_picks_subject_check";--> statement-breakpoint
ALTER TABLE "prediction_category_picks" ADD CONSTRAINT "prediction_category_picks_subject_check" CHECK ((
        "prediction_category_picks"."category" in ('most_clean_sheets', 'underdog_team', 'overrated_team')
        and "prediction_category_picks"."team_id" is not null
        and "prediction_category_picks"."player_id" is null
        and "prediction_category_picks"."custom_player_name" is null
        and "prediction_category_picks"."normalized_custom_player_name" is null
      ) or (
        "prediction_category_picks"."category" in ('top_scorer', 'top_assister', 'underdog_player', 'overrated_player')
        and "prediction_category_picks"."team_id" is null
        and (
          (
            "prediction_category_picks"."player_id" is not null
            and "prediction_category_picks"."custom_player_name" is null
            and "prediction_category_picks"."normalized_custom_player_name" is null
          ) or (
            "prediction_category_picks"."player_id" is null
            and "prediction_category_picks"."custom_player_name" is not null
            and "prediction_category_picks"."normalized_custom_player_name" is not null
            and char_length("prediction_category_picks"."custom_player_name") between 2 and 120
            and char_length("prediction_category_picks"."normalized_custom_player_name") between 2 and 120
          )
        )
      ));