CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid,
	"slug" varchar(96) NOT NULL,
	"external_id" integer,
	"first_name" varchar(80),
	"last_name" varchar(80),
	"display_name" varchar(120) NOT NULL,
	"sort_name" varchar(120) NOT NULL,
	"asset_path" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_slug_check" CHECK ("players"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "players_external_id_check" CHECK ("players"."external_id" is null or "players"."external_id" > 0),
	CONSTRAINT "players_asset_path_check" CHECK ("players"."asset_path" is null or "players"."asset_path" like '/player-faces/%')
);
--> statement-breakpoint
CREATE TABLE "prediction_category_picks" (
	"prediction_id" uuid NOT NULL,
	"category" varchar(32) NOT NULL,
	"player_id" uuid,
	"team_id" uuid,
	"custom_player_name" varchar(120),
	"normalized_custom_player_name" varchar(120),
	CONSTRAINT "prediction_category_picks_prediction_category_pk" PRIMARY KEY("prediction_id","category"),
	CONSTRAINT "prediction_category_picks_category_check" CHECK ("prediction_category_picks"."category" in ('top_scorer', 'top_assister', 'most_clean_sheets', 'underdog_team', 'overrated_team', 'underdog_player', 'overrated_player')),
	CONSTRAINT "prediction_category_picks_subject_check" CHECK ((
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
            and char_length("prediction_category_picks"."custom_player_name") between 2 and 120
            and char_length("prediction_category_picks"."normalized_custom_player_name") between 2 and 120
          )
        )
      ))
);
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_category_picks" ADD CONSTRAINT "prediction_category_picks_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_category_picks" ADD CONSTRAINT "prediction_category_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_category_picks" ADD CONSTRAINT "prediction_category_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_season_slug_unique" ON "players" USING btree ("season_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "players_season_external_id_unique" ON "players" USING btree ("season_id","external_id");--> statement-breakpoint
CREATE INDEX "players_season_sort_name_idx" ON "players" USING btree ("season_id","sort_name");--> statement-breakpoint
CREATE INDEX "players_team_id_idx" ON "players" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "prediction_category_picks_player_id_idx" ON "prediction_category_picks" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "prediction_category_picks_team_id_idx" ON "prediction_category_picks" USING btree ("team_id");
