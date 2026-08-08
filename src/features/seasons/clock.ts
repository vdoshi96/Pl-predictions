import "server-only";

import { sql, type SQL } from "drizzle-orm";

const ISOLATED_TEST_MARKER = "verified-isolated-test-database";

type ClockEnvironment = {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  PL_PREDICTIONS_ISOLATED_TEST_DATABASE?: string;
  PL_PREDICTIONS_TEST_NOW_ISO?: string;
  TEST_DATABASE_URL?: string;
};

function databaseIdentity(value: string): string | null {
  try {
    const url = new URL(value);
    if (!url.hostname || !url.pathname || url.pathname === "/") return null;

    return [
      url.protocol,
      url.username,
      url.hostname.toLowerCase(),
      url.port,
      url.pathname.replace(/\/+$/u, ""),
    ].join("|");
  } catch {
    return null;
  }
}

/**
 * Returns a fixed clock only when the fail-closed test-database wrapper has
 * verified that DATABASE_URL points at the isolated test target. Production
 * always uses PostgreSQL's live wall clock, even if test variables are set.
 */
export function resolveIsolatedTestNow(
  environment: ClockEnvironment = process.env,
): Date | null {
  if (
    environment.NODE_ENV === "production" ||
    environment.PL_PREDICTIONS_ISOLATED_TEST_DATABASE !== ISOLATED_TEST_MARKER
  ) {
    return null;
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  const testDatabaseUrl = environment.TEST_DATABASE_URL?.trim();
  if (!databaseUrl || !testDatabaseUrl) return null;

  const database = databaseIdentity(databaseUrl);
  const testDatabase = databaseIdentity(testDatabaseUrl);
  if (!database || database !== testDatabase) return null;

  const value = environment.PL_PREDICTIONS_TEST_NOW_ISO?.trim();
  if (!value) return null;

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("PL_PREDICTIONS_TEST_NOW_ISO must be a valid ISO time.");
  }

  return instant;
}

export function authoritativeDatabaseTimeSql(): SQL<Date> {
  const isolatedTestNow = resolveIsolatedTestNow();
  return isolatedTestNow
    ? sql<Date>`${isolatedTestNow}::timestamptz`
    : sql<Date>`clock_timestamp()`;
}
