import { mkdir } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  adminAuditLogs,
  predictionCategoryPicks,
  predictionItems,
  predictions,
  seasons,
  standingsImportRunItems,
  standingsImportRuns,
  standingsItems,
  standingsSnapshots,
} from "../../src/db/schema";
import {
  completeSpotlightPicks,
  expectCompletePredictionDraftPersisted,
} from "./spotlight-helpers";

const qaName = `Mobile QA ${Date.now().toString().slice(-8)}`;
let qaEntryId: string | null = null;
let qaSnapshotId: string | null = null;
let qaRunId: string | null = null;
let qaAuditIds: string[] = [];
let qaStartedAt: Date | null = null;
let preexistingSnapshotIds: Set<string> | null = null;
let originalSeason: {
  activeSnapshotId: string | null;
  finalSnapshotId: string | null;
  id: string;
  revealPredictions: boolean;
  standingsAcceptedThrough: Date | null;
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
  const layout = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    window.scrollTo(document.documentElement.scrollWidth, originalScrollY);
    const maximumScrollX = window.scrollX;
    window.scrollTo(originalScrollX, originalScrollY);
    return {
      bodyScroll: document.body.scrollWidth,
      client,
      maximumScrollX,
    };
  });
  expect(
    layout.bodyScroll,
    "The document body must stay within the viewport; wide tables may scroll only inside their labelled containers.",
  ).toBeLessThanOrEqual(layout.client);
  expect(
    layout.maximumScrollX,
    "The page itself must not be horizontally scrollable.",
  ).toBe(0);
}

async function captureAnnotatedEvidence(
  page: import("@playwright/test").Page,
  screenshotDirectory: string | undefined,
  fileName: string,
  title: string,
  notes: readonly string[],
) {
  if (!screenshotDirectory) return;
  await mkdir(screenshotDirectory, { recursive: true });
  await page.evaluate(
    ({ annotationNotes, annotationTitle }) => {
      document.querySelector("[data-qa-evidence-annotation]")?.remove();
      const annotation = document.createElement("aside");
      annotation.dataset.qaEvidenceAnnotation = "true";
      annotation.setAttribute("aria-label", "QA evidence annotation");
      Object.assign(annotation.style, {
        background: "rgba(55, 0, 60, 0.96)",
        border: "2px solid #05f0ff",
        borderRadius: "12px",
        bottom: "8px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        color: "white",
        font: "600 11px/1.35 system-ui, sans-serif",
        left: "8px",
        maxWidth: "calc(100vw - 16px)",
        padding: "9px 11px",
        position: "fixed",
        right: "8px",
        zIndex: "2147483647",
      });
      const heading = document.createElement("strong");
      heading.style.color = "#05f0ff";
      heading.style.display = "block";
      heading.style.marginBottom = "4px";
      heading.textContent = annotationTitle;
      annotation.append(heading);
      annotationNotes.forEach((note, index) => {
        const line = document.createElement("div");
        line.textContent = `${index + 1}. ${note}`;
        annotation.append(line);
      });
      document.body.append(annotation);
    },
    { annotationNotes: notes, annotationTitle: title },
  );
  const annotation = page.locator("[data-qa-evidence-annotation]");
  await expect(annotation).toBeVisible();
  try {
    await page.screenshot({
      animations: "disabled",
      path: path.join(screenshotDirectory, fileName),
    });
  } finally {
    await annotation.evaluate((element) => element.remove());
  }
}

async function capturePlainEvidence(
  page: import("@playwright/test").Page,
  screenshotDirectory: string | undefined,
  fileName: string,
) {
  if (!screenshotDirectory) return;
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: path.join(screenshotDirectory, fileName),
  });
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
  const cleanupEntryIds = new Set<string>();
  if (qaEntryId) cleanupEntryIds.add(qaEntryId);
  if (originalSeason) {
    const recoveredEntries = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(
        and(
          eq(predictions.seasonId, originalSeason.id),
          eq(predictions.participantName, qaName),
        ),
      );
    for (const entry of recoveredEntries) cleanupEntryIds.add(entry.id);
  }

  const cleanupSnapshotIds = new Set<string>();
  if (qaSnapshotId) cleanupSnapshotIds.add(qaSnapshotId);
  const cleanupRunIds = new Set<string>();
  if (qaRunId) cleanupRunIds.add(qaRunId);
  const cleanupAuditIds = new Set(qaAuditIds);

  if (originalSeason && qaStartedAt) {
    const [currentSeason] = await db
      .select({
        activeSnapshotId: seasons.activeSnapshotId,
        finalSnapshotId: seasons.finalSnapshotId,
        revealPredictions: seasons.revealPredictions,
        standingsAcceptedThrough: seasons.standingsAcceptedThrough,
        submissionsLocked: seasons.submissionsLocked,
      })
      .from(seasons)
      .where(eq(seasons.id, originalSeason.id))
      .limit(1);
    if (
      currentSeason?.activeSnapshotId &&
      currentSeason.activeSnapshotId !== originalSeason.activeSnapshotId
    ) {
      cleanupSnapshotIds.add(currentSeason.activeSnapshotId);
    }

    const [recoveredSnapshots, recoveredRuns, recoveredAudits] =
      await Promise.all([
        db
          .select({ id: standingsSnapshots.id })
          .from(standingsSnapshots)
          .where(
            and(
              eq(standingsSnapshots.seasonId, originalSeason.id),
              eq(standingsSnapshots.source, "manual-admin"),
              gte(standingsSnapshots.createdAt, qaStartedAt),
            ),
          ),
        db
          .select({ id: standingsImportRuns.id })
          .from(standingsImportRuns)
          .where(
            and(
              eq(standingsImportRuns.seasonId, originalSeason.id),
              eq(standingsImportRuns.source, "manual-admin"),
              gte(standingsImportRuns.createdAt, qaStartedAt),
            ),
          ),
        db
          .select({ id: adminAuditLogs.id })
          .from(adminAuditLogs)
          .where(
            and(
              eq(adminAuditLogs.seasonId, originalSeason.id),
              inArray(adminAuditLogs.action, [
                "prediction.deleted",
                "season.predictions_revealed_early",
                "standings.manual.saved",
              ]),
              gte(adminAuditLogs.createdAt, qaStartedAt),
            ),
          ),
      ]);
    for (const snapshot of recoveredSnapshots) {
      cleanupSnapshotIds.add(snapshot.id);
    }
    for (const run of recoveredRuns) cleanupRunIds.add(run.id);
    for (const audit of recoveredAudits) cleanupAuditIds.add(audit.id);

    const restored = await db
      .update(seasons)
      .set({
        activeSnapshotId: originalSeason.activeSnapshotId,
        finalSnapshotId: originalSeason.finalSnapshotId,
        revealPredictions: originalSeason.revealPredictions,
        standingsAcceptedThrough: originalSeason.standingsAcceptedThrough,
        submissionsLocked: originalSeason.submissionsLocked,
        updatedAt: originalSeason.updatedAt,
      })
      .where(eq(seasons.id, originalSeason.id))
      .returning({ id: seasons.id });
    expect(
      restored,
      "Cleanup must restore the exact isolated season it inspected.",
    ).toHaveLength(1);
  }

  for (const entryId of cleanupEntryIds) {
    await db.delete(predictions).where(eq(predictions.id, entryId));
    await db.delete(adminAuditLogs).where(eq(adminAuditLogs.targetId, entryId));
  }
  if (cleanupAuditIds.size > 0) {
    await db
      .delete(adminAuditLogs)
      .where(inArray(adminAuditLogs.id, [...cleanupAuditIds]));
  }
  if (cleanupRunIds.size > 0) {
    await db
      .delete(standingsImportRuns)
      .where(inArray(standingsImportRuns.id, [...cleanupRunIds]));
  }
  const createdSnapshotIds = [...cleanupSnapshotIds].filter(
    (snapshotId) => !preexistingSnapshotIds?.has(snapshotId),
  );
  if (createdSnapshotIds.length > 0) {
    await db
      .delete(standingsSnapshots)
      .where(inArray(standingsSnapshots.id, createdSnapshotIds));
  }

  const zeroCounts: Array<PromiseLike<Array<{ value: number }>>> = [];
  if (originalSeason) {
    zeroCounts.push(
      db
        .select({ value: count() })
        .from(predictions)
        .where(
          and(
            eq(predictions.seasonId, originalSeason.id),
            eq(predictions.participantName, qaName),
          ),
        ),
    );
  }
  if (cleanupEntryIds.size > 0) {
    zeroCounts.push(
      db
        .select({ value: count() })
        .from(predictionItems)
        .where(inArray(predictionItems.predictionId, [...cleanupEntryIds])),
      db
        .select({ value: count() })
        .from(predictionCategoryPicks)
        .where(
          inArray(predictionCategoryPicks.predictionId, [...cleanupEntryIds]),
        ),
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(inArray(adminAuditLogs.targetId, [...cleanupEntryIds])),
    );
  }
  if (cleanupAuditIds.size > 0) {
    zeroCounts.push(
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(inArray(adminAuditLogs.id, [...cleanupAuditIds])),
    );
  }
  if (cleanupRunIds.size > 0) {
    zeroCounts.push(
      db
        .select({ value: count() })
        .from(standingsImportRuns)
        .where(inArray(standingsImportRuns.id, [...cleanupRunIds])),
      db
        .select({ value: count() })
        .from(standingsImportRunItems)
        .where(inArray(standingsImportRunItems.runId, [...cleanupRunIds])),
    );
  }
  if (createdSnapshotIds.length > 0) {
    zeroCounts.push(
      db
        .select({ value: count() })
        .from(standingsSnapshots)
        .where(inArray(standingsSnapshots.id, createdSnapshotIds)),
      db
        .select({ value: count() })
        .from(standingsItems)
        .where(inArray(standingsItems.snapshotId, createdSnapshotIds)),
    );
  }
  if (originalSeason && qaStartedAt) {
    zeroCounts.push(
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(
          and(
            eq(adminAuditLogs.seasonId, originalSeason.id),
            inArray(adminAuditLogs.action, [
              "prediction.deleted",
              "season.predictions_revealed_early",
              "standings.manual.saved",
            ]),
            gte(adminAuditLogs.createdAt, qaStartedAt),
          ),
        ),
    );
  }
  for (const [residue] of await Promise.all(zeroCounts)) {
    expect(residue?.value ?? 0).toBe(0);
  }
  if (originalSeason) {
    const [restoredSeason] = await db
      .select({
        activeSnapshotId: seasons.activeSnapshotId,
        finalSnapshotId: seasons.finalSnapshotId,
        revealPredictions: seasons.revealPredictions,
        standingsAcceptedThrough: seasons.standingsAcceptedThrough,
        submissionsLocked: seasons.submissionsLocked,
        updatedAt: seasons.updatedAt,
      })
      .from(seasons)
      .where(eq(seasons.id, originalSeason.id))
      .limit(1);
    expect(restoredSeason).toEqual({
      activeSnapshotId: originalSeason.activeSnapshotId,
      finalSnapshotId: originalSeason.finalSnapshotId,
      revealPredictions: originalSeason.revealPredictions,
      standingsAcceptedThrough: originalSeason.standingsAcceptedThrough,
      submissionsLocked: originalSeason.submissionsLocked,
      updatedAt: originalSeason.updatedAt,
    });
  }

  qaEntryId = null;
  qaSnapshotId = null;
  qaRunId = null;
  qaAuditIds = [];
  qaStartedAt = null;
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
      name: "Build your 2026/27 Premier League table.",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Premier League predicted positions" })
      .getByRole("listitem"),
  ).toHaveCount(20);
  await expect(
    page.getByRole("timer", { name: /until submissions lock$/u }),
  ).toBeVisible();
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
    page.getByRole("heading", { level: 1, name: "Dranx Prediction League" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View spotlight accuracy" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/spotlight");
  await expect(
    page.getByRole("heading", { level: 1, name: "Spotlight accuracy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How spotlight points work" }),
  ).toBeVisible();
  await expect(
    page.getByText(/your pick earns more spotlight points/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the full scoring rules" }),
  ).toHaveAttribute("href", "/rules#spotlight-scoring");
  await expect(page.getByText(/max\(0, N \+ 1/u)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/rules");
  await expect(
    page.getByRole("heading", { level: 1, name: "How to play & scoring" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How to play in three steps" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Mobile .* screen/u }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", { level: 3, name: "Top scorer" }),
  ).toBeVisible();
  await expect(
    page.getByText(/occupied result rank earns max\(0, N \+ 1/u),
  ).toBeVisible();
  await expect(page.getByText(/owner-run Codex automation/i)).toHaveCount(0);
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
  test.setTimeout(180_000);

  const adminSecret =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET;
  const screenshotDirectory =
    testInfo.project.name === "mobile-chromium"
      ? process.env.QA_SCREENSHOT_DIR
      : undefined;
  const walkthroughScreenshotDirectory =
    testInfo.project.name === "mobile-chromium"
      ? process.env.WALKTHROUGH_SCREENSHOT_DIR
      : undefined;
  expect(
    adminSecret,
    "PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_SECRET must be available for E2E",
  ).toBeTruthy();

  qaStartedAt = new Date(Date.now() - 1_000);
  const [seasonBeforeQa] = await getQaDb()
    .select({
      activeSnapshotId: seasons.activeSnapshotId,
      finalSnapshotId: seasons.finalSnapshotId,
      id: seasons.id,
      revealPredictions: seasons.revealPredictions,
      standingsAcceptedThrough: seasons.standingsAcceptedThrough,
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

  await page.goto("/");
  await expect(
    page.getByRole("timer", { name: /until submissions lock$/u }),
  ).toBeVisible();
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

  const touchTarget = page.getByRole("button", {
    name: /^Move AFC Bournemouth,/,
  });
  if (testInfo.project.name === "mobile-chromium") {
    await dragWithChromiumTouch(page, firstHandle, touchTarget);
    if (
      (await table.getByRole("listitem").first().getAttribute("aria-label")) ===
      "Arsenal, predicted position 1 of 20"
    ) {
      await dragWithChromiumTouch(page, firstHandle, touchTarget);
    }
  } else {
    await dragWithWebKitTouch(page, firstHandle, touchTarget);
  }
  await expect(table.getByRole("listitem").first()).not.toHaveAttribute(
    "aria-label",
    /^Arsenal, predicted position 1 of 20$/,
  );

  // A real pointer can resolve to nearby insertion boundaries as rows move
  // beneath it, so keep touch proof independent from the exact scoring fixture.
  // Reset, then use the deterministic keyboard path before submitting.
  await page
    .getByRole("button", {
      name: "Reset prediction table to alphabetical order",
    })
    .click();
  await expect(table.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    /^Arsenal, predicted position 1 of 20$/,
  );
  await page.getByRole("textbox", { name: "Your display name" }).fill(qaName);
  await page
    .getByRole("heading", { name: "Who is making this prediction?" })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await capturePlainEvidence(
    page,
    walkthroughScreenshotDirectory,
    "step-1-table-mobile.png",
  );
  await page
    .getByRole("button", { name: "Continue to spotlight picks" })
    .click();
  const alphabeticalWarning = page.getByRole("dialog", {
    name: "This table is still alphabetical",
  });
  await expect(alphabeticalWarning).toBeVisible();
  await captureAnnotatedEvidence(
    page,
    screenshotDirectory,
    "alphabetical-warning-mobile.png",
    "Intentional A–Z safeguard",
    [
      "The deterministic table is labelled as a blank slate.",
      "Keep editing is safe; Yes, use A–Z records explicit page-memory intent.",
    ],
  );
  await alphabeticalWarning
    .getByRole("button", { name: "Keep editing" })
    .click();
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
  await page
    .getByRole("button", { name: "Continue to spotlight picks" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make your spotlight picks" }),
  ).toBeVisible();
  const customPlayerNames = await completeSpotlightPicks(page, qaName);
  await expectCompletePredictionDraftPersisted(page, qaName);
  await expect(page.getByText(/Draft saved in this browser/u)).toBeVisible();
  await page
    .getByRole("heading", { name: "Make your spotlight picks" })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await capturePlainEvidence(
    page,
    walkthroughScreenshotDirectory,
    "step-2-spotlight-mobile.png",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Make your spotlight picks" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Draft restored from this browser/u),
  ).toBeVisible();
  await expect(
    page.getByText(/^7 of 7 spotlight categories started\./u),
  ).toBeVisible();
  await captureAnnotatedEvidence(
    page,
    screenshotDirectory,
    "draft-restored-mobile.png",
    "Complete browser-local draft restored",
    [
      "Reload returns to Stage 2 with all seven category shapes intact.",
      "Catalogue identities remain server-validated at submission.",
    ],
  );
  await page.getByRole("button", { name: "Review all predictions" }).click();
  const review = page.getByRole("dialog", {
    name: "Review every prediction",
  });
  await expect(review).toBeVisible();
  await expect(review.locator("[data-category]")).toHaveCount(7);
  const reviewTable = review.getByRole("group", {
    name: "Prediction review, positions 1 through 20",
  });
  await expect(reviewTable.locator("li")).toHaveCount(20);
  await expect(reviewTable.getByRole("listitem")).toHaveCount(8);
  const reviewScroller = review.locator(".overflow-y-auto");
  await reviewScroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(() => reviewScroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expectNoHorizontalOverflow(page);
  await reviewScroller.evaluate((scroller) => {
    const table = scroller.querySelector<HTMLElement>(
      '[aria-label="Prediction review, positions 1 through 20"]',
    );
    if (!table) throw new Error("Prediction review table is missing.");
    scroller.scrollTop +=
      table.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  });
  await expect(reviewTable.getByText("Top 5", { exact: true })).toBeVisible();
  await capturePlainEvidence(
    page,
    walkthroughScreenshotDirectory,
    "step-3-review-mobile.png",
  );
  await reviewTable.getByText("Show all 20 clubs", { exact: true }).click();
  await expect(reviewTable.getByRole("listitem")).toHaveCount(20);

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
    page.getByRole("heading", { level: 1, name: `${qaName}'s prediction` }),
  ).toBeVisible();
  await expect(
    page.getByText(customPlayerNames[0]!, { exact: true }),
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
  await expect(page.getByText("Full tables are still private")).toBeVisible();
  const preseasonEntry = page.getByLabel(`${qaName} leaderboard entry`);
  await expect(
    preseasonEntry.getByText("Aston Villa", { exact: true }),
  ).toBeVisible();
  await expect(preseasonEntry.getByText("0", { exact: true })).toBeVisible();
  await expect(preseasonEntry.getByText(/track/u)).toHaveCount(0);
  for (const customPlayerName of customPlayerNames) {
    await expect(
      preseasonEntry.getByText(customPlayerName, { exact: true }),
    ).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page);

  await page.goto("/spotlight?sort=top_scorer");
  await expect(
    page.getByRole("heading", {
      name: "Spotlight picks are still private",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Spotlight accuracy leaderboard")).toHaveCount(
    0,
  );
  await expect(page.getByText(qaName, { exact: true })).toHaveCount(0);
  for (const customPlayerName of customPlayerNames) {
    await expect(page.getByText(customPlayerName, { exact: true })).toHaveCount(
      0,
    );
  }
  await expectNoHorizontalOverflow(page);

  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(adminSecret!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Season control room" }),
  ).toBeVisible();

  await page.goto("/admin/results", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Spotlight results" }),
  ).toBeVisible();
  for (const resultTableName of [
    "Top scorer",
    "Top assister",
    "Most clean sheets",
    "Underdog player ratings",
    "Overrated player ratings",
  ]) {
    await expect(
      page.getByRole("heading", { level: 3, name: resultTableName }),
    ).toBeVisible();
  }
  const topScorerResults = page
    .getByRole("heading", { level: 3, name: "Top scorer" })
    .locator("xpath=ancestor::section");
  await topScorerResults.getByRole("button", { name: "Add row" }).click();
  await topScorerResults
    .getByRole("spinbutton", { name: /^Top scorer Goals for /u })
    .fill("3");
  await expect(
    topScorerResults.getByRole("cell", { exact: true, name: "1" }),
  ).toBeVisible();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(
    1,
  );
  await expectNoHorizontalOverflow(page);
  await topScorerResults.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await capturePlainEvidence(
    page,
    screenshotDirectory,
    "admin-results-mobile.png",
  );

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
  ).toBeVisible({ timeout: 20_000 });

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
  await expect(
    page.getByRole("heading", { level: 2, name: "Fixed submission deadline" }),
  ).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await expect(
    page.getByText("Central Time baseline", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Central Time baseline", { exact: true })
      .locator("xpath=following-sibling::time"),
  ).toContainText(/C(?:S|D)T/u);
  const kickoffZone = page.getByLabel("View kickoff in another time zone");
  await expect(kickoffZone).toHaveValue("America/Chicago");
  await expect(
    kickoffZone.locator("xpath=following-sibling::time"),
  ).toContainText(/C(?:S|D)T/u);
  await kickoffZone.selectOption("UTC");
  await expect(
    kickoffZone.locator("xpath=following-sibling::time"),
  ).toContainText("UTC");
  await expectNoHorizontalOverflow(page);
  await page
    .getByRole("heading", { level: 2, name: "Fixed submission deadline" })
    .scrollIntoViewIfNeeded();
  await captureAnnotatedEvidence(
    page,
    screenshotDirectory,
    "admin-settings-mobile.png",
    "Fixed kickoff and protected closure — isolated QA",
    [
      "The earlier-deadline editor is gone; kickoff is the only deadline.",
      "The same instant is shown in Central Time and the selected IANA zone.",
      "No lock or reveal action was invoked for this evidence image.",
    ],
  );
  await page.getByRole("button", { name: "Reveal predictions early" }).click();
  const revealDialog = page.getByRole("dialog", {
    name: "Reveal predictions early?",
  });
  await revealDialog.getByLabel("Type REVEAL to confirm").fill("REVEAL");
  await revealDialog.getByRole("button", { name: "Confirm REVEAL" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Predictions are public and submissions are permanently closed.",
  );
  const settingsAudits = await getQaDb()
    .select({ id: adminAuditLogs.id })
    .from(adminAuditLogs)
    .where(
      and(
        eq(adminAuditLogs.action, "season.predictions_revealed_early"),
        eq(adminAuditLogs.targetId, originalSeason!.id),
        gte(adminAuditLogs.createdAt, qaStartedAt!),
      ),
    );
  qaAuditIds.push(...settingsAudits.map((audit) => audit.id));

  await page.goto("/leaderboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: qaName })).toBeVisible();
  const revealedPreseasonEntry = page.getByLabel(`${qaName} leaderboard entry`);
  await expect(
    revealedPreseasonEntry.getByText(customPlayerNames[0]!, { exact: true }),
  ).toHaveCount(0);
  await expect(revealedPreseasonEntry.locator("details")).toHaveCount(0);
  await expect(
    revealedPreseasonEntry.getByLabel("Predicted champion: Aston Villa"),
  ).toBeVisible();
  await expect(
    revealedPreseasonEntry.getByText("0", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Everyone starts on 0 points")).toBeVisible();
  await expect(page.getByText("Matchweek 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Provisional", { exact: true })).toBeVisible();

  await page.goto("/spotlight?sort=overall", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Spotlight accuracy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Accuracy rankings are not available yet",
    }),
  ).toBeVisible();
  const spotlightEntry = page.getByLabel(`${qaName} spotlight accuracy entry`);
  await expect(spotlightEntry).toBeVisible();
  await expect(spotlightEntry.getByLabel("Accuracy rank pending")).toHaveText(
    "—",
  );
  await expect(
    spotlightEntry.getByText("result pending", { exact: true }),
  ).toBeVisible();
  const spotlightDetails = spotlightEntry.locator("details");
  if (
    !(await spotlightDetails.evaluate(
      (element) => element instanceof HTMLDetailsElement && element.open,
    ))
  ) {
    await spotlightDetails.locator("summary").click();
  }
  await expect(
    spotlightEntry.getByText(customPlayerNames[0]!, { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/leaderboard");
  await page.getByRole("link", { name: qaName }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${qaName}'s prediction` }),
  ).toBeVisible();
  await expect(page.getByText("96 points", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Not scored")).toHaveCount(20);
  await expectNoHorizontalOverflow(page);

  await page.goto("/admin/submissions", { waitUntil: "networkidle" });
  const submissionRow = page
    .getByRole("list", { name: "All submissions" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: qaName }) });
  await expect(submissionRow).toHaveCount(1);
  await expect(submissionRow).toContainText("20 positions · 7 spotlight picks");
  page.once("dialog", (dialog) => dialog.accept());
  await submissionRow.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Entire submission deleted: table, spotlight picks, and receipt.",
  );
  await expect(page.getByRole("link", { name: qaName })).toHaveCount(0);
  const deletionAudits = await getQaDb()
    .select({ id: adminAuditLogs.id })
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.targetId, qaEntryId!));
  qaAuditIds.push(...deletionAudits.map((audit) => audit.id));

  await page.goto("/leaderboard");
  await expect(page.getByText(qaName, { exact: true })).toHaveCount(0);
  await page.goto("/spotlight");
  await expect(page.getByText(qaName, { exact: true })).toHaveCount(0);
});
