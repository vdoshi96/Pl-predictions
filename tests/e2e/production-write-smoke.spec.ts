import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
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
const spotlightSorts = [
  "overall",
  "top_scorer",
  "top_assister",
  "most_clean_sheets",
  "underdog_team",
  "overrated_team",
  "underdog_player",
  "overrated_player",
] as const;

test.describe.configure({ retries: 0 });

function getProductionDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for exact production cleanup.");
  }
  return drizzle(neon(connectionString));
}

async function deleteQaEntryThroughAdmin(page: Page, adminPassword: string) {
  await page.goto("/admin/submissions", { waitUntil: "networkidle" });
  if (new URL(page.url()).pathname === "/admin/login") {
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page).toHaveURL(/\/admin$/u);
    await page.goto("/admin/submissions", { waitUntil: "networkidle" });
  }

  const qaRow = page
    .getByRole("list", { name: "All submissions" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: qaName }) });
  if ((await qaRow.count()) !== 1) return false;

  page.once("dialog", (dialog) => dialog.accept());
  await qaRow.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);
  return true;
}

test.afterEach(async () => {
  if ((!submissionAttempted && !qaEntryId) || !process.env.DATABASE_URL) return;

  const expectedEntryId = qaEntryId;
  const db = getProductionDb();
  const matchingEntries = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(eq(predictions.participantName, qaName))
    .limit(3);

  const recoveredEntryId = matchingEntries[0]?.id ?? null;
  const cleanupEntryIds = new Set<string>();
  if (expectedEntryId) cleanupEntryIds.add(expectedEntryId);
  for (const matchingEntry of matchingEntries) {
    cleanupEntryIds.add(matchingEntry.id);
  }

  for (const cleanupEntryId of cleanupEntryIds) {
    await db
      .delete(predictions)
      .where(
        and(
          eq(predictions.id, cleanupEntryId),
          eq(predictions.participantName, qaName),
        ),
      );
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
  const cleanupResidue = await Promise.all(
    [...cleanupEntryIds].map(async (cleanupEntryId) => {
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
      return {
        audit: auditResidue?.value ?? 0,
        items: itemResidue?.value ?? 0,
        picks: pickResidue?.value ?? 0,
      };
    }),
  );

  qaEntryId = null;
  submissionAttempted = false;

  expect(
    matchingEntries.length,
    "The generated production QA name must identify at most one entry",
  ).toBeLessThanOrEqual(1);
  if (expectedEntryId && recoveredEntryId) {
    expect(recoveredEntryId).toBe(expectedEntryId);
  }
  expect(parentResidue?.value ?? 0).toBe(0);
  for (const residue of cleanupResidue) {
    expect(residue.items).toBe(0);
    expect(residue.picks).toBe(0);
    expect(residue.audit).toBe(0);
  }
});

test("production enforces its current submission state and cleans any QA entry", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(
    process.env.ALLOW_PRODUCTION_WRITE_SMOKE !== "1" ||
      !process.env.PLAYWRIGHT_BASE_URL,
    "Explicitly enable the bounded production write smoke.",
  );

  expect(
    process.env.DATABASE_URL,
    "DATABASE_URL is required before the bounded smoke can create a QA entry",
  ).toBeTruthy();
  expect(new URL(process.env.PLAYWRIGHT_BASE_URL!).origin).toBe(
    "https://pl-predictions-2026.vercel.app",
  );
  expect(
    testInfo.project.name,
    "The bounded production write smoke must use its mobile-chromium project",
  ).toBe("mobile-chromium");
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  expect(
    adminPassword,
    "PLAYWRIGHT_ADMIN_PASSWORD must be available for the bounded smoke",
  ).toBeTruthy();

  await page.goto("/", { waitUntil: "networkidle" });
  const continueButton = page.getByRole("button", {
    name: "Continue to spotlight picks",
  });
  const participantName = page.getByRole("textbox", {
    name: "Your display name",
  });
  if (!(await participantName.isEnabled())) {
    await expect(
      page.getByText("Submissions closed", { exact: true }),
    ).toBeVisible();
    await expect(participantName).toBeDisabled();
    return;
  }

  await participantName.fill(qaName);
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  const privatePlayerNames = await completeSpotlightPicks(page, qaName);
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

  const [boundEntry] = await getProductionDb()
    .select({ id: predictions.id })
    .from(predictions)
    .where(
      and(
        eq(predictions.id, qaEntryId),
        eq(predictions.participantName, qaName),
      ),
    )
    .limit(1);
  if (!boundEntry) {
    const deletedThroughAdmin = await deleteQaEntryThroughAdmin(
      page,
      adminPassword!,
    );
    expect(
      deletedThroughAdmin,
      "A database/origin mismatch must still remove the exact live QA entry",
    ).toBe(true);
  }
  expect(
    boundEntry,
    "DATABASE_URL must contain the exact entry created through the production origin",
  ).toEqual({ id: qaEntryId });

  const htmlResponse = await page.request.get("/leaderboard", {
    headers: { accept: "text/html" },
  });
  expect(htmlResponse.ok()).toBe(true);
  const rawHtml = await htmlResponse.text();
  expect(rawHtml).toContain(qaName);
  expect(rawHtml).not.toContain(qaEntryId);
  for (const privatePlayerName of privatePlayerNames) {
    expect(rawHtml).not.toContain(privatePlayerName);
  }

  const rscResponse = await page.request.get("/leaderboard?_rsc=privacy", {
    headers: { accept: "text/x-component", rsc: "1" },
  });
  expect(rscResponse.ok()).toBe(true);
  const rawRsc = await rscResponse.text();
  expect(rawRsc).toContain(qaName);
  expect(rawRsc).not.toContain(qaEntryId);
  for (const privatePlayerName of privatePlayerNames) {
    expect(rawRsc).not.toContain(privatePlayerName);
  }

  for (const spotlightSort of spotlightSorts) {
    const spotlightHtmlResponse = await page.request.get(
      `/spotlight?sort=${spotlightSort}`,
      { headers: { accept: "text/html" } },
    );
    expect(spotlightHtmlResponse.ok()).toBe(true);
    const spotlightHtml = await spotlightHtmlResponse.text();
    expect(spotlightHtml).not.toContain("Spotlight accuracy leaderboard");
    expect(spotlightHtml).not.toContain(qaName);
    expect(spotlightHtml).not.toContain(qaEntryId);
    for (const privatePlayerName of privatePlayerNames) {
      expect(spotlightHtml).not.toContain(privatePlayerName);
    }

    const spotlightRscResponse = await page.request.get(
      `/spotlight?sort=${spotlightSort}&_rsc=privacy-${spotlightSort}`,
      { headers: { accept: "text/x-component", rsc: "1" } },
    );
    expect(spotlightRscResponse.ok()).toBe(true);
    const spotlightRsc = await spotlightRscResponse.text();
    expect(spotlightRsc).not.toContain("Spotlight accuracy leaderboard");
    expect(spotlightRsc).not.toContain(qaName);
    expect(spotlightRsc).not.toContain(qaEntryId);
    for (const privatePlayerName of privatePlayerNames) {
      expect(spotlightRsc).not.toContain(privatePlayerName);
    }
  }

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
  await freshPage.goto("/spotlight?sort=top_scorer");
  await expect(
    freshPage.getByRole("heading", { level: 1, name: "Spotlight accuracy" }),
  ).toBeVisible();
  await expect(
    freshPage.getByRole("heading", {
      name: "Spotlight picks are still private",
    }),
  ).toBeVisible();
  await expect(
    freshPage.getByLabel("Spotlight accuracy leaderboard"),
  ).toHaveCount(0);
  await expect(freshPage.getByText(qaName, { exact: true })).toHaveCount(0);
  await freshContext.close();

  await page.goto("/leaderboard");
  await expect(page.getByText(qaName, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);

  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(adminPassword!);
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
