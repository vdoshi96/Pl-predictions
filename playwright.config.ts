import { defineConfig, devices } from "@playwright/test";

import { resolvePlaywrightExecutionMode } from "./tests/test-environment-safety";

const executionMode = resolvePlaywrightExecutionMode(process.env);
const isProductionWriteSmoke = executionMode === "remote-write";
const projects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "mobile-chromium",
    use: {
      ...devices["Desktop Chrome"],
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 },
    },
  },
  {
    name: "reflow-320-chromium",
    use: {
      ...devices["Desktop Chrome"],
      hasTouch: true,
      isMobile: true,
      viewport: { height: 700, width: 320 },
    },
  },
  {
    name: "reflow-430-chromium",
    use: {
      ...devices["Desktop Chrome"],
      hasTouch: true,
      isMobile: true,
      viewport: { height: 932, width: 430 },
    },
  },
  {
    name: "mobile-webkit",
    use: { ...devices["iPhone 13"] },
  },
];

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore:
    executionMode === "isolated"
      ? [
          /(?:^|[/\\])production-smoke\.spec\.ts$/u,
          /(?:^|[/\\])production-write-smoke\.spec\.ts$/u,
        ]
      : undefined,
  testMatch:
    executionMode === "remote-read-only"
      ? /(?:^|[/\\])production-smoke\.spec\.ts$/u
      : executionMode === "remote-write"
        ? /(?:^|[/\\])production-write-smoke\.spec\.ts$/u
        : undefined,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright/report" }],
  ],
  outputDir: "output/playwright/results",
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/u, "") ??
      "http://127.0.0.1:3100",
    screenshot: isProductionWriteSmoke ? "off" : "only-on-failure",
    trace: isProductionWriteSmoke ? "off" : "retain-on-failure",
    video: "off",
  },
  projects: isProductionWriteSmoke
    ? projects.filter((project) => project.name === "mobile-chromium")
    : projects,
  webServer:
    executionMode === "isolated"
      ? {
          command:
            "npm run dev -- --webpack --no-server-fast-refresh --port 3100",
          url: "http://127.0.0.1:3100/api/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
});
