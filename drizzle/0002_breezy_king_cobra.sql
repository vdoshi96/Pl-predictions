ALTER TABLE "seasons" ADD COLUMN "opening_kickoff" timestamp with time zone;
--> statement-breakpoint
UPDATE "seasons"
SET
	"opening_kickoff" = '2026-08-21T19:00:00.000Z'::timestamptz,
	"submission_deadline" = CASE
		WHEN "submission_deadline" IS NULL THEN NULL
		ELSE LEAST(
			"submission_deadline",
			'2026-08-21T19:00:00.000Z'::timestamptz
		)
	END
WHERE "slug" = '2026-27';
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "seasons" WHERE "opening_kickoff" IS NULL) THEN
		RAISE EXCEPTION 'Every existing season needs a reviewed opening_kickoff before migration 0002 can finish.';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "opening_kickoff" SET NOT NULL;
