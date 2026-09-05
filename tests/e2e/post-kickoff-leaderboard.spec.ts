import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  predictionCategoryPicks,
  predictionItems,
  predictions,
  players,
  seasons,
  standingsItems,
  standingsSnapshots,
  teams,
} from "../../src/db/schema";

const scoredProjects = new Set([
  "chromium",
  "mobile-chromium",
  "mobile-webkit",
  "reflow-320-chromium",
  "reflow-430-chromium",
]);
const preKickoffCapturedAt = new Date("2026-08-21T18:55:00.000Z");
const postKickoffCapturedAt = new Date("2026-08-21T19:05:00.000Z");

type OriginalSeasonState = typeof seasons.$inferSelect;

type QaFixture = {
  exactName: string;
  originalSeason: OriginalSeasonState;
  predictionIds: string[];
  seasonUpdated: boolean;
  snapshotId: string;
  swappedName: string;
};

function spotlightRowsFor(
  predictionId: string,
  seasonTeams: readonly (typeof teams.$inferSelect)[],
  opinionPlayers: readonly (typeof players.$inferSelect)[],
  label: string,
): (typeof predictionCategoryPicks.$inferInsert)[] {
  const [underdogTeam, overratedTeam, cleanSheetsTeam] = seasonTeams;
  if (!underdogTeam || !overratedTeam || !cleanSheetsTeam) {
    throw new Error("Three seeded teams are required for spotlight picks.");
  }
  const [underdogPlayer, overratedPlayer] = opinionPlayers;
  if (!underdogPlayer || !overratedPlayer) {
    throw new Error("Two seeded players are required for opinion picks.");
  }

  return [
    {
      category: "top_scorer",
      customPlayerName: `${label} scorer`,
      normalizedCustomPlayerName: `${label} scorer`.toLowerCase(),
      predictionId,
    },
    {
      category: "top_assister",
      customPlayerName: `${label} assister`,
      normalizedCustomPlayerName: `${label} assister`.toLowerCase(),
      predictionId,
    },
    {
      category: "most_clean_sheets",
      predictionId,
      teamId: cleanSheetsTeam.id,
    },
    {
      category: "underdog_team",
      predictionId,
      teamId: underdogTeam.id,
    },
    {
      category: "overrated_team",
      predictionId,
      teamId: overratedTeam.id,
    },
    {
      category: "underdog_player",
      playerId: underdogPlayer.id,
      predictionId,
    },
    {
      category: "overrated_player",
      playerId: overratedPlayer.id,
      predictionId,
    },
  ];
}

let qaFixture: QaFixture | null = null;

function getQaDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for the isolated post-kickoff leaderboard test.",
    );
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

test.afterEach(async () => {
  if (!qaFixture || !process.env.DATABASE_URL) return;

  const fixture = qaFixture;
  qaFixture = null;
  const db = getQaDb();
  let guardedRestoreCount: number | null = null;

  if (fixture.seasonUpdated) {
    const restored = await db
      .update(seasons)
      .set({
        activeSnapshotId: fixture.originalSeason.activeSnapshotId,
        finalSnapshotId: fixture.originalSeason.finalSnapshotId,
        revealPredictions: fixture.originalSeason.revealPredictions,
        standingsAcceptedThrough:
          fixture.originalSeason.standingsAcceptedThrough,
        submissionsLocked: fixture.originalSeason.submissionsLocked,
        updatedAt: fixture.originalSeason.updatedAt,
      })
      .where(
        and(
          eq(seasons.id, fixture.originalSeason.id),
          eq(seasons.activeSnapshotId, fixture.snapshotId),
        ),
      )
      .returning({ id: seasons.id });
    guardedRestoreCount = restored.length;

    if (restored.length !== 1) {
      await db
        .update(seasons)
        .set({
          activeSnapshotId: fixture.originalSeason.activeSnapshotId,
          finalSnapshotId: fixture.originalSeason.finalSnapshotId,
          revealPredictions: fixture.originalSeason.revealPredictions,
          standingsAcceptedThrough:
            fixture.originalSeason.standingsAcceptedThrough,
          submissionsLocked: fixture.originalSeason.submissionsLocked,
          updatedAt: fixture.originalSeason.updatedAt,
        })
        .where(eq(seasons.id, fixture.originalSeason.id));
    }
  }

  await db
    .delete(predictions)
    .where(inArray(predictions.id, fixture.predictionIds));
  await db
    .delete(standingsSnapshots)
    .where(eq(standingsSnapshots.id, fixture.snapshotId));

  const [
    remainingPredictions,
    remainingPredictionItems,
    remainingPredictionCategoryPicks,
    remainingSnapshots,
    remainingStandingsItems,
    restoredSeasons,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(predictions)
      .where(inArray(predictions.id, fixture.predictionIds)),
    db
      .select({ value: count() })
      .from(predictionItems)
      .where(inArray(predictionItems.predictionId, fixture.predictionIds)),
    db
      .select({ value: count() })
      .from(predictionCategoryPicks)
      .where(
        inArray(predictionCategoryPicks.predictionId, fixture.predictionIds),
      ),
    db
      .select({ value: count() })
      .from(standingsSnapshots)
      .where(eq(standingsSnapshots.id, fixture.snapshotId)),
    db
      .select({ value: count() })
      .from(standingsItems)
      .where(eq(standingsItems.snapshotId, fixture.snapshotId)),
    db
      .select()
      .from(seasons)
      .where(eq(seasons.id, fixture.originalSeason.id))
      .limit(1),
  ]);

  expect(remainingPredictions[0]?.value).toBe(0);
  expect(remainingPredictionItems[0]?.value).toBe(0);
  expect(remainingPredictionCategoryPicks[0]?.value).toBe(0);
  expect(remainingSnapshots[0]?.value).toBe(0);
  expect(remainingStandingsItems[0]?.value).toBe(0);

  const restoredSeason = restoredSeasons[0];
  expect(restoredSeason).toBeDefined();
  expect(restoredSeason).toEqual(fixture.originalSeason);
  if (guardedRestoreCount !== null) {
    expect(
      guardedRestoreCount,
      "The active season must still point at the exact QA snapshot during cleanup.",
    ).toBe(1);
  }
});

test("post-kickoff table and spotlight rankings stay split at desktop and mobile widths", async ({
  page,
}, testInfo) => {
  test.skip(
    !scoredProjects.has(testInfo.project.name),
    "Scored leaderboard coverage runs at desktop and exact 320/430px mobile widths.",
  );
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);

  const db = getQaDb();
  const [originalSeason] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.slug, "2026-27"))
    .limit(1);
  expect(
    originalSeason,
    "The isolated database must contain the active season.",
  ).toBeDefined();
  expect(
    originalSeason?.submissionDeadline,
    "The legacy earlier-deadline field must remain an untouched null sentinel.",
  ).toBeNull();

  const [existingPredictionCount] = await db
    .select({ value: count() })
    .from(predictions)
    .where(eq(predictions.seasonId, originalSeason!.id));
  expect(
    existingPredictionCount?.value,
    "The isolated season must not contain residue from another browser test.",
  ).toBe(0);

  const seasonTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.seasonId, originalSeason!.id))
    .orderBy(asc(teams.sortName), asc(teams.displayName));
  expect(seasonTeams).toHaveLength(20);
  expect(seasonTeams[0]?.slug).toBe("arsenal");
  expect(seasonTeams[1]?.slug).toBe("aston-villa");
  const seasonPlayers = await db
    .select()
    .from(players)
    .where(eq(players.seasonId, originalSeason!.id))
    .orderBy(asc(players.displayName))
    .limit(4);
  expect(seasonPlayers).toHaveLength(4);

  const runId = randomUUID();
  const suffix = runId.slice(0, 8);
  const predictionIds: string[] = [randomUUID(), randomUUID()];
  const snapshotId = randomUUID();
  const exactName = `Post-kickoff exact champion ${suffix}`;
  const swappedName = `Post-kickoff swapped champion ${suffix}`;
  const swappedPredictionTeams = [
    seasonTeams[1]!,
    seasonTeams[0]!,
    ...seasonTeams.slice(2),
  ];

  qaFixture = {
    exactName,
    originalSeason: originalSeason!,
    predictionIds,
    seasonUpdated: false,
    snapshotId,
    swappedName,
  };

  await db.insert(predictions).values([
    {
      createdAt: new Date("2026-08-21T18:50:00.000Z"),
      id: predictionIds[0],
      normalizedParticipantName: exactName.toLowerCase(),
      participantName: exactName,
      seasonId: originalSeason!.id,
      updatedAt: new Date("2026-08-21T18:50:00.000Z"),
    },
    {
      createdAt: new Date("2026-08-21T18:51:00.000Z"),
      id: predictionIds[1],
      normalizedParticipantName: swappedName.toLowerCase(),
      participantName: swappedName,
      seasonId: originalSeason!.id,
      updatedAt: new Date("2026-08-21T18:51:00.000Z"),
    },
  ]);
  await db.insert(predictionItems).values([
    ...seasonTeams.map((team, index) => ({
      predictedPosition: index + 1,
      predictionId: predictionIds[0],
      teamId: team.id,
    })),
    ...swappedPredictionTeams.map((team, index) => ({
      predictedPosition: index + 1,
      predictionId: predictionIds[1],
      teamId: team.id,
    })),
  ]);
  await db
    .insert(predictionCategoryPicks)
    .values([
      ...spotlightRowsFor(
        predictionIds[0],
        seasonTeams,
        seasonPlayers.slice(0, 2),
        `${suffix} exact`,
      ),
      ...spotlightRowsFor(
        predictionIds[1],
        seasonTeams,
        seasonPlayers.slice(2, 4),
        `${suffix} swapped`,
      ),
    ]);
  await db.insert(standingsSnapshots).values({
    capturedAt: preKickoffCapturedAt,
    contentHash: runId.replaceAll("-", "").repeat(2),
    id: snapshotId,
    isFinal: false,
    matchweek: 1,
    seasonId: originalSeason!.id,
    source: `post-kickoff-e2e-${suffix}`,
    sourceUpdatedAt: preKickoffCapturedAt,
  });
  await db.insert(standingsItems).values(
    seasonTeams.map((team, index) => ({
      actualPosition: index + 1,
      leaguePoints: team.slug === "arsenal" ? 3 : 0,
      playedGames:
        team.slug === "arsenal" || team.slug === "coventry-city" ? 1 : 0,
      snapshotId,
      teamId: team.id,
    })),
  );

  const activePointerGuard = originalSeason!.activeSnapshotId
    ? eq(seasons.activeSnapshotId, originalSeason!.activeSnapshotId)
    : isNull(seasons.activeSnapshotId);
  const activated = await db
    .update(seasons)
    .set({
      activeSnapshotId: snapshotId,
      finalSnapshotId: null,
      revealPredictions: true,
      standingsAcceptedThrough: preKickoffCapturedAt,
      submissionsLocked: true,
      updatedAt: preKickoffCapturedAt,
    })
    .where(and(eq(seasons.id, originalSeason!.id), activePointerGuard))
    .returning({ id: seasons.id });
  expect(
    activated,
    "The test must claim the exact active-season state it inspected.",
  ).toHaveLength(1);
  qaFixture.seasonUpdated = true;

  await page.goto("/leaderboard", { waitUntil: "networkidle" });
  await expect(
    page.getByText("Waiting for the first active table"),
  ).toBeVisible();
  const staleExactEntry = page.getByLabel(`${exactName} leaderboard entry`);
  const staleSwappedEntry = page.getByLabel(`${swappedName} leaderboard entry`);
  await expect(staleExactEntry.getByText("0", { exact: true })).toBeVisible();
  await expect(staleSwappedEntry.getByText("0", { exact: true })).toBeVisible();
  await expect(staleExactEntry.getByText(/track/u)).toHaveCount(0);
  await expect(staleSwappedEntry.getByText(/track/u)).toHaveCount(0);
  await expect(
    staleExactEntry.getByText(`${suffix} exact scorer`, { exact: true }),
  ).toHaveCount(0);
  await expect(staleExactEntry.locator("details")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "View separate spotlight accuracy" }),
  ).toBeVisible();

  await page.goto("/spotlight?view=entries&sort=overall", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Who called it?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Accuracy rankings are not available yet",
    }),
  ).toBeVisible();
  const pendingAccuracyList = page.getByLabel("Spotlight accuracy leaderboard");
  await expect(pendingAccuracyList.getByRole("article")).toHaveCount(2);
  const pendingExactEntry = page.getByLabel(
    `${exactName} spotlight accuracy entry`,
  );
  await expect(
    pendingExactEntry.getByLabel("Accuracy rank pending"),
  ).toHaveText("—");
  await expect(
    pendingExactEntry.getByText("result pending", { exact: true }),
  ).toBeVisible();
  const pendingExactDetails = pendingExactEntry.locator("details");
  if (
    !(await pendingExactDetails.evaluate(
      (element) => element instanceof HTMLDetailsElement && element.open,
    ))
  ) {
    await pendingExactDetails.locator("summary").click();
  }
  await expect(
    pendingExactEntry.getByText(`${suffix} exact scorer`, { exact: true }),
  ).toBeVisible();

  const reobserved = await db
    .update(seasons)
    .set({
      standingsAcceptedThrough: postKickoffCapturedAt,
      updatedAt: postKickoffCapturedAt,
    })
    .where(
      and(
        eq(seasons.id, originalSeason!.id),
        eq(seasons.activeSnapshotId, snapshotId),
      ),
    )
    .returning({ id: seasons.id });
  expect(reobserved).toHaveLength(1);

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "The season, against our predictions.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Premier League season table" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/leaderboard", { waitUntil: "networkidle" });
  const scoredLeaderboard = page.getByLabel("Scored leaderboard");
  await expect(scoredLeaderboard).toBeVisible();
  await expect(page.getByText("Matchweek 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Provisional", { exact: true })).toBeVisible();
  await expect(scoredLeaderboard.getByRole("row")).toHaveCount(3);

  const exactEntry = page.getByLabel(`${exactName} leaderboard entry`);
  await expect(exactEntry.getByLabel("Rank 1")).toHaveText("1");
  await expect(exactEntry.getByText("100", { exact: true })).toBeVisible();
  await expect(
    exactEntry.getByText("Index +0.5 · Rank 1 · 20 pts", { exact: true }),
  ).toHaveCount(0);
  await expect(
    exactEntry.getByText(`${suffix} exact scorer`, { exact: true }),
  ).toHaveCount(0);
  await expect(exactEntry.locator("details")).toHaveCount(0);
  await expect(
    exactEntry.getByLabel("Predicted champion: Arsenal"),
  ).toBeVisible();
  const arsenalCrest = exactEntry
    .getByLabel("Predicted champion: Arsenal")
    .locator("img");
  await expect(arsenalCrest).toBeVisible();
  await expect(arsenalCrest).toHaveAttribute("src", /arsenal/u);
  await expect(exactEntry.getByText(/On track/u)).toHaveCount(0);

  const swappedEntry = page.getByLabel(`${swappedName} leaderboard entry`);
  await expect(swappedEntry.getByLabel("Rank 2")).toHaveText("2");
  await expect(swappedEntry.getByText("96", { exact: true })).toBeVisible();
  await expect(
    swappedEntry.getByLabel("Predicted champion: Aston Villa"),
  ).toBeVisible();
  const astonVillaCrest = swappedEntry
    .getByLabel("Predicted champion: Aston Villa")
    .locator("img");
  await expect(astonVillaCrest).toBeVisible();
  await expect(astonVillaCrest).toHaveAttribute("src", /aston-villa/u);
  await expect(swappedEntry.getByText(/Off track/u)).toHaveCount(0);
  await expect(swappedEntry.locator("details")).toHaveCount(0);

  await expectNoHorizontalOverflow(page);

  await page.goto("/spotlight", { waitUntil: "networkidle" });
  await expect(page.getByLabel("Spotlight categories")).toBeVisible();
  await expect(
    page.getByLabel("Spotlight categories").getByRole("heading", { level: 2 }),
  ).toHaveCount(1);
  await expect(page.getByText("Result pending", { exact: true })).toHaveCount(
    1,
  );
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("underdog_team");
  await page.getByRole("button", { name: "Show category" }).click();
  await expect(page.getByText("Result live", { exact: true })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await page.goto("/spotlight?view=matrix", { waitUntil: "networkidle" });
  await expect(page.getByLabel("Spotlight matrix")).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: /seven spotlight picks/i })
      .getByRole("row"),
  ).toHaveCount(3);
  await expectNoHorizontalOverflow(page);

  await page.goto("/spotlight?view=entries&sort=overall", {
    waitUntil: "networkidle",
  });
  const accuracyLeaderboard = page.getByLabel("Spotlight accuracy leaderboard");
  await expect(accuracyLeaderboard.getByRole("article")).toHaveCount(2);
  const exactAccuracyEntry = page.getByLabel(
    `${exactName} spotlight accuracy entry`,
  );
  const swappedAccuracyEntry = page.getByLabel(
    `${swappedName} spotlight accuracy entry`,
  );
  await expect(
    exactAccuracyEntry.getByText("4", { exact: true }),
  ).toBeVisible();
  await expect(
    swappedAccuracyEntry.getByText("4", { exact: true }),
  ).toBeVisible();
  const exactAccuracyDetails = exactAccuracyEntry.locator("details");
  if (
    !(await exactAccuracyDetails.evaluate(
      (element) => element instanceof HTMLDetailsElement && element.open,
    ))
  ) {
    await exactAccuracyDetails.locator("summary").click();
  }
  await expect(
    exactAccuracyEntry.getByText(
      "Index +0.5 · Result rank 1 · 2 accuracy pts",
      { exact: true },
    ),
  ).toHaveCount(2);
  await expect(
    exactAccuracyEntry.getByText(`${suffix} exact scorer`, { exact: true }),
  ).toBeVisible();

  await page.goto("/spotlight?view=entries&sort=underdog_team", {
    waitUntil: "networkidle",
  });
  const underdogAccuracyEntries = page
    .getByLabel("Spotlight accuracy leaderboard")
    .getByRole("article");
  await expect(underdogAccuracyEntries).toHaveCount(2);
  await expect(underdogAccuracyEntries.nth(0)).toHaveAccessibleName(
    `${exactName} spotlight accuracy entry`,
  );
  await expect(underdogAccuracyEntries.nth(1)).toHaveAccessibleName(
    `${swappedName} spotlight accuracy entry`,
  );
  for (const underdogAccuracyEntry of [
    page.getByLabel(`${exactName} spotlight accuracy entry`),
    page.getByLabel(`${swappedName} spotlight accuracy entry`),
  ]) {
    await expect(
      underdogAccuracyEntry.getByLabel("Underdog team result rank 1"),
    ).toHaveText("1");
    await expect(
      underdogAccuracyEntry.getByText("2", { exact: true }),
    ).toBeVisible();
    await expect(
      underdogAccuracyEntry.getByText("4", { exact: true }),
    ).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page);

  await page.goto(`/entries/${predictionIds[0]}`, {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `${exactName}'s prediction`,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(seasonPlayers[0]!.displayName, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(seasonPlayers[1]!.displayName, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Index +0.5 · Result rank 1 · 2 accuracy pts", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expectNoHorizontalOverflow(page);

  const adminSecret =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET;
  expect(
    adminSecret,
    "PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_SECRET must be available for E2E",
  ).toBeTruthy();
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(adminSecret!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/u);
  await page.goto("/admin/results", { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Player ratings", exact: true })
    .click();
  await page.getByRole("button", { name: "Seed picked players" }).click();

  const underdogRatings = page
    .getByRole("heading", { level: 3, name: "Underdog player ratings" })
    .locator("xpath=ancestor::section");
  const overratedRatings = page
    .getByRole("heading", { level: 3, name: "Overrated player ratings" })
    .locator("xpath=ancestor::section");
  await expect(underdogRatings.getByRole("spinbutton")).toHaveCount(2);
  await expect(overratedRatings.getByRole("spinbutton")).toHaveCount(2);
  for (const player of [seasonPlayers[0]!, seasonPlayers[2]!]) {
    await expect(
      underdogRatings.getByText(
        new RegExp(`^Selected: ${player.displayName}`, "u"),
      ),
    ).toBeVisible();
    await expect(
      overratedRatings.getByText(
        new RegExp(`^Selected: ${player.displayName}`, "u"),
      ),
    ).toHaveCount(0);
  }
  for (const player of [seasonPlayers[1]!, seasonPlayers[3]!]) {
    await expect(
      overratedRatings.getByText(
        new RegExp(`^Selected: ${player.displayName}`, "u"),
      ),
    ).toBeVisible();
    await expect(
      underdogRatings.getByText(
        new RegExp(`^Selected: ${player.displayName}`, "u"),
      ),
    ).toHaveCount(0);
  }
  await expect(
    page.getByText("All 4 picked opinion players have a reviewed rating.", {
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Capture the working surfaces using this test's isolated, revealed league.
  const screenshotDirectory = process.env.QA_SCREENSHOT_DIR;
  const capture = async (name: string) => {
    if (!screenshotDirectory) return;
    await mkdir(screenshotDirectory, { recursive: true });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map(async (image) => {
          image.loading = "eager";
          try {
            await image.decode();
          } catch {
            /* The component owns its fallback. */
          }
        }),
      );
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: path.join(
        screenshotDirectory,
        `${testInfo.project.name}-${name}.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
  };
  const accessibilityFailures: { route: string; violations: unknown[] }[] = [];
  const routes = [
    ["season", "/"],
    ["leaderboard", "/leaderboard"],
    ["spotlight", "/spotlight"],
    ["spotlight-entries", "/spotlight?view=entries"],
    ["spotlight-matrix", "/spotlight?view=matrix"],
    ["entry", `/entries/${predictionIds[0]}`],
    ["rules", "/rules"],
    ["win-streak", "/win-streak"],
    ["admin", "/admin"],
    ["admin-submissions", "/admin/submissions"],
    ["admin-standings", "/admin/standings"],
    ["admin-results", "/admin/results"],
    ["admin-win-streak", "/admin/win-streak"],
    ["admin-settings", "/admin/settings"],
  ];
  for (const [name, route] of routes) {
    await page.goto(route!, { waitUntil: "networkidle" });
    await expect(page.locator("main h1")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    if (
      process.env.QA_AXE_SOURCE &&
      ["chromium", "mobile-chromium"].includes(testInfo.project.name)
    ) {
      await page.addScriptTag({ path: process.env.QA_AXE_SOURCE });
      const result = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (options: object) => Promise<{ violations: unknown[] }>;
            };
          }
        ).axe;
        return axe.run({
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        });
      });
      if (screenshotDirectory) {
        await mkdir(screenshotDirectory, { recursive: true });
        await writeFile(
          path.join(
            screenshotDirectory,
            `${testInfo.project.name}-${name}-accessibility.json`,
          ),
          JSON.stringify(result.violations, null, 2) + "\n",
        );
      }
      if (result.violations.length)
        accessibilityFailures.push({
          route: route!,
          violations: result.violations,
        });
    }
    if (["chromium", "mobile-chromium"].includes(testInfo.project.name))
      await capture(name!);
    if (
      name === "admin-results" &&
      ["chromium", "mobile-chromium"].includes(testInfo.project.name)
    ) {
      await page
        .getByRole("button", { name: "Player ratings", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: "Top scorer",
          exact: true,
        }),
      ).not.toBeVisible();
      await capture("admin-player-ratings");
      await page
        .getByRole("button", { name: "Other-player matches", exact: true })
        .click();
      await capture("admin-aliases");
    }
  }
  await page.goto("/leaderboard");
  await page.getByLabel("Find a participant").fill(swappedName);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    page.getByLabel(`${swappedName} leaderboard entry`),
  ).toBeVisible();
  await expect(page.getByLabel(`${exactName} leaderboard entry`)).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Clear", exact: true }).click();
  await expect(page.getByLabel(`${exactName} leaderboard entry`)).toBeVisible();

  // More joint leaders than a three-slot podium can hold. Cleanup owns every ID.
  for (let index = 1; index <= 3; index++) {
    const id = randomUUID();
    predictionIds.push(id);
    const name = `Joint leader ${index} ${suffix}`;
    await db.batch([
      db.insert(predictions).values({
        id,
        participantName: name,
        normalizedParticipantName: name.toLowerCase(),
        seasonId: originalSeason!.id,
      }),
      db.insert(predictionItems).values(
        seasonTeams.map((team, index) => ({
          predictedPosition: index + 1,
          predictionId: id,
          teamId: team.id,
        })),
      ),
      db
        .insert(predictionCategoryPicks)
        .values(
          spotlightRowsFor(
            id,
            seasonTeams,
            seasonPlayers.slice(0, 2),
            `${suffix} tie ${index}`,
          ),
        ),
    ]);
  }
  await page.goto("/leaderboard", { waitUntil: "networkidle" });
  const jointLeaders = page.getByRole("group", { name: "Joint 1st place" });
  await expect(jointLeaders.getByTestId("podium-entry")).toHaveCount(4);
  await expect(page.getByTestId("podium-entry")).toHaveCount(4);
  await expect(jointLeaders.getByText("100", { exact: false })).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
  await capture("podium-ties");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await capture("podium-ties-dark");
  await expectNoHorizontalOverflow(page);
  expect(accessibilityFailures).toEqual([]);
});
