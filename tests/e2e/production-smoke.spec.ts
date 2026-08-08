import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  dragWithChromiumTouch,
  dragWithMouse,
  dragWithWebKitTouch,
} from "./production-drag-helpers";

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
    if (requestUrl.origin === productionOrigin && !isCanceledRscPrefetch) {
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
  await expect
    .poll(() =>
      clubMarks.evaluateAll((images) =>
        images.every(
          (image) =>
            image instanceof HTMLImageElement && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
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
  const reviewButton = page.getByRole("button", { name: "Review your 1–20" });
  await expectNoHorizontalOverflow(page);

  if (await participantName.isEnabled()) {
    await participantName.fill("Production review preview");
    await expect(participantName).toHaveValue("Production review preview");
    await expect(reviewButton).toBeEnabled();

    let firstHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
    const secondHandle = page.getByRole("button", {
      name: /^Move Aston Villa,/,
    });
    if (testInfo.project.name === "chromium") {
      await dragWithMouse(page, firstHandle, secondHandle);
    } else if (testInfo.project.name === "mobile-chromium") {
      await dragWithChromiumTouch(page, firstHandle, secondHandle);
    } else if (testInfo.project.name === "mobile-webkit") {
      await dragWithWebKitTouch(page, firstHandle, secondHandle);
    } else {
      await firstHandle.focus();
      await page.keyboard.press("ArrowDown");
    }
    await expect(
      page
        .getByRole("list", { name: "Premier League predicted positions" })
        .getByRole("listitem")
        .first(),
    ).toHaveAttribute(
      "aria-label",
      /^Aston Villa, predicted position 1 of 20$/,
    );
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

    await reviewButton.click();
    await expect(
      page.getByRole("dialog", { name: "Check your 1–20" }),
    ).toBeVisible();
    if (captureMobileEvidence) {
      await page.screenshot({
        path: path.join(screenshotDirectory!, "review-mobile.png"),
      });
    }
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Submissions closed", { exact: true }),
    ).toBeVisible();
    await expect(participantName).toBeDisabled();
    await expect(reviewButton).toBeDisabled();
    if (captureMobileEvidence) {
      await page.screenshot({
        path: path.join(screenshotDirectory!, "prediction-mobile.png"),
      });
      await page.screenshot({
        path: path.join(screenshotDirectory!, "review-mobile.png"),
      });
    }
  }

  await page.goto("/leaderboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Dranx Prediction League" }),
  ).toBeVisible();
  await resetScrollPosition(page);
  await expectNoHorizontalOverflow(page);
  if (captureMobileEvidence) {
    await page.screenshot({
      path: path.join(screenshotDirectory!, "leaderboard-mobile.png"),
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
});
