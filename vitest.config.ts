import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { assertIsolatedDatabaseEnvironment } from "./scripts/test-database-identity.mjs";

if (process.env.RUN_DB_INTEGRATION === "1") {
  assertIsolatedDatabaseEnvironment(process.env, "Neon integration tests");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/features/**/*.ts", "src/shared/**/*.ts"],
      exclude: ["**/*.d.ts"],
    },
  },
});
