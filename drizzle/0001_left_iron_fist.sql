ALTER TABLE "seasons" ADD COLUMN "standings_accepted_through" timestamp with time zone;
--> statement-breakpoint
UPDATE "seasons"
SET "standings_accepted_through" = "standings_snapshots"."captured_at"
FROM "standings_snapshots"
WHERE "seasons"."active_snapshot_id" = "standings_snapshots"."id";
