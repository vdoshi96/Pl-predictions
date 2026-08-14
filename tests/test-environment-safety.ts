import { assertIsolatedDatabaseEnvironment } from "../scripts/test-database-identity.mjs";

export { assertIsolatedDatabaseEnvironment };

export const READ_ONLY_REMOTE_SMOKE_MARKER = "ALLOW_PRODUCTION_READ_ONLY_SMOKE";

type SafetyEnvironment = Readonly<Record<string, string | undefined>>;

export type PlaywrightExecutionMode =
  "isolated" | "remote-read-only" | "remote-write";

function configured(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate ? candidate : null;
}

export function resolvePlaywrightExecutionMode(
  environment: SafetyEnvironment,
): PlaywrightExecutionMode {
  const baseUrl = configured(environment.PLAYWRIGHT_BASE_URL);
  const isolated = Boolean(
    configured(environment.PL_PREDICTIONS_ISOLATED_TEST_DATABASE) ||
    configured(environment.PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256),
  );
  const readOnlyRemote = environment.ALLOW_PRODUCTION_READ_ONLY_SMOKE === "1";
  const writeRemote = environment.ALLOW_PRODUCTION_WRITE_SMOKE === "1";

  if (readOnlyRemote && writeRemote) {
    throw new Error(
      "Playwright remote mode is ambiguous; enable either read-only smoke or write smoke, not both.",
    );
  }

  if (isolated) {
    if (baseUrl || readOnlyRemote || writeRemote) {
      throw new Error(
        "Wrapper-attested local Playwright cannot also configure a remote base URL or smoke marker.",
      );
    }
    assertIsolatedDatabaseEnvironment(environment, "Local Playwright");
    return "isolated";
  }

  if (!baseUrl) {
    if (readOnlyRemote || writeRemote) {
      throw new Error(
        "A remote Playwright smoke marker requires PLAYWRIGHT_BASE_URL.",
      );
    }
    throw new Error(
      "Local Playwright must run through scripts/run-with-test-database.mjs; verified isolated-database attestation is missing.",
    );
  }

  if (readOnlyRemote) return "remote-read-only";
  if (writeRemote) return "remote-write";
  throw new Error(
    `Remote Playwright requires ${READ_ONLY_REMOTE_SMOKE_MARKER}=1 for the read-only smoke or the separately gated ALLOW_PRODUCTION_WRITE_SMOKE=1 path.`,
  );
}
