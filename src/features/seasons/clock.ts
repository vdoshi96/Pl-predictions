import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { assertIsolatedDatabaseEnvironment } from "../../../scripts/test-database-identity.mjs";

type ClockEnvironment = {
  DATABASE_URL?: string;
  LOCAL_HTTP_E2E?: string;
  NODE_ENV?: string;
  PL_PREDICTIONS_ISOLATED_TEST_DATABASE?: string;
  PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256?: string;
  PL_PREDICTIONS_TEST_NOW_ISO?: string;
  TEST_DATABASE_URL?: string;
};

function hasVerifiedIsolatedDatabase(environment: ClockEnvironment): boolean {
  try {
    assertIsolatedDatabaseEnvironment(environment, "Isolated test clock");
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a fixed clock only when the fail-closed test-database wrapper has
 * verified that DATABASE_URL points at the isolated test target. Production
 * always uses PostgreSQL's live wall clock unless the explicit local HTTP E2E
 * harness flag accompanies that isolated-database attestation.
 */
export function resolveIsolatedTestNow(
  environment: ClockEnvironment = process.env,
): Date | null {
  if (
    (environment.NODE_ENV === "production" &&
      environment.LOCAL_HTTP_E2E !== "1") ||
    !environment.PL_PREDICTIONS_ISOLATED_TEST_DATABASE?.trim() ||
    !hasVerifiedIsolatedDatabase(environment)
  ) {
    return null;
  }

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
