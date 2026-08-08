import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { adminAuditLogs, predictions } from "../../src/db/schema";

const qaName = `Production QA ${Date.now().toString(36)}`;
let qaEntryId: string | null = null;

function getProductionDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for exact production cleanup.");
  }
  return drizzle(neon(connectionString));
}

test.afterEach(async () => {
  if (!qaEntryId || !process.env.DATABASE_URL) return;

  const db = getProductionDb();
  await db.delete(predictions).where(eq(predictions.id, qaEntryId));
  await db.delete(adminAuditLogs).where(eq(adminAuditLogs.targetId, qaEntryId));
  qaEntryId = null;
});

test("production accepts, protects, and exactly deletes one QA entry", async ({
  browser,
  page,
}) => {
  test.skip(
    process.env.ALLOW_PRODUCTION_WRITE_SMOKE !== "1" ||
      !process.env.PLAYWRIGHT_BASE_URL,
    "Explicitly enable the bounded production write smoke.",
  );

  const adminSecret = process.env.ADMIN_SECRET;
  expect(
    adminSecret,
    "ADMIN_SECRET must be loaded from .env.local",
  ).toBeTruthy();

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Your display name" }).fill(qaName);
  await page.getByRole("button", { name: "Review your 1–20" }).click();
  await page
    .getByRole("dialog", { name: "Check your 1–20" })
    .getByRole("button", { name: "Submit prediction" })
    .click();

  const confirmationLink = page.getByRole("link", {
    name: "View confirmation",
  });
  await expect(confirmationLink).toBeVisible();
  const entryPath = await confirmationLink.getAttribute("href");
  expect(entryPath).toMatch(/^\/entries\/[0-9a-f-]{36}$/u);
  qaEntryId = entryPath!.split("/").at(-1)!;

  await confirmationLink.click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${qaName}'s table` }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: `${qaName}'s table` }),
  ).toBeVisible();

  const freshContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  const freshPage = await freshContext.newPage();
  await freshPage.goto(entryPath!);
  await expect(
    freshPage.getByRole("heading", { level: 1, name: "That page is offside." }),
  ).toBeVisible();
  await freshContext.close();

  await page.goto("/leaderboard");
  await expect(page.getByText(qaName, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);

  await page.goto("/admin/login");
  await page.getByLabel("Admin secret").fill(adminSecret!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/u);
  await page.goto("/admin/submissions", { waitUntil: "networkidle" });
  const qaRow = page
    .getByRole("list", { name: "All submissions" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: qaName }) });
  await expect(qaRow).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await qaRow.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Submission and all 20 position rows deleted.",
  );
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);
});
