import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  dragWithChromiumTouch,
  dragWithMouse,
  dragWithWebKitTouch,
} from "./production-drag-helpers";
import {
  completeSpotlightPicks,
  ROSTER_TRANSITION_PLAYER_PICKS,
} from "./spotlight-helpers";

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
}

async function resetScrollPosition(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.documentElement.scrollLeft = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollLeft = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await expect
    .poll(() => page.evaluate(() => [window.scrollX, window.scrollY]))
    .toEqual([0, 0]);
}

async function expectClubMarksLoaded(
  clubMarks: import("@playwright/test").Locator,
) {
  await expect(clubMarks).toHaveCount(20);
  for (const clubMark of await clubMarks.all()) {
    await clubMark.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        clubMark.evaluate(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
}

async function expectPlayerPortraitLoaded(
  playerMark: import("@playwright/test").Locator,
) {
  const portrait = playerMark.locator("img");
  await expect(portrait).toHaveCount(1);
  await expect
    .poll(() =>
      portrait.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0,
      ),
    )
    .toBe(true);
}

test("production public routes are mobile-safe and healthy", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "Set PLAYWRIGHT_BASE_URL to run the read-only deployment smoke test.",
  );

  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  expect(await healthResponse.json()).toMatchObject({
    service: "pl-predictions",
    status: "ok",
  });

  const screenshotDirectory = process.env.QA_SCREENSHOT_DIR;
  const captureMobileEvidence =
    Boolean(screenshotDirectory) && testInfo.project.name === "mobile-chromium";
  if (captureMobileEvidence) {
    await mkdir(screenshotDirectory!, { recursive: true });
  }
  const browserErrors: string[] = [];
  const networkErrors: string[] = [];
  const runtimeFootballRequests: string[] = [];
  const unexpectedMutationRequests: string[] = [];
  const productionOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin;
  const isBlockedVercelPreviewToolbar = (text: string) =>
    Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET) &&
    /vercel\.live\/_next-live\/feedback\/feedback\.js/iu.test(text) &&
    /Content Security Policy/iu.test(text);
  const isCanceledWebKitAdminPrefetch = (text: string) =>
    testInfo.project.name === "mobile-webkit" &&
    /\/admin\?_rsc=\S+ due to access control checks\.$/u.test(text);
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error" &&
      !isCanceledWebKitAdminPrefetch(text) &&
      !isBlockedVercelPreviewToolbar(text)
    ) {
      browserErrors.push(text);
    }
  });
  page.on("pageerror", (error) => {
    if (!isCanceledWebKitAdminPrefetch(error.message)) {
      browserErrors.push(error.message);
    }
  });
  page.on("requestfailed", (request) => {
    const requestUrl = new URL(request.url());
    const errorText = request.failure()?.errorText ?? "failed";
    const isCanceledRscPrefetch =
      requestUrl.searchParams.has("_rsc") &&
      /(?:ERR_ABORTED|cancelled|canceled)/iu.test(errorText);
    const optimizedImageSource = requestUrl.searchParams.get("url");
    const isCanceledTeamMarkCandidate =
      requestUrl.pathname === "/_next/image" &&
      optimizedImageSource?.startsWith("/team-marks/") &&
      /(?:ERR_ABORTED|cancelled|canceled)/iu.test(errorText);
    const isCanceledPlayerFaceCandidate =
      requestUrl.pathname === "/_next/image" &&
      optimizedImageSource?.startsWith("/player-faces/") &&
      /(?:ERR_ABORTED|cancelled|canceled)/iu.test(errorText);
    if (
      requestUrl.origin === productionOrigin &&
      !isCanceledRscPrefetch &&
      !isCanceledTeamMarkCandidate &&
      !isCanceledPlayerFaceCandidate
    ) {
      networkErrors.push(`${request.method()} ${request.url()} ${errorText}`);
    }
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (
      /(?:premierleague\.com|fotmob\.com|transfermarkt\.)$/iu.test(
        requestUrl.hostname,
      )
    ) {
      runtimeFootballRequests.push(request.url());
    }
    if (
      requestUrl.origin === productionOrigin &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      unexpectedMutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin === productionOrigin &&
      response.status() >= 400
    ) {
      networkErrors.push(
        `${response.request().method()} ${response.url()} ${response.status()}`,
      );
    }
  });

  await page.goto("/");
  const seasonTableHeading = page.getByRole("heading", {
    level: 1,
    name: "Season table",
  });
  const entryHeading = page.getByRole("heading", {
    level: 1,
    name: "Build your 2026/27 Premier League table.",
  });
  await expect(seasonTableHeading.or(entryHeading)).toBeVisible();
  const predictionsRevealed = await seasonTableHeading.isVisible();
  let clubMarks: import("@playwright/test").Locator;
  if (predictionsRevealed) {
    await expect(seasonTableHeading).toBeVisible();
    const seasonTable = page.getByRole("table", {
      name: "Premier League season table",
    });
    await expect(seasonTable.locator("tbody tr")).toHaveCount(20);
    clubMarks = seasonTable.locator("tbody img");
  } else {
    await expect(entryHeading).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Premier League predicted positions" })
        .getByRole("listitem"),
    ).toHaveCount(20);
    clubMarks = page.getByRole("img", { name: / club mark$/u });
  }
  await expect(clubMarks).toHaveCount(20);
  expect(
    await clubMarks.evaluateAll((images) =>
      images.every((image) => {
        const source = decodeURIComponent(image.getAttribute("src") ?? "");
        return source.includes("/team-marks/") && source.includes(".png");
      }),
    ),
  ).toBe(true);

  const participantName = page.getByRole("textbox", {
    name: "Your display name",
  });
  const continueButton = page.getByRole("button", {
    name: "Continue to spotlight picks",
  });
  await expectNoHorizontalOverflow(page);

  if (!predictionsRevealed && (await participantName.isEnabled())) {
    const countdown = page.getByRole("timer", {
      name: /until submissions lock$/u,
    });
    await expect(countdown).toBeVisible();
    await expect(countdown.locator(".countdown-flip")).toHaveCount(4);
    if (captureMobileEvidence) {
      await page.screenshot({
        animations: "disabled",
        path: path.join(screenshotDirectory!, "countdown-mobile.png"),
      });
    }
    await participantName.fill("Production review preview");
    await expect(participantName).toHaveValue("Production review preview");
    await expect(continueButton).toBeEnabled();

    let firstHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
    const table = page.getByRole("list", {
      name: "Premier League predicted positions",
    });
    if (
      testInfo.project.name === "mobile-chromium" ||
      testInfo.project.name === "mobile-webkit"
    ) {
      const touchTarget = page.getByRole("button", {
        name: /^Move AFC Bournemouth,/,
      });
      const dragWithTouch =
        testInfo.project.name === "mobile-chromium"
          ? dragWithChromiumTouch
          : dragWithWebKitTouch;
      await dragWithTouch(page, firstHandle, touchTarget);
      if (
        (await table
          .getByRole("listitem")
          .first()
          .getAttribute("aria-label")) === "Arsenal, predicted position 1 of 20"
      ) {
        await dragWithTouch(page, firstHandle, touchTarget);
      }
      await expect(table.getByRole("listitem").first()).not.toHaveAttribute(
        "aria-label",
        /^Arsenal, predicted position 1 of 20$/,
      );
    } else {
      if (testInfo.project.name === "chromium") {
        const secondHandle = page.getByRole("button", {
          name: /^Move Aston Villa,/,
        });
        await dragWithMouse(page, firstHandle, secondHandle);
      } else {
        await firstHandle.focus();
        await page.keyboard.press("ArrowDown");
      }
      await expect(table.getByRole("listitem").first()).toHaveAttribute(
        "aria-label",
        /^Aston Villa, predicted position 1 of 20$/,
      );
    }
    await expect(
      page.locator("[data-dnd-dragging], [data-dnd-dropping]"),
    ).toHaveCount(0);
    await expect(participantName).toHaveValue("Production review preview");

    await page
      .getByRole("button", {
        name: "Reset prediction table to alphabetical order",
      })
      .click();
    firstHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
    await firstHandle.focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByText(/^Arsenal moved to position 2 of 20\.$/u),
    ).toBeVisible();
    if (captureMobileEvidence) {
      await page.screenshot({
        path: path.join(screenshotDirectory!, "prediction-mobile.png"),
      });
    }

    await continueButton.click();
    await completeSpotlightPicks(page, "Production Preview");
    if (captureMobileEvidence) {
      await page
        .getByRole("heading", { name: "Make your spotlight picks" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        animations: "disabled",
        path: path.join(screenshotDirectory!, "spotlight-picks-mobile.png"),
      });
    }
    await page.getByRole("button", { name: "Review all predictions" }).click();
    const reviewDialog = page.getByRole("dialog", {
      name: "Review every prediction",
    });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog.locator("[data-category]")).toHaveCount(7);
    for (const pick of ROSTER_TRANSITION_PLAYER_PICKS) {
      const playerMark = reviewDialog.getByRole("img", {
        name: `${pick.option} player portrait`,
      });
      await expectPlayerPortraitLoaded(playerMark);
      await expect
        .poll(async () =>
          decodeURIComponent(
            (await playerMark.locator("img").getAttribute("src")) ?? "",
          ),
        )
        .toContain(pick.portraitPath);
      await expect(
        reviewDialog.getByText(pick.option, { exact: true }),
      ).toBeVisible();
    }
    const customPlayerFallback = reviewDialog.getByRole("img", {
      name: "Production Preview Other player portrait",
    });
    await expect(customPlayerFallback.locator("img")).toHaveCount(0);
    await expect(customPlayerFallback.locator("svg")).toBeVisible();
    const reviewTable = reviewDialog.getByRole("group", {
      name: "Prediction review, positions 1 through 20",
    });
    await expect(reviewTable.locator("li")).toHaveCount(20);
    await expect(reviewTable.getByRole("listitem")).toHaveCount(8);
    await reviewTable.getByText("Show all 20 clubs", { exact: true }).click();
    await expect(reviewTable.getByRole("listitem")).toHaveCount(20);
    await expectClubMarksLoaded(
      reviewTable.getByRole("img", { name: / club mark$/u }),
    );
    const reviewScroller = reviewDialog.locator(".overflow-y-auto");
    await reviewScroller.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect
      .poll(() => reviewScroller.evaluate((element) => element.scrollTop))
      .toBe(0);
    if (captureMobileEvidence) {
      await page.screenshot({
        path: path.join(screenshotDirectory!, "review-mobile.png"),
      });
    }
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Back to table" }).click();
  } else if (predictionsRevealed) {
    await expect(participantName).toHaveCount(0);
    await expect(continueButton).toHaveCount(0);
    await expect(page.getByRole("timer")).toHaveCount(0);
    await expect(
      page.getByText("Submissions closed · predictions revealed", {
        exact: true,
      }),
    ).toBeVisible();
    if (captureMobileEvidence) {
      await page.screenshot({
        path: path.join(screenshotDirectory!, "season-table-mobile.png"),
      });
    }
  } else {
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Submissions closed", { exact: true }),
    ).toBeVisible();
    await expect(participantName).toBeDisabled();
    await expect(continueButton).toBeDisabled();
    await expect(page.getByRole("timer")).toHaveCount(0);
    if (captureMobileEvidence) {
      await page.screenshot({
        path: path.join(screenshotDirectory!, "prediction-mobile.png"),
      });
      await page.screenshot({
        path: path.join(screenshotDirectory!, "review-mobile.png"),
      });
    }
  }

  await expectClubMarksLoaded(clubMarks);

  await page.goto("/leaderboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Dranx Prediction League" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View spotlight accuracy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spotlight accuracy test run" }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/win-streak");
  await expect(
    page.getByRole("heading", { level: 1, name: "Win Streak" }),
  ).toBeVisible();
  const winStreakLeaderboard = page.getByTestId("win-streak-leaderboard");
  await expect(winStreakLeaderboard).toBeVisible();
  await expect(
    winStreakLeaderboard.getByRole("heading", {
      name: "Win Streak leaderboard",
    }),
  ).toBeVisible();
  await expect(
    winStreakLeaderboard.getByText(
      "Ranked by personal best. Tied bests share a rank; current picks are visible as soon as they are locked.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your Win Streak" }),
  ).toBeVisible();
  const winStreakDisplayName = page.getByRole("textbox", {
    name: "Display name",
  });
  if (await winStreakDisplayName.isVisible()) {
    await expect(winStreakDisplayName).toBeEditable();
    await expect(
      page.getByRole("button", { name: "Continue to profile" }),
    ).toBeDisabled();
  }
  await expectNoHorizontalOverflow(page);

  await page.goto("/spotlight?view=entries&sort=overall");
  await expect(
    page.getByRole("heading", { level: 1, name: "Spotlight accuracy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spotlight accuracy test run" }),
  ).toHaveCount(0);
  await expect(page.getByText("Demo Alex", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Demo Jordan", { exact: true })).toHaveCount(0);
  const spotlightLeaderboard = page.getByLabel(
    "Spotlight accuracy leaderboard",
  );
  if (predictionsRevealed) {
    await expect(
      page.getByRole("heading", {
        name: "Spotlight picks are still private",
      }),
    ).toHaveCount(0);
    await expect(spotlightLeaderboard).toBeVisible();
    await expect
      .poll(() => spotlightLeaderboard.getByRole("article").count())
      .toBeGreaterThan(0);
  } else {
    await expect(
      page.getByRole("heading", {
        name: "Spotlight picks are still private",
      }),
    ).toBeVisible();
    await expect(spotlightLeaderboard).toHaveCount(0);
  }
  await expect(page.getByText(/^\d+ active brackets?$/u)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (captureMobileEvidence) {
    if (predictionsRevealed) {
      await spotlightLeaderboard.scrollIntoViewIfNeeded();
    } else {
      await page
        .getByRole("heading", { name: "Spotlight picks are still private" })
        .scrollIntoViewIfNeeded();
    }
    await page.screenshot({
      animations: "disabled",
      path: path.join(screenshotDirectory!, "spotlight-mobile.png"),
    });
  }

  await page.goto("/rules");
  await expect(
    page.getByRole("heading", { level: 1, name: "How to play & scoring" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How to play in three steps" }),
  ).toBeVisible();
  const walkthroughScreenshots = page.getByRole("img", {
    name: /Mobile .* screen/u,
  });
  await expect(walkthroughScreenshots).toHaveCount(3);
  for (const screenshot of await walkthroughScreenshots.all()) {
    await screenshot.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        screenshot.evaluate(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await expectNoHorizontalOverflow(page);
  if (captureMobileEvidence) {
    await page.locator("#how-to-play").screenshot({
      animations: "disabled",
      path: path.join(screenshotDirectory!, "how-to-mobile.png"),
    });
  }

  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin sign in" }),
  ).toBeVisible();
  await resetScrollPosition(page);
  await expectNoHorizontalOverflow(page);
  if (captureMobileEvidence) {
    await page.screenshot({
      path: path.join(screenshotDirectory!, "admin-login-mobile.png"),
    });
  }

  expect(browserErrors).toEqual([]);
  expect(networkErrors).toEqual([]);
  expect(
    runtimeFootballRequests,
    "The deployed application must not request a football-data source at runtime.",
  ).toEqual([]);
  expect(
    unexpectedMutationRequests,
    "The production smoke must not send a same-origin mutation request.",
  ).toEqual([]);
});
