// @vitest-environment node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const wrapperPath = fileURLToPath(
  new URL("../../scripts/run-with-test-database.mjs", import.meta.url),
);

type WrapperEnvironment = Readonly<Record<string, string>>;

function runWrapper(
  environment: WrapperEnvironment,
  childScript = "process.stdout.write('child-ran')",
) {
  return spawnSync(
    process.execPath,
    [wrapperPath, process.execPath, "-e", childScript],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "",
        DATABASE_URL_UNPOOLED: "",
        TEST_DATABASE_NAME: "",
        TEST_DATABASE_URL: "",
        ...environment,
      },
    },
  );
}

function expectSafetyFailure(environment: WrapperEnvironment, message: RegExp) {
  const result = runWrapper(environment);

  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(message);
  expect(result.stderr).toContain("Test database safety check failed:");
}

describe("test database safety wrapper", () => {
  it("rejects the same logical database under another user, protocol, and default-port spelling", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production-user:one@database.example.com/application",
        TEST_DATABASE_URL:
          "postgres://test-user:two@DATABASE.EXAMPLE.COM:5432/application",
      },
      /resolves to the production database/u,
    );
  });

  it("rejects a generic production host with a trailing DNS root dot", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production@database.example.com/application",
        TEST_DATABASE_URL:
          "postgresql://test@database.example.com./application",
      },
      /resolves to the production database/u,
    );
  });

  it("rejects Neon pooled and unpooled spellings of the same target", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production:one@ep-shared-pooler.us-east-2.aws.neon.tech/application?sslmode=require",
        DATABASE_URL_UNPOOLED:
          "postgresql://production:one@ep-shared.us-east-2.aws.neon.tech/application?sslmode=require",
        TEST_DATABASE_URL:
          "postgres://test:two@ep-shared.us-east-2.aws.neon.tech:5432/application?sslmode=require",
      },
      /resolves to the production database/u,
    );
  });

  it("rejects Neon pooled and unpooled spellings with trailing DNS root dots", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production@ep-shared-pooler.us-east-2.aws.neon.tech./application",
        DATABASE_URL_UNPOOLED:
          "postgresql://production@ep-shared.us-east-2.aws.neon.tech/application",
        TEST_DATABASE_URL:
          "postgresql://test@ep-shared.us-east-2.aws.neon.tech./application",
      },
      /resolves to the production database/u,
    );
  });

  it.each([
    ["not a URL", "not-a-url", /not a valid URL/u],
    [
      "a non-PostgreSQL protocol",
      "https://database.example.com/application",
      /must use the postgres or postgresql protocol/u,
    ],
    [
      "a missing database name",
      "postgresql://test@database.example.com/",
      /must identify a specific PostgreSQL database/u,
    ],
    [
      "an identity-overriding query parameter",
      "postgresql://test@database.example.com/isolated?dbname=application",
      /must not override database identity/u,
    ],
    [
      "an encoded path separator",
      "postgresql://test@database.example.com/isolated%2Fapplication",
      /contains an ambiguous PostgreSQL database name/u,
    ],
    [
      "an encoded hostname",
      "postgresql://test@data%62ase.example.com/isolated",
      /contains an ambiguous PostgreSQL host/u,
    ],
    [
      "an ambiguous IPv4 shorthand",
      "postgresql://test@127.1/isolated",
      /contains an ambiguous PostgreSQL host/u,
    ],
  ])("rejects %s", (_label, testUrl, message) => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production@database.example.com/application",
        TEST_DATABASE_URL: testUrl,
      },
      message,
    );
  });

  it("rejects two configured test-target mechanisms", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production@database.example.com/application",
        TEST_DATABASE_NAME: "application_test",
        TEST_DATABASE_URL:
          "postgresql://test@database.example.com/application_test",
      },
      /either TEST_DATABASE_URL or TEST_DATABASE_NAME, not both/u,
    );
  });

  it("rejects conflicting pooled and unpooled production identities", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production@ep-one-pooler.us-east-2.aws.neon.tech/application",
        DATABASE_URL_UNPOOLED:
          "postgresql://production@ep-two.us-east-2.aws.neon.tech/application",
        TEST_DATABASE_URL:
          "postgresql://test@ep-test.us-east-2.aws.neon.tech/application_test",
      },
      /do not resolve to the same logical database/u,
    );
  });

  it("rejects a different host that reuses a production database name", () => {
    expectSafetyFailure(
      {
        DATABASE_URL:
          "postgresql://production@production.example.com/application",
        TEST_DATABASE_URL: "postgresql://test@isolated.example.com/application",
      },
      /must use a database name distinct from every production database URL/u,
    );
  });

  it("runs a child only for a genuinely distinct explicit target", () => {
    const result = runWrapper(
      {
        DATABASE_URL:
          "postgresql://production:one@ep-production-pooler.us-east-2.aws.neon.tech/application?sslmode=require",
        DATABASE_URL_UNPOOLED:
          "postgres://production:one@ep-production.us-east-2.aws.neon.tech:5432/application?sslmode=require",
        TEST_DATABASE_URL:
          "postgres://test:two@ep-isolated-pooler.us-east-2.aws.neon.tech/application_test?sslmode=require",
      },
      `
        const database = new URL(process.env.DATABASE_URL);
        const direct = new URL(process.env.DATABASE_URL_UNPOOLED);
        const verified =
          database.hostname === "ep-isolated-pooler.us-east-2.aws.neon.tech" &&
          database.pathname === "/application_test" &&
          direct.hostname === "ep-isolated.us-east-2.aws.neon.tech" &&
          direct.pathname === "/application_test" &&
          process.env.TEST_DATABASE_URL === process.env.DATABASE_URL &&
          process.env.PGDATABASE === "application_test" &&
          process.env.POSTGRES_DATABASE === "application_test" &&
          /^[a-f0-9]{64}$/.test(
            process.env.PL_PREDICTIONS_ISOLATED_TEST_DATABASE ?? "",
          ) &&
          /^[a-f0-9]{64}$/.test(
            process.env
              .PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256 ?? "",
          );
        process.exit(verified ? 0 : 2);
      `,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("derives a genuinely distinct target from a safe database name", () => {
    const result = runWrapper(
      {
        DATABASE_URL:
          "postgresql://production:one@database.example.com/application?sslmode=require",
        TEST_DATABASE_NAME: "application_test",
      },
      `
        const database = new URL(process.env.DATABASE_URL);
        const verified =
          database.pathname === "/application_test" &&
          process.env.TEST_DATABASE_URL === process.env.DATABASE_URL &&
          process.env.PGDATABASE === "application_test";
        process.exit(verified ? 0 : 2);
      `,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
