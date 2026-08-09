import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  dragWithChromiumTouch,
  dragWithMouse,
  dragWithWebKitTouch,
} from "./production-drag-helpers";
import { completeSpotlightPicks } from "./spotlight-helpers";

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
  const productionOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin;
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
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
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build your 2026/27 Premier League table.",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem"),
  ).toHaveCount(20);
  const clubMarks = page.getByRole("img", { name: / club mark$/u });
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

  if (await participantName.isEnabled()) {
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
    await page.getByRole("button", { name: "Review all predictions" }).click();
    const reviewDialog = page.getByRole("dialog", {
      name: "Review every prediction",
    });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog.locator("[data-category]")).toHaveCount(7);
    for (const playerName of [
      "Cole Palmer",
      "Declan Rice",
      "Elliot Anderson",
    ]) {
      await expectPlayerPortraitLoaded(
        reviewDialog.getByRole("img", {
          name: `${playerName} player portrait`,
        }),
      );
    }
    const customPlayerFallback = reviewDialog.getByRole("img", {
      name: "Production Preview Other player portrait",
    });
    await expect(customPlayerFallback.locator("img")).toHaveCount(0);
    await expect(customPlayerFallback.locator("svg")).toBeVisible();
    await expectClubMarksLoaded(
      reviewDialog
        .getByRole("list", {
          name: "Prediction review, positions 1 through 20",
        })
        .getByRole("img", { name: / club mark$/u }),
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
  } else {
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Submissions closed", { exact: true }),
    ).toBeVisible();
    await expect(participantName).toBeDisabled();
    await expect(continueButton).toBeDisabled();
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
  const leaderboardDemo = page.getByRole("region", {
    name: "Spotlight scoring test run",
  });
  await expect(leaderboardDemo).toBeVisible();
  await expect(
    leaderboardDemo.getByText("Demo only", { exact: true }),
  ).toBeVisible();
  const demoAlex = leaderboardDemo.getByLabel(
    "Demo Alex demo leaderboard entry",
  );
  const demoAlexDetails = demoAlex.locator("details");
  if (
    !(await demoAlexDetails.evaluate(
      (element) => element instanceof HTMLDetailsElement && element.open,
    ))
  ) {
    await demoAlex
      .getByText("View seven scored picks", { exact: true })
      .click();
  }
  await expect(demoAlexDetails).toHaveJSProperty("open", true);
  await expectPlayerPortraitLoaded(
    demoAlex.getByRole("img", {
      name: "Erling Haaland player portrait",
    }),
  );
  const demoJordan = leaderboardDemo.getByLabel(
    "Demo Jordan demo leaderboard entry",
  );
  const demoJordanDetails = demoJordan.locator("details");
  if (
    !(await demoJordanDetails.evaluate(
      (element) => element instanceof HTMLDetailsElement && element.open,
    ))
  ) {
    await demoJordan
      .getByText("View seven scored picks", { exact: true })
      .click();
  }
  await expect(demoJordanDetails).toHaveJSProperty("open", true);
  const demoSilhouette = demoJordan.getByRole("img", {
    name: "Alysson player portrait",
  });
  await expect(demoSilhouette.locator("img")).toHaveCount(0);
  await expect(demoSilhouette.locator("svg")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (captureMobileEvidence) {
    await leaderboardDemo.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(screenshotDirectory!, "leaderboard-mobile.png"),
    });
  }

  await page.goto("/rules");
  await expect(
    page.getByRole("heading", { level: 1, name: "Rules and scoring" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

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
});
