import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  predictionItems,
  predictions,
  seasons,
  standingsItems,
  standingsSnapshots,
  teams,
} from "../../src/db/schema";

const scoredProjects = new Set([
  "chromium",
  "reflow-320-chromium",
  "reflow-430-chromium",
]);
const preKickoffCapturedAt = new Date("2026-08-21T18:55:00.000Z");
const postKickoffCapturedAt = new Date("2026-08-21T19:05:00.000Z");

type OriginalSeasonState = typeof seasons.$inferSelect;

type QaFixture = {
  exactName: string;
  originalSeason: OriginalSeasonState;
  predictionIds: [string, string];
  seasonUpdated: boolean;
  snapshotId: string;
  swappedName: string;
};

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
        submissionDeadline: fixture.originalSeason.submissionDeadline,
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
          submissionDeadline: fixture.originalSeason.submissionDeadline,
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

test("post-kickoff leaderboard scores champion picks at desktop and mobile widths", async ({
  page,
}, testInfo) => {
  test.skip(
    !scoredProjects.has(testInfo.project.name),
    "Scored leaderboard coverage runs at desktop and exact 320/430px mobile widths.",
  );
  test.setTimeout(90_000);

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

  const runId = randomUUID();
  const suffix = runId.slice(0, 8);
  const predictionIds: [string, string] = [randomUUID(), randomUUID()];
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
      submissionDeadline: new Date("2026-08-21T19:00:00.000Z"),
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

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("Scored leaderboard")).toBeVisible();
  await expect(page.getByText("Matchweek 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Provisional", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/ leaderboard entry$/u)).toHaveCount(2);

  const exactEntry = page.getByLabel(`${exactName} leaderboard entry`);
  await expect(exactEntry.getByLabel("Rank 1")).toHaveText("1");
  await expect(exactEntry.getByText("100", { exact: true })).toBeVisible();
  await expect(
    exactEntry.getByLabel("Predicted champion: Arsenal"),
  ).toBeVisible();
  await expect(
    exactEntry.getByRole("img", { name: "Arsenal club mark" }),
  ).toBeVisible();
  await expect(exactEntry.getByText("On track · 1st")).toBeVisible();

  const swappedEntry = page.getByLabel(`${swappedName} leaderboard entry`);
  await expect(swappedEntry.getByLabel("Rank 2")).toHaveText("2");
  await expect(swappedEntry.getByText("96", { exact: true })).toBeVisible();
  await expect(
    swappedEntry.getByLabel("Predicted champion: Aston Villa"),
  ).toBeVisible();
  await expect(
    swappedEntry.getByRole("img", { name: "Aston Villa club mark" }),
  ).toBeVisible();
  await expect(swappedEntry.getByText("Off track · 2nd")).toBeVisible();

  await expectNoHorizontalOverflow(page);
});
