import { describe, expect, it } from "vitest";

import {
  createTestDatabaseAttestation,
  databaseIdentitySha256,
  parseDatabaseUrl,
} from "../../scripts/test-database-identity.mjs";
import { resolveIsolatedTestNow } from "@/features/seasons/clock";

const productionUrl =
  "postgresql://production@db.example/application?sslmode=require";
const testUrl =
  "postgresql://tester:secret@db.example/test_league?sslmode=require";
const productionIdentitySha256 = databaseIdentitySha256(
  parseDatabaseUrl(productionUrl, "synthetic production URL"),
);
const testIdentitySha256 = databaseIdentitySha256(
  parseDatabaseUrl(testUrl, "synthetic test URL"),
);

const isolatedEnvironment = {
  DATABASE_URL: testUrl,
  NODE_ENV: "test",
  PL_PREDICTIONS_ISOLATED_TEST_DATABASE: createTestDatabaseAttestation(
    productionIdentitySha256,
    testIdentitySha256,
  ),
  PL_PREDICTIONS_PRODUCTION_DATABASE_IDENTITY_SHA256: productionIdentitySha256,
  PL_PREDICTIONS_TEST_NOW_ISO: "2026-08-08T12:00:00.000Z",
  TEST_DATABASE_URL: testUrl,
};

describe("isolated test clock", () => {
  it("returns the fixed time only for the wrapper-verified test database", () => {
    expect(resolveIsolatedTestNow(isolatedEnvironment)).toEqual(
      new Date("2026-08-08T12:00:00.000Z"),
    );
  });

  it("ignores all test clock variables in production", () => {
    expect(
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        NODE_ENV: "production",
      }),
    ).toBeNull();
  });

  it("allows a fixed production-build clock only in the isolated local E2E harness", () => {
    expect(
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        LOCAL_HTTP_E2E: "1",
        NODE_ENV: "production",
      }),
    ).toEqual(new Date("2026-08-08T12:00:00.000Z"));
  });

  it("ignores an override when the database identity is not the test target", () => {
    expect(
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        DATABASE_URL: "postgresql://tester@db.example/production",
      }),
    ).toBeNull();
  });

  it("ignores a copied legacy marker or target-mismatched attestation", () => {
    expect(
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        PL_PREDICTIONS_ISOLATED_TEST_DATABASE:
          "verified-isolated-test-database",
      }),
    ).toBeNull();
    expect(
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        TEST_DATABASE_URL: "postgresql://tester@db.example/other_test_database",
      }),
    ).toBeNull();
  });

  it("fails closed on an invalid clock in an otherwise verified test process", () => {
    expect(() =>
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        PL_PREDICTIONS_TEST_NOW_ISO: "not-a-time",
      }),
    ).toThrow("must be a valid ISO time");
  });
});
