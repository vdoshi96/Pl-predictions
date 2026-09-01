import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { inArray, like } from "drizzle-orm";

import { getDb } from "@/db/client";
import { securityRateLimits, winStreakProfiles } from "@/db/schema";
import { normalizedParticipantNameKey } from "@/features/predictions/normalization";
import { seedWinStreakFixtures } from "../../scripts/seed-win-streak-fixtures";

const TEST_NAME_PREFIX = "WS E2E";
const evidencePaths = {
  chromium: "docs/assets/qa/win-streak-desktop.png",
  "mobile-chromium": "docs/assets/qa/win-streak-mobile.png",
} as const;

function participantName(label: string, testInfo: TestInfo): string {
  return `${TEST_NAME_PREFIX} ${label} ${testInfo.project.name}`.slice(0, 40);
}

async function cleanTestProfiles() {
  const db = getDb();
  await db
    .delete(winStreakProfiles)
    .where(
      like(
        winStreakProfiles.normalizedParticipantName,
        `${normalizedParticipantNameKey(TEST_NAME_PREFIX)}%`,
      ),
    );
  await db
    .delete(securityRateLimits)
    .where(
      inArray(securityRateLimits.scope, [
        "win_streak_create",
        "win_streak_pick",
      ]),
    );
}

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

async function createProfile(page: Page, displayName: string) {
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Continue to profile" }).click();
  await expect(
    page.getByRole("heading", { name: `${displayName}'s streak` }),
  ).toBeVisible();
}

async function confirmPick(
  page: Page,
  clubName: string,
  options: { exerciseKeyboardAndEscape?: boolean } = {},
) {
  const personal = page.getByRole("region", { name: "Your Win Streak" });
  const radio = personal.getByRole("radio", {
    name: new RegExp(clubName, "iu"),
  });
  if (options.exerciseKeyboardAndEscape) {
    await radio.focus();
    await page.keyboard.press("Space");
  } else {
    await radio.check();
  }
  await expect(radio).toBeChecked();
  const reviewButton = personal.getByRole("button", { name: "Review pick" });
  if (options.exerciseKeyboardAndEscape) {
    await reviewButton.focus();
    await page.keyboard.press("Enter");
  } else {
    await reviewButton.click();
  }
  let review = page.getByRole("dialog", { name: "Review your pick" });
  await expect(review).toBeVisible();
  if (options.exerciseKeyboardAndEscape) {
    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();
    await reviewButton.focus();
    await page.keyboard.press("Enter");
    review = page.getByRole("dialog", { name: "Review your pick" });
    await expect(review).toBeVisible();
    const confirm = review.getByRole("button", { name: `Confirm ${clubName}` });
    await confirm.focus();
    await page.keyboard.press("Enter");
  } else {
    await review.getByRole("button", { name: `Confirm ${clubName}` }).click();
  }
  await expect(
    page.getByRole("heading", { name: `Pick locked: ${clubName}` }),
  ).toBeVisible();
}

test.beforeAll(async () => {
  await seedWinStreakFixtures();
  await cleanTestProfiles();
});

test.afterAll(async () => {
  await cleanTestProfiles();
});

test.beforeEach(async ({ baseURL, page }) => {
  const allowedOrigin = new URL(baseURL ?? "http://127.0.0.1:3100").origin;
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (
      (requestUrl.protocol === "http:" || requestUrl.protocol === "https:") &&
      requestUrl.origin !== allowedOrigin
    ) {
      externalRequests.push(requestUrl.href);
    }
  });
  await page.goto("/win-streak");
  await expect(
    page.getByRole("heading", { level: 1, name: "Win Streak" }),
  ).toBeVisible();
  test.info().annotations.push({
    description: JSON.stringify({ errors, externalRequests }),
    type: "win-streak-runtime",
  });
  (page as Page & { __winStreakErrors?: string[] }).__winStreakErrors = errors;
  (
    page as Page & { __winStreakExternalRequests?: string[] }
  ).__winStreakExternalRequests = externalRequests;
});

test.afterEach(async ({ page }) => {
  expect(
    (page as Page & { __winStreakErrors?: string[] }).__winStreakErrors ?? [],
  ).toEqual([]);
  expect(
    (page as Page & { __winStreakExternalRequests?: string[] })
      .__winStreakExternalRequests ?? [],
  ).toEqual([]);
});

test("shows the public leaderboard before a participant creates a profile", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Win Streak leaderboard" }),
  ).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByText("Public picks", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("creates a browser profile, locks a public pick, and resumes after reload", async ({
  page,
}, testInfo) => {
  const name = participantName("Reload", testInfo);
  await createProfile(page, name);
  await expect(page.getByRole("radio")).toHaveCount(20);
  await confirmPick(page, "Arsenal", { exerciseKeyboardAndEscape: true });
  await expect(page.getByRole("status")).toBeFocused();

  const leaderboard = page.getByTestId("win-streak-leaderboard");
  await expect(leaderboard).toContainText(name);
  await expect(leaderboard).toContainText("Arsenal");
  await expect(leaderboard).toContainText("MW2");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: `${name}'s streak` }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pick locked: Arsenal" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  if (process.env.WIN_STREAK_CAPTURE_EVIDENCE === "1") {
    const path =
      evidencePaths[testInfo.project.name as keyof typeof evidencePaths];
    if (path) {
      await page.screenshot({ animations: "disabled", fullPage: true, path });
    }
  }
});

test("keeps opposite fixture picks shared and resumes a name after cookie loss", async ({
  baseURL,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  const firstName = participantName("Palace", testInfo);
  const secondName = participantName("City", testInfo);
  const firstContext = await browser.newContext({ baseURL });
  const secondContext = await browser.newContext({ baseURL });
  const takeoverContext = await browser.newContext({ baseURL });

  try {
    const first = await firstContext.newPage();
    const second = await secondContext.newPage();
    const takeover = await takeoverContext.newPage();
    await first.goto("/win-streak");
    await second.goto("/win-streak");
    await takeover.goto("/win-streak");

    await createProfile(first, firstName);
    await confirmPick(first, "Crystal Palace");
    await createProfile(second, secondName);
    await confirmPick(second, "Manchester City");

    await takeover.getByLabel("Display name").fill(firstName);
    await takeover.getByRole("button", { name: "Continue to profile" }).click();
    await expect(
      takeover.getByRole("heading", { name: `${firstName}'s streak` }),
    ).toBeVisible();
    await expect(
      takeover.getByRole("heading", { name: "Pick locked: Crystal Palace" }),
    ).toBeVisible();

    await first.reload();
    const leaderboard = first.getByTestId("win-streak-leaderboard");
    await expect(leaderboard).toContainText(firstName);
    await expect(leaderboard).toContainText("Crystal Palace");
    await expect(leaderboard).toContainText(secondName);
    await expect(leaderboard).toContainText("Manchester City");
  } finally {
    await firstContext.close();
    await secondContext.close();
    await takeoverContext.close();
  }
});

test("retains the Dranx dark theme without mobile overflow", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
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
