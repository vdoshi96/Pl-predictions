import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

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
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your Premier League table. One final call.",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem"),
  ).toHaveCount(20);

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBe(widths.client);

  const firstHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
  const secondHandle = page.getByRole("button", {
    name: /^Move Aston Villa,/,
  });
  await firstHandle.scrollIntoViewIfNeeded();
  const [firstBox, secondBox] = await Promise.all([
    firstHandle.boundingBox(),
    secondHandle.boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  await page.mouse.move(
    firstBox!.x + firstBox!.width / 2,
    firstBox!.y + firstBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    secondBox!.x + secondBox!.width / 2,
    secondBox!.y + secondBox!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem")
      .first(),
  ).toHaveAttribute("aria-label", /^Aston Villa, predicted position 1 of 20$/);
  if (captureMobileEvidence) {
    await page.screenshot({
      path: path.join(screenshotDirectory!, "prediction-mobile.png"),
    });
  }

  await page
    .getByRole("textbox", { name: "Your display name" })
    .fill("Production review preview");
  await page.getByRole("button", { name: "Review your 1–20" }).click();
  await expect(
    page.getByRole("dialog", { name: "Check your 1–20" }),
  ).toBeVisible();
  if (captureMobileEvidence) {
    await page.screenshot({
      path: path.join(screenshotDirectory!, "review-mobile.png"),
    });
  }
  await page.keyboard.press("Escape");

  await page.goto("/leaderboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Friends leaderboard" }),
  ).toBeVisible();
  if (captureMobileEvidence) {
    await page.screenshot({
      path: path.join(screenshotDirectory!, "leaderboard-mobile.png"),
    });
  }

  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin sign in" }),
  ).toBeVisible();
  if (captureMobileEvidence) {
    await page.screenshot({
      path: path.join(screenshotDirectory!, "admin-login-mobile.png"),
    });
  }

  expect(browserErrors).toEqual([]);
});
