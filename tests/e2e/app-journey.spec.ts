import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { and, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  adminAuditLogs,
  predictions,
  seasons,
  standingsImportRuns,
  standingsSnapshots,
} from "../../src/db/schema";

const qaName = `Mobile QA ${Date.now().toString().slice(-8)}`;
let qaEntryId: string | null = null;
let qaSnapshotId: string | null = null;
let qaRunId: string | null = null;
let qaAuditIds: string[] = [];
let qaStartedAt: Date | null = null;
let qaSnapshotCreatedByRun = false;
let preexistingSnapshotIds: Set<string> | null = null;
let originalSeason: {
  activeSnapshotId: string | null;
  finalSnapshotId: string | null;
  id: string;
  revealPredictions: boolean;
  standingsAcceptedThrough: Date | null;
  submissionDeadline: Date | null;
  submissionsLocked: boolean;
  updatedAt: Date;
} | null = null;

function getQaDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the reversible E2E cleanup.");
  }

  return drizzle(neon(connectionString));
}

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
}

async function handleCenter(
  handle: import("@playwright/test").Locator,
): Promise<{ x: number; y: number }> {
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box, "The drag handle must have a rendered box").not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function dragWithMouse(
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator,
) {
  const start = await handleCenter(source);
  const end = await handleCenter(target);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

async function dragWithChromiumTouch(
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator,
) {
  const start = await handleCenter(source);
  const end = await handleCenter(target);
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, force: 1, id: 0, radiusX: 4, radiusY: 4 }],
    });
    // PointerSensor's touch constraint intentionally requires a 250 ms hold.
    await page.waitForTimeout(300);
    for (let step = 1; step <= 12; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            force: 1,
            id: 0,
            radiusX: 4,
            radiusY: 4,
            x: start.x + ((end.x - start.x) * step) / 12,
            y: start.y + ((end.y - start.y) * step) / 12,
          },
        ],
      });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(50);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

async function dragWithWebKitTouch(
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator,
) {
  const start = await handleCenter(source);
  const end = await handleCenter(target);
  await source.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    clientX: start.x,
    clientY: start.y,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
    pressure: 0.5,
  });
  // PointerSensor's touch constraint intentionally requires a 250 ms hold.
  await page.waitForTimeout(300);

  for (let step = 1; step <= 12; step += 1) {
    await page.evaluate(
      ({ x, y }) => {
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            buttons: 1,
            clientX: x,
            clientY: y,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
            pressure: 0.5,
          }),
        );
      },
      {
        x: start.x + ((end.x - start.x) * step) / 12,
        y: start.y + ((end.y - start.y) * step) / 12,
      },
    );
    await page.waitForTimeout(16);
  }

  await page.evaluate(({ x, y }) => {
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: x,
        clientY: y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        pressure: 0,
      }),
    );
  }, end);
}

test.afterEach(async () => {
  if (!process.env.DATABASE_URL) return;

  const db = getQaDb();
  if (qaEntryId) {
    await db.delete(predictions).where(eq(predictions.id, qaEntryId));
    await db
      .delete(adminAuditLogs)
      .where(eq(adminAuditLogs.targetId, qaEntryId));
  }

  if (originalSeason && qaSnapshotId) {
    await db
      .update(seasons)
      .set({
        activeSnapshotId: originalSeason.activeSnapshotId,
        finalSnapshotId: originalSeason.finalSnapshotId,
        revealPredictions: originalSeason.revealPredictions,
        standingsAcceptedThrough: originalSeason.standingsAcceptedThrough,
        submissionDeadline: originalSeason.submissionDeadline,
        submissionsLocked: originalSeason.submissionsLocked,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(seasons.id, originalSeason.id),
          eq(seasons.activeSnapshotId, qaSnapshotId),
        ),
      );
  }

  if (qaAuditIds.length > 0) {
    await db
      .delete(adminAuditLogs)
      .where(inArray(adminAuditLogs.id, qaAuditIds));
  }
  if (qaRunId) {
    await db
      .delete(standingsImportRuns)
      .where(eq(standingsImportRuns.id, qaRunId));
  }
  if (qaSnapshotId && qaSnapshotCreatedByRun) {
    await db
      .delete(standingsSnapshots)
      .where(eq(standingsSnapshots.id, qaSnapshotId));
  }

  qaEntryId = null;
  qaSnapshotId = null;
  qaRunId = null;
  qaAuditIds = [];
  qaStartedAt = null;
  qaSnapshotCreatedByRun = false;
  preexistingSnapshotIds = null;
  originalSeason = null;
});

test("desktop public routes render the complete league without overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Desktop-only smoke coverage.",
  );

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
  await expectNoHorizontalOverflow(page);

  const firstHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
  const secondHandle = page.getByRole("button", { name: /^Move Aston Villa,/ });
  await dragWithMouse(page, firstHandle, secondHandle);
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem")
      .first(),
  ).toHaveAttribute("aria-label", /^Aston Villa, predicted position 1 of 20$/);

  await page
    .getByRole("button", {
      name: "Reset prediction table to alphabetical order",
    })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem")
      .first(),
  ).toHaveAttribute("aria-label", /^Arsenal, predicted position 1 of 20$/);
  const keyboardHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
  await keyboardHandle.focus();
  await expect(keyboardHandle).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByText(/^Arsenal moved to position 2 of 20\.$/u),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem")
      .first(),
  ).toHaveAttribute("aria-label", /^Aston Villa, predicted position 1 of 20$/);

  await page.goto("/leaderboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Friends leaderboard" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile journey preserves privacy and gives the owner full control", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("mobile-"),
    "Mobile-only end-to-end coverage.",
  );
  test.setTimeout(120_000);

  const adminSecret = process.env.ADMIN_SECRET;
  expect(
    adminSecret,
    "ADMIN_SECRET must be loaded from .env.local",
  ).toBeTruthy();

  qaStartedAt = new Date(Date.now() - 1_000);
  const [seasonBeforeQa] = await getQaDb()
    .select({
      activeSnapshotId: seasons.activeSnapshotId,
      finalSnapshotId: seasons.finalSnapshotId,
      id: seasons.id,
      revealPredictions: seasons.revealPredictions,
      standingsAcceptedThrough: seasons.standingsAcceptedThrough,
      submissionDeadline: seasons.submissionDeadline,
      submissionsLocked: seasons.submissionsLocked,
      updatedAt: seasons.updatedAt,
    })
    .from(seasons)
    .where(eq(seasons.slug, "2026-27"))
    .limit(1);
  originalSeason = seasonBeforeQa ?? null;
  expect(originalSeason, "The seeded 2026/27 season must exist").not.toBeNull();
  const snapshotInventory = await getQaDb()
    .select({ id: standingsSnapshots.id })
    .from(standingsSnapshots)
    .where(eq(standingsSnapshots.seasonId, originalSeason!.id));
  preexistingSnapshotIds = new Set(
    snapshotInventory.map((snapshot) => snapshot.id),
  );
  expect(originalSeason?.finalSnapshotId).toBeNull();
  expect(originalSeason?.revealPredictions).toBe(false);
  expect(originalSeason?.submissionsLocked).toBe(false);
  expect(
    !originalSeason?.submissionDeadline ||
      originalSeason.submissionDeadline.getTime() > Date.now(),
  ).toBe(true);

  await page.goto("/");
  const table = page.getByRole("list", {
    name: "Premier League predicted positions",
  });
  await expect(table.getByRole("listitem")).toHaveCount(20);
  await expectNoHorizontalOverflow(page);

  const firstHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
  const firstHandleBox = await firstHandle.boundingBox();
  expect(firstHandleBox?.width).toBeGreaterThanOrEqual(56);
  expect(firstHandleBox?.height).toBeGreaterThanOrEqual(56);
  expect(
    await firstHandle.evaluate(
      (element) => getComputedStyle(element).touchAction,
    ),
  ).toBe("none");

  const secondHandle = page.getByRole("button", { name: /^Move Aston Villa,/ });
  if (testInfo.project.name === "mobile-chromium") {
    await dragWithChromiumTouch(page, firstHandle, secondHandle);
  } else {
    await dragWithWebKitTouch(page, firstHandle, secondHandle);
  }
  await expect(table.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    /^Aston Villa, predicted position 1 of 20$/,
  );

  // A real pointer can resolve to either adjacent insertion boundary as rows
  // move beneath it, so keep touch proof independent from the exact scoring
  // fixture. Reset, then use the deterministic keyboard path to place Arsenal
  // second before submitting.
  await page
    .getByRole("button", {
      name: "Reset prediction table to alphabetical order",
    })
    .click();
  await expect(table.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    /^Arsenal, predicted position 1 of 20$/,
  );
  const keyboardHandle = page.getByRole("button", { name: /^Move Arsenal,/ });
  await keyboardHandle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByText(/^Arsenal moved to position 2 of 20\.$/u),
  ).toBeVisible();
  await expect(table.getByRole("listitem").nth(1)).toHaveAttribute(
    "aria-label",
    /^Arsenal, predicted position 2 of 20$/,
  );

  await page.getByRole("textbox", { name: "Your display name" }).fill(qaName);
  await page.getByRole("button", { name: "Review your 1–20" }).click();
  const review = page.getByRole("dialog", { name: "Check your 1–20" });
  await expect(review).toBeVisible();
  await expect(
    review
      .getByRole("list", { name: "Prediction review, positions 1 through 20" })
      .getByRole("listitem"),
  ).toHaveCount(20);
  await expectNoHorizontalOverflow(page);

  await review.getByRole("button", { name: "Submit prediction" }).click();
  await expect(page.getByText(`You’re in, ${qaName}.`)).toBeVisible();
  const confirmationLink = page.getByRole("link", {
    name: "View confirmation",
  });
  const entryPath = await confirmationLink.getAttribute("href");
  expect(entryPath).toMatch(/^\/entries\/[0-9a-f-]{36}$/u);
  qaEntryId = entryPath?.split("/").at(-1) ?? null;
  expect(qaEntryId).toBeTruthy();

  await confirmationLink.click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${qaName}'s table` }),
  ).toBeVisible();
  await expect(
    page.getByText("Only this browser can see the table"),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const privateContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  const privatePage = await privateContext.newPage();
  await privatePage.goto(entryPath!);
  await expect(
    privatePage.getByRole("heading", {
      level: 1,
      name: "That page is offside.",
    }),
  ).toBeVisible();
  await privateContext.close();

  await page.goto("/leaderboard");
  await expect(page.getByText(qaName, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: qaName, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Tables are still private")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/admin/login");
  await page.getByLabel("Admin secret").fill(adminSecret!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Season control room" }),
  ).toBeVisible();

  await page.goto("/admin/standings", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Current standings" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Premier League actual positions" })
      .getByRole("listitem"),
  ).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Save provisional standings" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Matchweek (optional)").fill("1");
  if (originalSeason?.activeSnapshotId) {
    page.once("dialog", (dialog) => dialog.accept());
  }
  await page
    .getByRole("button", { name: "Save provisional standings" })
    .click();
  await expect(
    page.getByText("The validated provisional table is now active.", {
      exact: true,
    }),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const [currentSeason] = await getQaDb()
        .select({ activeSnapshotId: seasons.activeSnapshotId })
        .from(seasons)
        .where(eq(seasons.id, originalSeason!.id))
        .limit(1);
      return currentSeason?.activeSnapshotId;
    })
    .not.toBe(originalSeason?.activeSnapshotId);
  const [seasonAfterStandings] = await getQaDb()
    .select({ activeSnapshotId: seasons.activeSnapshotId })
    .from(seasons)
    .where(eq(seasons.id, originalSeason!.id))
    .limit(1);
  qaSnapshotId = seasonAfterStandings?.activeSnapshotId ?? null;
  expect(qaSnapshotId).toBeTruthy();
  qaSnapshotCreatedByRun = !preexistingSnapshotIds!.has(qaSnapshotId!);

  const [createdRun] = await getQaDb()
    .select({ id: standingsImportRuns.id })
    .from(standingsImportRuns)
    .where(
      and(
        eq(standingsImportRuns.snapshotId, qaSnapshotId!),
        gte(standingsImportRuns.createdAt, qaStartedAt!),
      ),
    )
    .limit(1);
  qaRunId = createdRun?.id ?? null;
  const snapshotAudits = await getQaDb()
    .select({ id: adminAuditLogs.id })
    .from(adminAuditLogs)
    .where(
      and(
        eq(adminAuditLogs.targetId, qaSnapshotId!),
        gte(adminAuditLogs.createdAt, qaStartedAt!),
      ),
    );
  qaAuditIds.push(...snapshotAudits.map((audit) => audit.id));

  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  await page
    .getByRole("checkbox", { name: /Reveal predictions early/u })
    .check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Save season settings" }).click();
  await expect(page).toHaveURL(/\/admin\/settings\?saved=1$/u);
  await expect(page.getByRole("status")).toContainText(
    "Season settings saved.",
  );
  const settingsAudits = await getQaDb()
    .select({ id: adminAuditLogs.id })
    .from(adminAuditLogs)
    .where(
      and(
        eq(adminAuditLogs.action, "season.settings.updated"),
        eq(adminAuditLogs.targetId, originalSeason!.id),
        gte(adminAuditLogs.createdAt, qaStartedAt!),
      ),
    );
  qaAuditIds.push(...settingsAudits.map((audit) => audit.id));

  await page.goto("/leaderboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: qaName })).toBeVisible();
  await expect(page.getByText("96", { exact: true })).toBeVisible();
  await expect(page.getByText("Matchweek 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Provisional", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: qaName }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${qaName}'s table` }),
  ).toBeVisible();
  await expect(page.getByText("96 points", { exact: true })).toBeVisible();
  await expect(
    page.getByText("3 · Within 3", { exact: true }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/admin/submissions", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: qaName })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Submission and all 20 position rows deleted.",
  );
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);
  const deletionAudits = await getQaDb()
    .select({ id: adminAuditLogs.id })
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.targetId, qaEntryId!));
  qaAuditIds.push(...deletionAudits.map((audit) => audit.id));

  await page.goto("/leaderboard");
  await expect(page.getByText(qaName, { exact: true })).toHaveCount(0);
});
