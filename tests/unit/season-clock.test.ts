import { describe, expect, it } from "vitest";

import { resolveIsolatedTestNow } from "@/features/seasons/clock";

const isolatedEnvironment = {
  DATABASE_URL:
    "postgresql://tester:secret@db.example/test_league?sslmode=require",
  NODE_ENV: "test",
  PL_PREDICTIONS_ISOLATED_TEST_DATABASE: "verified-isolated-test-database",
  PL_PREDICTIONS_TEST_NOW_ISO: "2026-08-08T12:00:00.000Z",
  TEST_DATABASE_URL:
    "postgresql://tester:different-secret@db.example/test_league?sslmode=require",
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

  it("ignores an override when the database identity is not the test target", () => {
    expect(
      resolveIsolatedTestNow({
        ...isolatedEnvironment,
        DATABASE_URL: "postgresql://tester@db.example/production",
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
