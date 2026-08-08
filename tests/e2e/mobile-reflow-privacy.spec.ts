import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "../../src/data/teams";
import { predictions } from "../../src/db/schema";

const reflowProjects = new Set(["reflow-320-chromium", "reflow-430-chromium"]);
const createdPredictionIds = new Set<string>();

function getQaDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for reversible reflow QA.");
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
  if (!process.env.DATABASE_URL || createdPredictionIds.size === 0) return;

  await getQaDb()
    .delete(predictions)
    .where(inArray(predictions.id, [...createdPredictionIds]));
  createdPredictionIds.clear();
});

test("320–430px reflow keeps private identifiers out of HTML and RSC", async ({
  page,
}, testInfo) => {
  test.skip(
    !reflowProjects.has(testInfo.project.name),
    "Exact-width Chromium reflow coverage.",
  );
  test.setTimeout(90_000);

  const width = testInfo.project.use.viewport?.width;
  expect([320, 430]).toContain(width);
  const uniquePrefix = `Reflow ${width} ${Date.now().toString(36)} `;
  const participantName = `${uniquePrefix}${"Touch".repeat(10)}`.slice(0, 40);
  expect(participantName).toHaveLength(40);

  await page.goto("/", { waitUntil: "networkidle" });
  await expectNoHorizontalOverflow(page);
  await page
    .getByRole("textbox", { name: "Your display name" })
    .fill(participantName);
  await expect(
    page.getByRole("textbox", { name: "Your display name" }),
  ).toHaveValue(participantName);
  const reviewButton = page.getByRole("button", { name: "Review your 1–20" });
  await expect(reviewButton).toBeEnabled();
  await reviewButton.click();
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
  const predictionId = entryPath!.split("/").at(-1)!;
  createdPredictionIds.add(predictionId);

  const htmlResponse = await page.request.get("/leaderboard", {
    headers: { accept: "text/html" },
  });
  expect(htmlResponse.ok()).toBe(true);
  expect(htmlResponse.headers()["content-type"]).toContain("text/html");
  const rawHtml = await htmlResponse.text();
  expect(rawHtml).toContain(participantName);
  expect(rawHtml).toContain("Arsenal");
  expect(rawHtml).not.toContain(predictionId);
  for (const privateTeam of PREMIER_LEAGUE_2026_27_TEAMS.filter(
    (team) => team.slug !== "arsenal",
  )) {
    expect(rawHtml).not.toContain(privateTeam.displayName);
    expect(rawHtml).not.toContain(privateTeam.assetPath);
  }

  const rscResponse = await page.request.get("/leaderboard?_rsc=privacy", {
    headers: { accept: "text/x-component", rsc: "1" },
  });
  expect(rscResponse.ok()).toBe(true);
  expect(rscResponse.headers()["content-type"]).toContain("text/x-component");
  const rawRsc = await rscResponse.text();
  expect(rawRsc).toContain(participantName);
  expect(rawRsc).toContain("Arsenal");
  expect(rawRsc).not.toContain(predictionId);
  for (const privateTeam of PREMIER_LEAGUE_2026_27_TEAMS.filter(
    (team) => team.slug !== "arsenal",
  )) {
    expect(rawRsc).not.toContain(privateTeam.displayName);
    expect(rawRsc).not.toContain(privateTeam.assetPath);
  }

  await confirmationLink.click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `${participantName}'s table`,
    }),
  ).toBeVisible();
  const entryTable = page.getByRole("list", {
    name: `${participantName}'s predicted table`,
  });
  const entryClubName = entryTable.getByText("Brighton & Hove Albion", {
    exact: true,
  });
  await expect(entryClubName).toBeVisible();
  expect(
    await entryClubName.evaluate((element) => ({
      overflowWrap: getComputedStyle(element).overflowWrap,
      textOverflow: getComputedStyle(element).textOverflow,
      whiteSpace: getComputedStyle(element).whiteSpace,
    })),
  ).toEqual({
    overflowWrap: "anywhere",
    textOverflow: "clip",
    whiteSpace: "normal",
  });
  await expectNoHorizontalOverflow(page);

  await page.goto("/leaderboard");
  await expect(page.getByText("Full tables are still private")).toBeVisible();
  const leaderboardEntry = page.getByLabel(
    `${participantName} leaderboard entry`,
  );
  await expect(
    leaderboardEntry.getByText("Arsenal", { exact: true }),
  ).toBeVisible();
  await expect(leaderboardEntry.getByText("0", { exact: true })).toBeVisible();
  const rosterName = page.getByText(participantName, { exact: true });
  await expect(rosterName).toBeVisible();
  expect(
    await rosterName.evaluate((element) => ({
      overflowWrap: getComputedStyle(element).overflowWrap,
      textOverflow: getComputedStyle(element).textOverflow,
      whiteSpace: getComputedStyle(element).whiteSpace,
    })),
  ).toEqual({
    overflowWrap: "anywhere",
    textOverflow: "clip",
    whiteSpace: "normal",
  });
  await expectNoHorizontalOverflow(page);
});
