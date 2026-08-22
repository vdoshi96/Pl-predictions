CREATE TABLE "admin_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_id_check" CHECK (char_length("admin_sessions"."id") = 64)
);
--> statement-breakpoint
CREATE TABLE "security_rate_limits" (
	"scope" varchar(32) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_rate_limits_scope_key_pk" PRIMARY KEY("scope","key_hash"),
	CONSTRAINT "security_rate_limits_scope_check" CHECK ("security_rate_limits"."scope" in ('admin_login', 'standings_ingest')),
	CONSTRAINT "security_rate_limits_key_hash_check" CHECK (char_length("security_rate_limits"."key_hash") = 64),
	CONSTRAINT "security_rate_limits_attempt_count_check" CHECK ("security_rate_limits"."attempt_count" between 0 and 32767)
);
--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "security_rate_limits_updated_at_idx" ON "security_rate_limits" USING btree ("updated_at");