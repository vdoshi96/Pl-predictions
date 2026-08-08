import { spawn } from "node:child_process";

function fail(message) {
  console.error(`Test database safety check failed: ${message}`);
  process.exit(1);
}

function parseDatabaseUrl(value, label) {
  try {
    const url = new URL(value);
    if (!url.hostname || !url.pathname || url.pathname === "/") {
      return fail(`${label} must identify a specific PostgreSQL database.`);
    }
    return url;
  } catch {
    return fail(`${label} is not a valid URL.`);
  }
}

function databaseIdentity(url) {
  return [
    url.protocol,
    url.username,
    url.hostname.toLowerCase(),
    url.port,
    url.pathname.replace(/\/+$/u, ""),
  ].join("|");
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
const productionUrl = parseDatabaseUrl(productionValue, "DATABASE_URL");

let testValue = process.env.TEST_DATABASE_URL?.trim();
if (!testValue) {
  const testDatabaseName = process.env.TEST_DATABASE_NAME?.trim();
  if (!testDatabaseName || !/^[a-z][a-z0-9_]{0,62}$/u.test(testDatabaseName)) {
    fail(
      "set TEST_DATABASE_URL, or a safe TEST_DATABASE_NAME for local URL derivation.",
    );
  }

  const derived = new URL(productionUrl);
  derived.pathname = `/${testDatabaseName}`;
  testValue = derived.toString();
}

const testUrl = parseDatabaseUrl(testValue, "TEST_DATABASE_URL");
if (databaseIdentity(testUrl) === databaseIdentity(productionUrl)) {
  fail("TEST_DATABASE_URL resolves to the production database.");
}

const testDatabaseName = decodeURIComponent(testUrl.pathname.slice(1));
const childEnvironment = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  PL_PREDICTIONS_ISOLATED_TEST_DATABASE: "verified-isolated-test-database",
  PL_PREDICTIONS_TEST_NOW_ISO:
    process.env.PL_PREDICTIONS_TEST_NOW_ISO?.trim() ||
    "2026-08-08T12:00:00.000Z",
  TEST_DATABASE_URL: testUrl.toString(),
  PGDATABASE: testDatabaseName,
  POSTGRES_DATABASE: testDatabaseName,
};

if (process.env.DATABASE_URL_UNPOOLED) {
  const unpooledUrl = parseDatabaseUrl(
    process.env.DATABASE_URL_UNPOOLED,
    "DATABASE_URL_UNPOOLED",
  );
  unpooledUrl.pathname = testUrl.pathname;
  childEnvironment.DATABASE_URL_UNPOOLED = unpooledUrl.toString();
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
