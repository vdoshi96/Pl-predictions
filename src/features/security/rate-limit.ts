import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";

type HeaderReader = Pick<Headers, "get">;

export type SecurityRateLimitScope = "admin_login" | "standings_ingest";

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim();
  return first || null;
}

function sourceAddress(requestHeaders: HeaderReader): string {
  return (
    firstForwardedValue(requestHeaders.get("x-vercel-forwarded-for")) ??
    firstForwardedValue(requestHeaders.get("x-forwarded-for")) ??
    requestHeaders.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

function rateLimitKeyHash(requestHeaders: HeaderReader): string {
  return createHash("sha256")
    .update(sourceAddress(requestHeaders), "utf8")
    .digest("hex");
}

export async function reserveSecurityAttempt({
  blockSeconds,
  limit,
  requestHeaders,
  scope,
  windowSeconds,
}: {
  blockSeconds: number;
  limit: number;
  requestHeaders: HeaderReader;
  scope: SecurityRateLimitScope;
  windowSeconds: number;
}): Promise<{ allowed: boolean; keyHash: string }> {
  const keyHash = rateLimitKeyHash(requestHeaders);
  const result = await getDb().execute<{ allowed: boolean }>(sql`
    insert into "security_rate_limits" (
      "scope",
      "key_hash",
      "window_started_at",
      "attempt_count",
      "blocked_until",
      "updated_at"
    ) values (
      ${scope},
      ${keyHash},
      clock_timestamp(),
      1,
      null,
      clock_timestamp()
    )
    on conflict ("scope", "key_hash") do update
    set
      "window_started_at" = case
        when "security_rate_limits"."blocked_until" > clock_timestamp()
          then "security_rate_limits"."window_started_at"
        when "security_rate_limits"."window_started_at" <= clock_timestamp() - (${windowSeconds} * interval '1 second')
          then clock_timestamp()
        else "security_rate_limits"."window_started_at"
      end,
      "attempt_count" = case
        when "security_rate_limits"."blocked_until" > clock_timestamp()
          then "security_rate_limits"."attempt_count"
        when "security_rate_limits"."window_started_at" <= clock_timestamp() - (${windowSeconds} * interval '1 second')
          then 1
        else least(32767, "security_rate_limits"."attempt_count" + 1)
      end,
      "blocked_until" = case
        when "security_rate_limits"."blocked_until" > clock_timestamp()
          then "security_rate_limits"."blocked_until"
        when "security_rate_limits"."window_started_at" <= clock_timestamp() - (${windowSeconds} * interval '1 second')
          then null
        when "security_rate_limits"."attempt_count" + 1 > ${limit}
          then clock_timestamp() + (${blockSeconds} * interval '1 second')
        else null
      end,
      "updated_at" = clock_timestamp()
    returning (
      "attempt_count" <= ${limit}
      and ("blocked_until" is null or "blocked_until" <= clock_timestamp())
    ) as "allowed"
  `);

  return { allowed: result.rows[0]?.allowed === true, keyHash };
}

export async function clearSecurityRateLimit(
  scope: SecurityRateLimitScope,
  keyHash: string,
): Promise<void> {
  await getDb().execute(sql`
    delete from "security_rate_limits"
    where "scope" = ${scope}
      and "key_hash" = ${keyHash}
  `);
}
