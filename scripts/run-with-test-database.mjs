import { spawn } from "node:child_process";

import {
  canonicalizeDatabaseHost,
  createTestDatabaseAttestation,
  databaseIdentity,
  databaseIdentitySha256,
  parseDatabaseUrl as parseDatabaseUrlIdentity,
} from "./test-database-identity.mjs";

function fail(message) {
  console.error(`Test database safety check failed: ${message}`);
  process.exit(1);
}

function parseDatabaseUrl(value, label) {
  try {
    return parseDatabaseUrlIdentity(value, label);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : `${label} is not a valid URL.`,
    );
  }
}

function asDirectDatabaseUrl(url) {
  const direct = new URL(url);
  const canonicalHost = canonicalizeDatabaseHost(
    direct.hostname,
    "TEST_DATABASE_URL",
  );
  direct.hostname = canonicalHost;
  if (canonicalHost.endsWith(".neon.tech")) {
    const [endpoint, ...suffix] = canonicalHost.split(".");
    direct.hostname = [endpoint?.replace(/-pooler$/iu, ""), ...suffix].join(
      ".",
    );
  }
  return direct;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  fail("a command is required.");
}

const productionValue = process.env.DATABASE_URL;
if (!productionValue) {
  fail(
    "DATABASE_URL is required so production and test targets can be compared.",
  );
}
const production = parseDatabaseUrl(productionValue, "DATABASE_URL");
const productionTargets = [production];

if (process.env.DATABASE_URL_UNPOOLED?.trim()) {
  const productionUnpooled = parseDatabaseUrl(
    process.env.DATABASE_URL_UNPOOLED,
    "DATABASE_URL_UNPOOLED",
  );
  if (databaseIdentity(productionUnpooled) !== databaseIdentity(production)) {
    fail(
      "DATABASE_URL and DATABASE_URL_UNPOOLED do not resolve to the same logical database.",
    );
  }
  productionTargets.push(productionUnpooled);
}

let testValue = process.env.TEST_DATABASE_URL?.trim();
const configuredTestDatabaseName = process.env.TEST_DATABASE_NAME?.trim();
if (testValue && configuredTestDatabaseName) {
  fail("set either TEST_DATABASE_URL or TEST_DATABASE_NAME, not both.");
}
if (!testValue) {
  const testDatabaseName = configuredTestDatabaseName;
  if (!testDatabaseName || !/^[a-z][a-z0-9_]{0,62}$/u.test(testDatabaseName)) {
    fail(
      "set TEST_DATABASE_URL, or a safe TEST_DATABASE_NAME for local URL derivation.",
    );
  }

  const derived = new URL(production.url);
  derived.pathname = `/${testDatabaseName}`;
  testValue = derived.toString();
}

const test = parseDatabaseUrl(testValue, "TEST_DATABASE_URL");
if (
  productionTargets.some(
    (productionTarget) =>
      databaseIdentity(test) === databaseIdentity(productionTarget),
  )
) {
  fail("TEST_DATABASE_URL resolves to the production database.");
}
if (
  productionTargets.some(
    (productionTarget) => test.databaseName === productionTarget.databaseName,
  )
) {
  fail(
    "TEST_DATABASE_URL must use a database name distinct from every production database URL.",
  );
}

const testUrl = test.url.toString();
const productionIdentitySha256 = databaseIdentitySha256(production);
const testIdentitySha256 = databaseIdentitySha256(test);
const childEnvironment = {
  ...process.env,
  DATABASE_URL: testUrl,
  PL_PREDICTIONS_ISOLATED_TEST_DATABASE: createTestDatabaseAttestation(
    productionIdentitySha256,
    testIdentitySha256,
  ),
  PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256: productionIdentitySha256,
  PL_PREDICTIONS_TEST_NOW_ISO:
    process.env.PL_PREDICTIONS_TEST_NOW_ISO?.trim() ||
    "2026-08-08T12:00:00.000Z",
  TEST_DATABASE_URL: testUrl,
  PGDATABASE: test.databaseName,
  POSTGRES_DATABASE: test.databaseName,
};

if (process.env.DATABASE_URL_UNPOOLED?.trim()) {
  childEnvironment.DATABASE_URL_UNPOOLED = asDirectDatabaseUrl(
    test.url,
  ).toString();
}

const child = spawn(command, args, {
  env: childEnvironment,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start ${command}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`${command} exited after signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
