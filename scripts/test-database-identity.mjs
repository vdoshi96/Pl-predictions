import { createHash } from "node:crypto";
import { isIP } from "node:net";

const DATABASE_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const IDENTITY_QUERY_PARAMETERS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
]);

function identityError(message) {
  throw new Error(message);
}

function configured(value) {
  const candidate = value?.trim();
  return candidate ? candidate : null;
}

export function canonicalizeDatabaseHost(hostname, label) {
  const normalized = hostname.toLowerCase().replace(/\.+$/u, "");
  if (!normalized || normalized.includes("%")) {
    identityError(`${label} contains an ambiguous PostgreSQL host.`);
  }

  const ipCandidate =
    normalized.startsWith("[") && normalized.endsWith("]")
      ? normalized.slice(1, -1)
      : normalized;
  if (
    /^(?:0x[0-9a-f]+|[0-9.]+)$/iu.test(ipCandidate) &&
    isIP(ipCandidate) === 0
  ) {
    identityError(`${label} contains an ambiguous PostgreSQL host.`);
  }

  return normalized;
}

export function parseDatabaseUrl(value, label) {
  const candidate = value?.trim();
  if (!candidate) {
    identityError(`${label} is required.`);
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    identityError(`${label} is not a valid URL.`);
  }

  if (!DATABASE_PROTOCOLS.has(url.protocol)) {
    identityError(`${label} must use the postgres or postgresql protocol.`);
  }
  if (!url.hostname || url.hostname.includes(",")) {
    identityError(`${label} must identify exactly one PostgreSQL host.`);
  }
  const canonicalHost = canonicalizeDatabaseHost(url.hostname, label);
  if (url.hash) {
    identityError(`${label} must not contain a URL fragment.`);
  }
  for (const key of url.searchParams.keys()) {
    if (IDENTITY_QUERY_PARAMETERS.has(key.toLowerCase())) {
      identityError(
        `${label} must not override database identity through query parameters.`,
      );
    }
  }

  const encodedDatabaseName = url.pathname.match(/^\/([^/]+)\/?$/u)?.[1];
  if (!encodedDatabaseName) {
    identityError(`${label} must identify a specific PostgreSQL database.`);
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(encodedDatabaseName);
  } catch {
    identityError(`${label} contains an ambiguous PostgreSQL database name.`);
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    databaseName.includes("\\") ||
    databaseName.includes("\0")
  ) {
    identityError(`${label} contains an ambiguous PostgreSQL database name.`);
  }

  return { canonicalHost, databaseName, url };
}

function normalizeDatabaseHost(hostname) {
  if (!hostname.endsWith(".neon.tech")) return hostname;

  const [endpoint, ...suffix] = hostname.split(".");
  return [endpoint?.replace(/-pooler$/u, ""), ...suffix].join(".");
}

export function databaseIdentity(parsed) {
  return [
    "postgresql:",
    normalizeDatabaseHost(parsed.canonicalHost),
    parsed.url.port || "5432",
    parsed.databaseName,
  ].join("|");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function databaseIdentitySha256(parsed) {
  return sha256(databaseIdentity(parsed));
}

export function createTestDatabaseAttestation(
  productionIdentitySha256,
  testIdentitySha256,
) {
  if (
    !/^[a-f0-9]{64}$/u.test(productionIdentitySha256) ||
    !/^[a-f0-9]{64}$/u.test(testIdentitySha256)
  ) {
    identityError("Database identity attestation inputs are invalid.");
  }
  return sha256(
    [
      "pl-predictions-test-database-attestation-v1",
      productionIdentitySha256,
      testIdentitySha256,
    ].join("\0"),
  );
}

export function assertIsolatedDatabaseEnvironment(environment, context) {
  const attestation = configured(
    environment.PL_PREDICTIONS_ISOLATED_TEST_DATABASE,
  );
  const productionIdentitySha256 = configured(
    environment.PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256,
  );
  if (!attestation || !productionIdentitySha256) {
    throw new Error(
      `${context} must run through scripts/run-with-test-database.mjs; wrapper-derived isolated-database attestation is missing.`,
    );
  }

  const databaseUrl = environment.DATABASE_URL;
  const testDatabaseUrl = environment.TEST_DATABASE_URL;
  if (
    !configured(databaseUrl) ||
    !configured(testDatabaseUrl) ||
    databaseUrl !== testDatabaseUrl
  ) {
    throw new Error(
      `${context} requires DATABASE_URL and TEST_DATABASE_URL to be the same wrapper-verified target.`,
    );
  }

  let testIdentitySha256;
  try {
    testIdentitySha256 = databaseIdentitySha256(
      parseDatabaseUrl(testDatabaseUrl, "TEST_DATABASE_URL"),
    );
  } catch {
    throw new Error(
      `${context} cannot verify the canonical TEST_DATABASE_URL identity.`,
    );
  }
  if (testIdentitySha256 === productionIdentitySha256) {
    throw new Error(
      `${context} test target matches the wrapper-carried production database identity.`,
    );
  }

  let expectedAttestation;
  try {
    expectedAttestation = createTestDatabaseAttestation(
      productionIdentitySha256,
      testIdentitySha256,
    );
  } catch {
    throw new Error(`${context} received an invalid database attestation.`);
  }
  if (attestation !== expectedAttestation) {
    throw new Error(
      `${context} database attestation does not match the canonical wrapper-verified target.`,
    );
  }
}
