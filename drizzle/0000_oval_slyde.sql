CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"actor" varchar(64) NOT NULL,
	"action" varchar(96) NOT NULL,
	"target_type" varchar(64),
	"target_id" varchar(128),
	"request_id" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_items" (
	"prediction_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"predicted_position" smallint NOT NULL,
	CONSTRAINT "prediction_items_prediction_team_pk" PRIMARY KEY("prediction_id","team_id"),
	CONSTRAINT "prediction_items_position_check" CHECK ("prediction_items"."predicted_position" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"participant_name" varchar(40) NOT NULL,
	"normalized_participant_name" varchar(40) NOT NULL,
	"receipt_token_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predictions_participant_name_length_check" CHECK (char_length("predictions"."participant_name") between 2 and 40),
	CONSTRAINT "predictions_normalized_name_length_check" CHECK (char_length("predictions"."normalized_participant_name") between 2 and 40),
	CONSTRAINT "predictions_receipt_hash_check" CHECK ("predictions"."receipt_token_hash" is null or char_length("predictions"."receipt_token_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"competition_code" varchar(16) NOT NULL,
	"start_year" integer NOT NULL,
	"submission_deadline" timestamp with time zone,
	"submissions_locked" boolean DEFAULT false NOT NULL,
	"reveal_predictions" boolean DEFAULT false NOT NULL,
	"active_snapshot_id" uuid,
	"final_snapshot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_start_year_check" CHECK ("seasons"."start_year" between 1992 and 2200),
	CONSTRAINT "seasons_slug_check" CHECK ("seasons"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "standings_import_run_items" (
	"run_id" uuid NOT NULL,
	"ordinal" smallint NOT NULL,
	"team_key" varchar(64) NOT NULL,
	"team_id" uuid NOT NULL,
	"actual_position" smallint NOT NULL,
	"played_games" smallint,
	"league_points" smallint,
	CONSTRAINT "standings_import_run_items_run_ordinal_pk" PRIMARY KEY("run_id","ordinal"),
	CONSTRAINT "standings_import_run_items_ordinal_check" CHECK ("standings_import_run_items"."ordinal" between 1 and 20),
	CONSTRAINT "standings_import_run_items_position_check" CHECK ("standings_import_run_items"."actual_position" between 1 and 20),
	CONSTRAINT "standings_import_run_items_played_games_check" CHECK ("standings_import_run_items"."played_games" is null or "standings_import_run_items"."played_games" between 0 and 38),
	CONSTRAINT "standings_import_run_items_league_points_check" CHECK ("standings_import_run_items"."league_points" is null or "standings_import_run_items"."league_points" between -100 and 114)
);
--> statement-breakpoint
CREATE TABLE "standings_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"source" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"captured_at" timestamp with time zone,
	"content_hash" varchar(64),
	"snapshot_id" uuid,
	"item_count" smallint DEFAULT 0 NOT NULL,
	"error_code" varchar(64),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "standings_import_runs_status_check" CHECK ("standings_import_runs"."status" in ('received', 'succeeded', 'rejected', 'duplicate', 'failed')),
	CONSTRAINT "standings_import_runs_item_count_check" CHECK ("standings_import_runs"."item_count" between 0 and 20),
	CONSTRAINT "standings_import_runs_content_hash_check" CHECK ("standings_import_runs"."content_hash" is null or char_length("standings_import_runs"."content_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "standings_items" (
	"snapshot_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"actual_position" smallint NOT NULL,
	"played_games" smallint,
	"league_points" smallint,
	CONSTRAINT "standings_items_snapshot_team_pk" PRIMARY KEY("snapshot_id","team_id"),
	CONSTRAINT "standings_items_position_check" CHECK ("standings_items"."actual_position" between 1 and 20),
	CONSTRAINT "standings_items_played_games_check" CHECK ("standings_items"."played_games" is null or "standings_items"."played_games" between 0 and 38),
	CONSTRAINT "standings_items_league_points_check" CHECK ("standings_items"."league_points" is null or "standings_items"."league_points" between -100 and 114)
);
--> statement-breakpoint
CREATE TABLE "standings_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"source" varchar(64) NOT NULL,
	"source_reference" text,
	"captured_at" timestamp with time zone NOT NULL,
	"source_updated_at" timestamp with time zone,
	"matchweek" smallint,
	"is_final" boolean DEFAULT false NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standings_snapshots_matchweek_check" CHECK ("standings_snapshots"."matchweek" is null or "standings_snapshots"."matchweek" between 1 and 38),
	CONSTRAINT "standings_snapshots_content_hash_check" CHECK (char_length("standings_snapshots"."content_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"slug" varchar(64) NOT NULL,
	"external_id" integer,
	"display_name" varchar(80) NOT NULL,
	"short_name" varchar(40) NOT NULL,
	"sort_name" varchar(80) NOT NULL,
	"crest_url" text,
	"asset_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_check" CHECK ("teams"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "teams_external_id_check" CHECK ("teams"."external_id" is null or "teams"."external_id" > 0),
	CONSTRAINT "teams_asset_path_check" CHECK ("teams"."asset_path" like '/%')
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_items" ADD CONSTRAINT "prediction_items_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_items" ADD CONSTRAINT "prediction_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_active_snapshot_id_standings_snapshots_id_fk" FOREIGN KEY ("active_snapshot_id") REFERENCES "public"."standings_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_final_snapshot_id_standings_snapshots_id_fk" FOREIGN KEY ("final_snapshot_id") REFERENCES "public"."standings_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_import_run_items" ADD CONSTRAINT "standings_import_run_items_run_id_standings_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."standings_import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_import_run_items" ADD CONSTRAINT "standings_import_run_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_import_runs" ADD CONSTRAINT "standings_import_runs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_import_runs" ADD CONSTRAINT "standings_import_runs_snapshot_id_standings_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."standings_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_items" ADD CONSTRAINT "standings_items_snapshot_id_standings_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."standings_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_items" ADD CONSTRAINT "standings_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_snapshots" ADD CONSTRAINT "standings_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_season_created_at_idx" ON "admin_audit_logs" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_request_id_idx" ON "admin_audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_items_prediction_position_unique" ON "prediction_items" USING btree ("prediction_id","predicted_position");--> statement-breakpoint
CREATE INDEX "prediction_items_team_id_idx" ON "prediction_items" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_season_normalized_name_unique" ON "predictions" USING btree ("season_id","normalized_participant_name");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_receipt_token_hash_unique" ON "predictions" USING btree ("receipt_token_hash");--> statement-breakpoint
CREATE INDEX "predictions_season_created_at_idx" ON "predictions" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_slug_unique" ON "seasons" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "standings_import_run_items_run_team_unique" ON "standings_import_run_items" USING btree ("run_id","team_key");--> statement-breakpoint
CREATE UNIQUE INDEX "standings_import_run_items_run_position_unique" ON "standings_import_run_items" USING btree ("run_id","actual_position");--> statement-breakpoint
CREATE INDEX "standings_import_run_items_team_id_idx" ON "standings_import_run_items" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "standings_import_runs_season_created_at_idx" ON "standings_import_runs" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE INDEX "standings_import_runs_status_idx" ON "standings_import_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "standings_import_runs_snapshot_id_idx" ON "standings_import_runs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standings_items_snapshot_position_unique" ON "standings_items" USING btree ("snapshot_id","actual_position");--> statement-breakpoint
CREATE INDEX "standings_items_team_id_idx" ON "standings_items" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standings_snapshots_season_content_hash_unique" ON "standings_snapshots" USING btree ("season_id","content_hash");--> statement-breakpoint
CREATE INDEX "standings_snapshots_season_captured_at_idx" ON "standings_snapshots" USING btree ("season_id","captured_at");--> statement-breakpoint
CREATE INDEX "standings_snapshots_season_final_idx" ON "standings_snapshots" USING btree ("season_id","is_final");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_season_slug_unique" ON "teams" USING btree ("season_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_season_external_id_unique" ON "teams" USING btree ("season_id","external_id");--> statement-breakpoint
CREATE INDEX "teams_season_sort_name_idx" ON "teams" USING btree ("season_id","sort_name");