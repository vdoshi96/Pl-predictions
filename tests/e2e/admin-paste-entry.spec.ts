import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  adminAuditLogs,
  seasons,
  standingsImportRuns,
  standingsItems,
  standingsSnapshots,
} from "@/db/schema";
import { PREMIER_LEAGUE_2026_27_TEAMS } from "../../src/data/teams";

type SeasonState = Readonly<{
  activeSnapshotId: string | null;
  finalSnapshotId: string | null;
  id: string;
  revealPredictions: boolean;
  standingsAcceptedThrough: Date | null;
  submissionsLocked: boolean;
  updatedAt: Date;
}>;

let originalSeason: SeasonState | null = null;
let preexistingSnapshotIds: Set<string> | null = null;
let qaStartedAt: Date | null = null;

function getQaDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the reversible E2E cleanup.");
  }

  return drizzle(neon(connectionString));
}

async function loginAsAdmin(page: Page) {
  const adminPassword =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET;
  if (!adminPassword) {
    throw new Error(
      "PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_SECRET must be available for E2E",
    );
  }
  await page.goto("/admin/login");
  await page
    .getByLabel(/username/i)
    .fill(process.env.PLAYWRIGHT_ADMIN_USERNAME ?? "admin");
  await page.getByLabel(/password/i).fill(adminPassword);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/admin/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Season control room" }),
  ).toBeVisible();
}

async function captureSeasonState() {
  qaStartedAt = new Date(Date.now() - 1_000);
  const db = getQaDb();
  const [season] = await db
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
  originalSeason = season ?? null;
  expect(originalSeason, "The seeded 2026/27 season must exist").not.toBeNull();
  const snapshots = await db
    .select({ id: standingsSnapshots.id })
    .from(standingsSnapshots)
    .where(eq(standingsSnapshots.seasonId, originalSeason!.id));
  preexistingSnapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));
}

test.afterEach(async () => {
  if (!originalSeason || !qaStartedAt || !process.env.DATABASE_URL) return;

  const db = getQaDb();
  const [createdSnapshots, createdRuns, createdAudits] = await Promise.all([
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
          eq(adminAuditLogs.action, "standings.manual.saved"),
          gte(adminAuditLogs.createdAt, qaStartedAt),
        ),
      ),
  ]);
  const createdSnapshotIds = createdSnapshots
    .map((snapshot) => snapshot.id)
    .filter((snapshotId) => !preexistingSnapshotIds?.has(snapshotId));
  const createdRunIds = createdRuns.map((run) => run.id);
  const createdAuditIds = createdAudits.map((audit) => audit.id);

  await db
    .update(seasons)
    .set({
      activeSnapshotId: originalSeason.activeSnapshotId,
      finalSnapshotId: originalSeason.finalSnapshotId,
      revealPredictions: originalSeason.revealPredictions,
      standingsAcceptedThrough: originalSeason.standingsAcceptedThrough,
      submissionsLocked: originalSeason.submissionsLocked,
      updatedAt: originalSeason.updatedAt,
    })
    .where(eq(seasons.id, originalSeason.id));
  if (createdAuditIds.length > 0) {
    await db
      .delete(adminAuditLogs)
      .where(inArray(adminAuditLogs.id, createdAuditIds));
  }
  if (createdRunIds.length > 0) {
    await db
      .delete(standingsImportRuns)
      .where(inArray(standingsImportRuns.id, createdRunIds));
  }
  if (createdSnapshotIds.length > 0) {
    await db
      .delete(standingsSnapshots)
      .where(inArray(standingsSnapshots.id, createdSnapshotIds));
  }

  const residueChecks = [];
  if (createdAuditIds.length > 0) {
    residueChecks.push(
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(inArray(adminAuditLogs.id, createdAuditIds)),
    );
  }
  if (createdRunIds.length > 0) {
    residueChecks.push(
      db
        .select({ value: count() })
        .from(standingsImportRuns)
        .where(inArray(standingsImportRuns.id, createdRunIds)),
    );
  }
  if (createdSnapshotIds.length > 0) {
    residueChecks.push(
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
  for (const [residue] of await Promise.all(residueChecks)) {
    expect(residue?.value ?? 0).toBe(0);
  }

  const [restoredSeason] = await db
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
    .where(eq(seasons.id, originalSeason.id))
    .limit(1);
  expect(restoredSeason).toEqual(originalSeason);

  originalSeason = null;
  preexistingSnapshotIds = null;
  qaStartedAt = null;
});

test.describe("admin paste entry", () => {
  test("standings paste journey parses, diffs, and saves a table", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name !== "chromium",
      "One isolated desktop journey owns and reverses the standings mutation.",
    );
    await captureSeasonState();
    test.skip(
      Boolean(originalSeason?.finalSnapshotId),
      "The isolated season already has final standings.",
    );

    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Standings", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/standings$/u);
    await expect(
      page.getByRole("heading", { level: 1, name: "Current standings" }),
    ).toBeVisible();
    const textarea = page.getByLabel("Pasted table text");
    await textarea.fill("");
    await expect(
      page.getByRole("button", { name: "Parse table" }),
    ).toBeDisabled();

    const fixture = [
      "Pos Club Played Pts",
      ...[...PREMIER_LEAGUE_2026_27_TEAMS]
        .reverse()
        .map(
          (team, index) => `${index + 1} ${team.displayName} 19 ${60 - index}`,
        ),
    ].join("\n");
    await textarea.fill(fixture);
    await page.getByRole("button", { name: "Parse table" }).click();

    await expect(
      page.getByRole("cell", { name: "OK", exact: true }),
    ).toHaveCount(20);
    await expect(page.getByText(/\d+ of 20 rows differ/u)).toBeVisible();
    const saveButton = page.getByRole("button", {
      name: "Save pasted table",
    });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(
      page.getByText("The validated provisional table is now active.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });

    const leaderboardPage = await page.context().newPage();
    await leaderboardPage.goto("/leaderboard", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      leaderboardPage.getByRole("heading", {
        level: 1,
        name: "Dranx Prediction League",
      }),
    ).toBeVisible({ timeout: 20_000 });
    await leaderboardPage.close();
  });

  test("results desk exposes seed and paste affordances after reveal", async ({
    page,
  }) => {
    const [season] = await getQaDb()
      .select({ revealPredictions: seasons.revealPredictions })
      .from(seasons)
      .where(eq(seasons.slug, "2026-27"))
      .limit(1);
    test.skip(
      !season?.revealPredictions,
      "The isolated season has not revealed predictions.",
    );

    await loginAsAdmin(page);
    await page.goto("/admin/results");
    await expect(
      page.getByRole("heading", { name: "Spotlight results" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Seed from submissions" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /paste top scorer list/i }),
    ).toBeVisible();
  });
});
