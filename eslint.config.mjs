import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Owner-provided raw player-source handoff. Only normalized fixtures and
    // reviewed portraits are application inputs; do not lint its bundled venv.
    "premier-league-players-2026-08-08/**",
  ]),
]);

export default eslintConfig;
