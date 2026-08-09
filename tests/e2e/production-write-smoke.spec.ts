import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { and, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  adminAuditLogs,
  predictionCategoryPicks,
  predictionItems,
  predictions,
} from "../../src/db/schema";
import { completeSpotlightPicks } from "./spotlight-helpers";

const qaName = `Production QA ${Date.now().toString(36)}`;
let qaEntryId: string | null = null;
let submissionAttempted = false;

function getProductionDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for exact production cleanup.");
  }
  return drizzle(neon(connectionString));
}

test.afterEach(async () => {
  if ((!submissionAttempted && !qaEntryId) || !process.env.DATABASE_URL) return;

  const db = getProductionDb();
  const matchingEntries = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(eq(predictions.participantName, qaName))
    .limit(2);
  expect(
    matchingEntries.length,
    "The generated production QA name must identify at most one entry",
  ).toBeLessThanOrEqual(1);

  const recoveredEntryId = matchingEntries[0]?.id ?? null;
  if (qaEntryId && recoveredEntryId) {
    expect(recoveredEntryId).toBe(qaEntryId);
  }
  const cleanupEntryId = qaEntryId ?? recoveredEntryId;

  if (cleanupEntryId) {
    await db.delete(predictions).where(eq(predictions.id, cleanupEntryId));
    await db
      .delete(adminAuditLogs)
      .where(
        and(
          eq(adminAuditLogs.action, "prediction.deleted"),
          eq(adminAuditLogs.targetType, "prediction"),
          eq(adminAuditLogs.targetId, cleanupEntryId),
        ),
      );
  }

  const [parentResidue] = await db
    .select({ value: count() })
    .from(predictions)
    .where(eq(predictions.participantName, qaName));
  expect(parentResidue?.value ?? 0).toBe(0);

  if (cleanupEntryId) {
    const [[itemResidue], [pickResidue], [auditResidue]] = await Promise.all([
      db
        .select({ value: count() })
        .from(predictionItems)
        .where(eq(predictionItems.predictionId, cleanupEntryId)),
      db
        .select({ value: count() })
        .from(predictionCategoryPicks)
        .where(eq(predictionCategoryPicks.predictionId, cleanupEntryId)),
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(
          and(
            eq(adminAuditLogs.action, "prediction.deleted"),
            eq(adminAuditLogs.targetType, "prediction"),
            eq(adminAuditLogs.targetId, cleanupEntryId),
          ),
        ),
    ]);
    expect(itemResidue?.value ?? 0).toBe(0);
    expect(pickResidue?.value ?? 0).toBe(0);
    expect(auditResidue?.value ?? 0).toBe(0);
  }

  qaEntryId = null;
  submissionAttempted = false;
});

test("production enforces its current submission state and cleans any QA entry", async ({
  browser,
  page,
}) => {
  test.skip(
    process.env.ALLOW_PRODUCTION_WRITE_SMOKE !== "1" ||
      !process.env.PLAYWRIGHT_BASE_URL,
    "Explicitly enable the bounded production write smoke.",
  );

  expect(
    process.env.DATABASE_URL,
    "DATABASE_URL is required before the bounded smoke can create a QA entry",
  ).toBeTruthy();
  const adminSecret =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET;
  expect(
    adminSecret,
    "PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_SECRET must be available for the bounded smoke",
  ).toBeTruthy();

  await page.goto("/", { waitUntil: "networkidle" });
  const continueButton = page.getByRole("button", {
    name: "Continue to spotlight picks",
  });
  if (!(await continueButton.isEnabled())) {
    await expect(
      page.getByText("Submissions closed", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Your display name" }),
    ).toBeDisabled();
    return;
  }

  await page.getByRole("textbox", { name: "Your display name" }).fill(qaName);
  await continueButton.click();
  await completeSpotlightPicks(page, qaName);
  await page.getByRole("button", { name: "Review all predictions" }).click();
  submissionAttempted = true;
  await page
    .getByRole("dialog", { name: "Review every prediction" })
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
    page.getByRole("heading", { level: 1, name: `${qaName}'s prediction` }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: `${qaName}'s prediction` }),
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
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(adminSecret!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/u);
  await page.goto("/admin/submissions", { waitUntil: "networkidle" });
  const qaRow = page
    .getByRole("list", { name: "All submissions" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: qaName }) });
  await expect(qaRow).toHaveCount(1);
  await expect(qaRow).toContainText("20 positions · 7 spotlight picks");
  page.once("dialog", (dialog) => dialog.accept());
  await qaRow.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Entire submission deleted: table, spotlight picks, and receipt.",
  );
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);

  const [deletionAudit] = await getProductionDb()
    .select({ value: count() })
    .from(adminAuditLogs)
    .where(
      and(
        eq(adminAuditLogs.action, "prediction.deleted"),
        eq(adminAuditLogs.targetType, "prediction"),
        eq(adminAuditLogs.targetId, qaEntryId),
      ),
    );
  expect(deletionAudit?.value ?? 0).toBe(1);
});
