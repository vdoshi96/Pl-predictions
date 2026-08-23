import { expect, test, type Page, type TestInfo } from "@playwright/test";

const evidencePaths = {
  chromium: "docs/assets/qa/win-streak-workshop-desktop.png",
  "mobile-chromium": "docs/assets/qa/win-streak-workshop-mobile.png",
} as const;

const networkViolations = new WeakMap<Page, string[]>();
const browserErrors = new WeakMap<Page, string[]>();

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    window.scrollTo(document.documentElement.scrollWidth, originalScrollY);
    const maximumScrollX = window.scrollX;
    window.scrollTo(originalScrollX, originalScrollY);
    return {
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth,
      maximumScrollX,
    };
  });

  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.maximumScrollX).toBe(0);
}

async function createOrResumeProfile(page: Page, displayName: string) {
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Create or resume profile" }).click();
  await expect(
    page.getByRole("heading", { name: `${displayName}'s streak` }),
  ).toBeVisible();
}

async function switchProfile(page: Page, displayName: string) {
  await page.getByRole("button", { name: "Switch profile" }).click();
  await createOrResumeProfile(page, displayName);
}

async function confirmPick(page: Page, clubName: string) {
  const picker = page.getByRole("region", { name: "Choose one club to win" });
  await picker.getByRole("radio", { name: clubName }).check();
  await picker.getByRole("button", { name: "Review pick" }).click();
  const review = page.getByRole("dialog", { name: "Review your pick" });
  await expect(review).toBeVisible();
  await expect(review.getByText(clubName, { exact: true })).toBeVisible();
  await review.getByRole("button", { name: `Confirm ${clubName}` }).click();
  await expect(
    page.getByRole("heading", { name: `Pick locked: ${clubName}` }),
  ).toBeVisible();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review pick" })).toHaveCount(
    0,
  );
}

async function chooseFixtureResult(
  page: Page,
  fixtureName: string,
  resultName: "Away win" | "Draw" | "Home win" | "Void",
) {
  const fixture = page.getByRole("group", { name: fixtureName });
  await expect(fixture).toBeVisible();
  await fixture.getByRole("radio", { name: resultName }).check();
}

async function applyResultsAndAdvance(page: Page) {
  await page.getByRole("button", { name: "Apply results and advance" }).click();
}

async function captureEvidence(page: Page, testInfo: TestInfo): Promise<void> {
  if (process.env.WIN_STREAK_CAPTURE_EVIDENCE !== "1") return;
  const path =
    evidencePaths[testInfo.project.name as keyof typeof evidencePaths];
  if (!path) return;

  await page.screenshot({ animations: "disabled", fullPage: true, path });
}

test.beforeEach(async ({ baseURL, page }) => {
  const allowedOrigin = new URL(baseURL ?? "http://127.0.0.1:3100").origin;
  const violations: string[] = [];
  const errors: string[] = [];
  networkViolations.set(page, violations);
  browserErrors.set(page, errors);
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    const isHttp =
      requestUrl.protocol === "http:" || requestUrl.protocol === "https:";
    if (
      isHttp &&
      (requestUrl.origin !== allowedOrigin ||
        requestUrl.pathname.startsWith("/api/"))
    ) {
      violations.push(requestUrl.href);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/win-streak");
  await page.evaluate(() => window.localStorage.clear());
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test("uses only static same-origin assets and browser-local state", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Win Streak" }),
  ).toBeVisible();
  await createOrResumeProfile(page, "A very long workshop display name 123");
  await expect(
    page.getByRole("region", { name: "Choose one club to win" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(networkViolations.get(page)).toEqual([]);
});

test("honors the site's dark color scheme without losing the name gate", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });

  await expect(
    page.getByRole("heading", { level: 1, name: "Win Streak" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      background: getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim(),
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    })),
  ).toEqual({ background: "#17041a", prefersDark: true });
  await expectNoHorizontalOverflow(page);
});

test("creates a local profile, reviews one immutable pick, and restores it after reload", async ({
  page,
}, testInfo) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Win Streak" }),
  ).toBeVisible();
  await expect(page.getByText("Local workshop", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await createOrResumeProfile(page, "Alex Morgan");
  await expect(
    page.getByRole("heading", { name: "Matchweek 20" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Choose one club to win" }),
  ).toBeVisible();

  await confirmPick(page, "Arsenal");
  // Let Link prefetches settle before reload so WebKit does not report an
  // intentional navigation abort as a page error.
  await page.waitForTimeout(300);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Alex Morgan's streak" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pick locked: Arsenal" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureEvidence(page, testInfo);
});

test("applies shared outcomes, preserves misses and voids, and resets on a draw or loss", async ({
  page,
}) => {
  await createOrResumeProfile(page, "Avery");
  await confirmPick(page, "Arsenal");
  await switchProfile(page, "Blair");
  await confirmPick(page, "Brentford");

  await chooseFixtureResult(page, "Arsenal v Brentford", "Home win");
  await applyResultsAndAdvance(page);
  await expect(
    page.getByRole("heading", { name: "Matchweek 21" }),
  ).toBeVisible();

  await switchProfile(page, "Avery");
  await expect(
    page.getByText("Current streak 1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Best streak 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Arsenal.*Used in this streak/u }),
  ).toBeDisabled();

  // Avery misses Matchweek 21. Blair's voided pick advances the shared round.
  await switchProfile(page, "Blair");
  await confirmPick(page, "Brighton & Hove Albion");
  await chooseFixtureResult(page, "Brentford v Brighton & Hove Albion", "Void");
  await applyResultsAndAdvance(page);
  await expect(
    page.getByRole("heading", { name: "Matchweek 22" }),
  ).toBeVisible();

  await switchProfile(page, "Avery");
  await expect(
    page.getByText("Current streak 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Arsenal.*Used in this streak/u }),
  ).toBeDisabled();
  await switchProfile(page, "Blair");
  await expect(
    page.getByText("Current streak 0", { exact: true }),
  ).toBeVisible();

  // A draw breaks Avery's streak, preserves the best, and unlocks Arsenal.
  await switchProfile(page, "Avery");
  await confirmPick(page, "Newcastle United");
  await chooseFixtureResult(page, "Arsenal v Newcastle United", "Draw");
  await applyResultsAndAdvance(page);
  await expect(
    page.getByText("Current streak 0", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Best streak 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Arsenal" })).toBeEnabled();
});

test("uses best streak for shared ranks and clears the complete workshop state", async ({
  page,
}) => {
  await createOrResumeProfile(page, "Casey");
  await confirmPick(page, "Arsenal");
  await switchProfile(page, "Bailey");
  await confirmPick(page, "Arsenal");
  await chooseFixtureResult(page, "Arsenal v Brentford", "Home win");
  await applyResultsAndAdvance(page);

  const leaderboard = page.getByRole("table", {
    name: "Win Streak leaderboard",
  });
  await expect(leaderboard).toBeVisible();
  const rows = leaderboard.getByRole("row");
  await expect(rows.nth(1)).toContainText("Bailey");
  await expect(rows.nth(1)).toContainText("1");
  await expect(rows.nth(2)).toContainText("Casey");
  await expect(rows.nth(2)).toContainText("1");

  await page.getByRole("button", { name: "Clear all workshop data" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Clear all workshop data?",
  });
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Clear all workshop data" })
    .click();

  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByText("Bailey", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Casey", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Display name")).toBeVisible();
});
