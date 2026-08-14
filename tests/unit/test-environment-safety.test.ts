// @vitest-environment node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createTestDatabaseAttestation,
  databaseIdentitySha256,
  parseDatabaseUrl,
} from "../../scripts/test-database-identity.mjs";
import {
  assertIsolatedDatabaseEnvironment,
  resolvePlaywrightExecutionMode,
} from "../test-environment-safety";

const playwrightCli = fileURLToPath(
  new URL("../../node_modules/@playwright/test/cli.js", import.meta.url),
);
const vitestCli = fileURLToPath(
  new URL("../../node_modules/vitest/vitest.mjs", import.meta.url),
);

const productionUrl =
  "postgresql://production@production.example.com/application";
const testUrl = "postgresql://test@isolated.example.com/application_test";

function attestedEnvironment(
  sourceProductionUrl = productionUrl,
  sourceTestUrl = testUrl,
) {
  const productionIdentitySha256 = databaseIdentitySha256(
    parseDatabaseUrl(sourceProductionUrl, "synthetic production URL"),
  );
  const testIdentitySha256 = databaseIdentitySha256(
    parseDatabaseUrl(sourceTestUrl, "synthetic test URL"),
  );
  return {
    DATABASE_URL: sourceTestUrl,
    PL_PREDICTIONS_ISOLATED_TEST_DATABASE: createTestDatabaseAttestation(
      productionIdentitySha256,
      testIdentitySha256,
    ),
    PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256:
      productionIdentitySha256,
    TEST_DATABASE_URL: sourceTestUrl,
  } as const;
}

const isolatedEnvironment = attestedEnvironment();

function runProcess(
  executable: string,
  args: string[],
  overrides: Record<string, string>,
) {
  return spawnSync(process.execPath, [executable, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ALLOW_PRODUCTION_READ_ONLY_SMOKE: "",
      ALLOW_PRODUCTION_WRITE_SMOKE: "",
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      PL_PREDICTIONS_ISOLATED_TEST_DATABASE: "",
      PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256: "",
      PLAYWRIGHT_BASE_URL: "",
      RUN_DB_INTEGRATION: "",
      TEST_DATABASE_URL: "",
      ...overrides,
    },
  });
}

function runPlaywrightList(overrides: Record<string, string>) {
  return runProcess(
    playwrightCli,
    ["test", "--list", "--reporter=list"],
    overrides,
  );
}

describe("test harness environment safety", () => {
  it("accepts only a wrapper-attested identical local database target", () => {
    expect(() =>
      assertIsolatedDatabaseEnvironment(
        isolatedEnvironment,
        "Synthetic integration",
      ),
    ).not.toThrow();
    expect(resolvePlaywrightExecutionMode(isolatedEnvironment)).toBe(
      "isolated",
    );
  });

  it("rejects local integration or Playwright without wrapper attestation", () => {
    expect(() =>
      assertIsolatedDatabaseEnvironment(
        {
          DATABASE_URL: isolatedEnvironment.DATABASE_URL,
          TEST_DATABASE_URL: isolatedEnvironment.TEST_DATABASE_URL,
        },
        "Synthetic integration",
      ),
    ).toThrow("wrapper-derived isolated-database attestation is missing");
    expect(() =>
      resolvePlaywrightExecutionMode({
        DATABASE_URL: isolatedEnvironment.DATABASE_URL,
        TEST_DATABASE_URL: isolatedEnvironment.TEST_DATABASE_URL,
      }),
    ).toThrow("verified isolated-database attestation is missing");
  });

  it("rejects an attested local run whose database variables differ", () => {
    expect(() =>
      assertIsolatedDatabaseEnvironment(
        {
          ...isolatedEnvironment,
          TEST_DATABASE_URL:
            "postgresql://test@other.example.com/application_test",
        },
        "Synthetic integration",
      ),
    ).toThrow("DATABASE_URL and TEST_DATABASE_URL");
    expect(() =>
      assertIsolatedDatabaseEnvironment(
        {
          ...isolatedEnvironment,
          TEST_DATABASE_URL: ` ${isolatedEnvironment.DATABASE_URL}`,
        },
        "Synthetic integration",
      ),
    ).toThrow("DATABASE_URL and TEST_DATABASE_URL");
  });

  it("rejects a copied static marker and a test identity equal to production", () => {
    const productionLikeUrl =
      "postgresql://production@database.example.com/application";
    const productionIdentitySha256 = databaseIdentitySha256(
      parseDatabaseUrl(productionLikeUrl, "synthetic production URL"),
    );

    expect(() =>
      assertIsolatedDatabaseEnvironment(
        {
          DATABASE_URL: productionLikeUrl,
          PL_PREDICTIONS_ISOLATED_TEST_DATABASE:
            "verified-isolated-test-database",
          PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256:
            productionIdentitySha256,
          TEST_DATABASE_URL: productionLikeUrl,
        },
        "Synthetic integration",
      ),
    ).toThrow("matches the wrapper-carried production database identity");

    expect(() =>
      assertIsolatedDatabaseEnvironment(
        {
          ...isolatedEnvironment,
          PL_PREDICTIONS_ISOLATED_TEST_DATABASE:
            "verified-isolated-test-database",
        },
        "Synthetic integration",
      ),
    ).toThrow("attestation does not match");
  });

  it("requires an explicit and unambiguous remote smoke mode", () => {
    const remote = {
      PLAYWRIGHT_BASE_URL: "https://deployment.example.com",
    } as const;
    expect(() => resolvePlaywrightExecutionMode(remote)).toThrow(
      "Remote Playwright requires",
    );
    expect(
      resolvePlaywrightExecutionMode({
        ...remote,
        ALLOW_PRODUCTION_READ_ONLY_SMOKE: "1",
      }),
    ).toBe("remote-read-only");
    expect(
      resolvePlaywrightExecutionMode({
        ...remote,
        ALLOW_PRODUCTION_WRITE_SMOKE: "1",
      }),
    ).toBe("remote-write");
    expect(() =>
      resolvePlaywrightExecutionMode({
        ...remote,
        ALLOW_PRODUCTION_READ_ONLY_SMOKE: "1",
        ALLOW_PRODUCTION_WRITE_SMOKE: "1",
      }),
    ).toThrow("remote mode is ambiguous");
  });

  it("rejects a remote smoke marker without a base URL", () => {
    expect(() =>
      resolvePlaywrightExecutionMode({
        ALLOW_PRODUCTION_READ_ONLY_SMOKE: "1",
      }),
    ).toThrow("requires PLAYWRIGHT_BASE_URL");
  });

  it("rejects remote settings inherited by a wrapper-attested local run", () => {
    expect(() =>
      resolvePlaywrightExecutionMode({
        ...isolatedEnvironment,
        ALLOW_PRODUCTION_WRITE_SMOKE: "1",
        PLAYWRIGHT_BASE_URL: "https://deployment.example.com",
      }),
    ).toThrow("cannot also configure a remote base URL or smoke marker");
  });

  it("fails an enabled integration process before tests without attestation", () => {
    const result = runProcess(
      vitestCli,
      ["run", "tests/integration/database.integration.test.ts"],
      {
        DATABASE_URL:
          "postgresql://test@isolated.invalid/application_test_guard",
        RUN_DB_INTEGRATION: "1",
        TEST_DATABASE_URL:
          "postgresql://test@isolated.invalid/application_test_guard",
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "wrapper-derived isolated-database attestation is missing",
    );
  });

  it("rejects a copied static marker in the central Vitest guard", () => {
    const productionLikeUrl =
      "postgresql://production@database.invalid/application";
    const productionIdentitySha256 = databaseIdentitySha256(
      parseDatabaseUrl(productionLikeUrl, "synthetic production URL"),
    );
    const result = runProcess(vitestCli, ["run", "tests/unit/policy.test.ts"], {
      DATABASE_URL: productionLikeUrl,
      PL_PREDICTIONS_ISOLATED_TEST_DATABASE: "verified-isolated-test-database",
      PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256:
        productionIdentitySha256,
      RUN_DB_INTEGRATION: "1",
      TEST_DATABASE_URL: productionLikeUrl,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "matches the wrapper-carried production database identity",
    );
  });

  it("accepts target-specific attestation in the central Vitest guard", () => {
    const result = runProcess(vitestCli, ["run", "tests/unit/policy.test.ts"], {
      ...isolatedEnvironment,
      RUN_DB_INTEGRATION: "1",
    });

    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });

  it("selects only the production read-only smoke in marked remote mode", () => {
    const result = runPlaywrightList({
      ALLOW_PRODUCTION_READ_ONLY_SMOKE: "1",
      PLAYWRIGHT_BASE_URL: "https://deployment.example.com",
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("production-smoke.spec.ts");
    expect(output).not.toContain("production-write-smoke.spec.ts");
    expect(output).not.toContain("app-journey.spec.ts");
  });

  it("selects only the mobile production write smoke in its explicit mode", () => {
    const result = runPlaywrightList({
      ALLOW_PRODUCTION_WRITE_SMOKE: "1",
      PLAYWRIGHT_BASE_URL: "https://pl-predictions-2026.vercel.app",
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("[mobile-chromium]");
    expect(output).toContain("production-write-smoke.spec.ts");
    expect(output).not.toContain("production-smoke.spec.ts");
    expect(output).not.toContain("app-journey.spec.ts");
  });

  it("keeps both production smoke files unreachable from isolated local mode", () => {
    const result = runPlaywrightList({
      ...isolatedEnvironment,
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("app-journey.spec.ts");
    expect(output).not.toContain("production-smoke.spec.ts");
    expect(output).not.toContain("production-write-smoke.spec.ts");
  });

  it("rejects an unmarked remote Playwright process before collection", () => {
    const result = runPlaywrightList({
      PLAYWRIGHT_BASE_URL: "https://deployment.example.com",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Remote Playwright requires ALLOW_PRODUCTION_READ_ONLY_SMOKE=1",
    );
  });
});
