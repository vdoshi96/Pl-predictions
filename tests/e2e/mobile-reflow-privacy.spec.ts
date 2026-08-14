import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "../../src/data/teams";
import {
  predictionCategoryPicks,
  predictionItems,
  predictions,
} from "../../src/db/schema";
import {
  acceptAlphabeticalPrediction,
  completeSpotlightPicks,
  expectCompletePredictionDraftPersisted,
} from "./spotlight-helpers";

const reflowProjects = new Set(["reflow-320-chromium", "reflow-430-chromium"]);
const createdPredictionIds = new Set<string>();
const attemptedParticipantNames = new Set<string>();
const privateTeamSentinels = PREMIER_LEAGUE_2026_27_TEAMS.filter((team) =>
  ["aston-villa", "brighton-and-hove-albion", "tottenham-hotspur"].includes(
    team.slug,
  ),
);
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

test.afterEach(async () => {
  if (
    !process.env.DATABASE_URL ||
    (createdPredictionIds.size === 0 && attemptedParticipantNames.size === 0)
  ) {
    return;
  }

  const db = getQaDb();
  if (attemptedParticipantNames.size > 0) {
    const recovered = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(
        inArray(predictions.participantName, [...attemptedParticipantNames]),
      );
    for (const prediction of recovered) {
      createdPredictionIds.add(prediction.id);
    }
  }

  if (createdPredictionIds.size > 0) {
    await db
      .delete(predictions)
      .where(inArray(predictions.id, [...createdPredictionIds]));
  }

  const residueChecks: Array<PromiseLike<Array<{ value: number }>>> = [];
  if (attemptedParticipantNames.size > 0) {
    residueChecks.push(
      db
        .select({ value: count() })
        .from(predictions)
        .where(
          inArray(predictions.participantName, [...attemptedParticipantNames]),
        ),
    );
  }
  if (createdPredictionIds.size > 0) {
    residueChecks.push(
      db
        .select({ value: count() })
        .from(predictionItems)
        .where(
          inArray(predictionItems.predictionId, [...createdPredictionIds]),
        ),
      db
        .select({ value: count() })
        .from(predictionCategoryPicks)
        .where(
          inArray(predictionCategoryPicks.predictionId, [
            ...createdPredictionIds,
          ]),
        ),
    );
  }
  for (const [residue] of await Promise.all(residueChecks)) {
    expect(residue?.value ?? 0).toBe(0);
  }

  createdPredictionIds.clear();
  attemptedParticipantNames.clear();
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
  attemptedParticipantNames.add(participantName);

  await page.goto("/");
  await expect(
    page.getByRole("timer", { name: /until submissions lock$/u }),
  ).toBeVisible();
  await expect(page.locator(".countdown-flip")).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: "How to play", exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/rules");
  await expect(
    page.getByRole("heading", { name: "How to play in three steps" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Mobile .* screen/u }),
  ).toHaveCount(3);
  await expectNoHorizontalOverflow(page);

  const playerCatalogueRequests: string[] = [];
  const playerPortraitRequests: string[] = [];
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname === "/api/player-catalogue") {
      playerCatalogueRequests.push(request.url());
    }
    if (
      requestUrl.pathname.startsWith("/player-faces/") ||
      requestUrl.searchParams.get("url")?.startsWith("/player-faces/")
    ) {
      playerPortraitRequests.push(request.url());
    }
  });
  const initialNavigationResponse = await page.goto("/");
  expect(initialNavigationResponse?.ok()).toBe(true);
  expect(initialNavigationResponse?.headers()["content-type"]).toContain(
    "text/html",
  );
  const initialHtml = (await initialNavigationResponse?.text()) ?? "";
  expect(playerCatalogueRequests).toHaveLength(0);
  const predictRscResponse = await page.request.get(
    "/?_rsc=player-catalogue-privacy",
    { headers: { accept: "text/x-component", rsc: "1" } },
  );
  expect(predictRscResponse.ok()).toBe(true);
  expect(predictRscResponse.headers()["content-type"]).toContain(
    "text/x-component",
  );
  const predictRsc = await predictRscResponse.text();
  expect(new TextEncoder().encode(predictRsc).byteLength).toBeLessThan(
    50 * 1024,
  );
  const catalogueResponse = await page.request.get("/api/player-catalogue", {
    headers: { accept: "application/json" },
  });
  expect(catalogueResponse.ok()).toBe(true);
  expect(playerCatalogueRequests).toHaveLength(0);
  const catalogue = (await catalogueResponse.json()) as {
    players: Array<{
      assetPath: string | null;
      displayName: string;
      id: string;
    }>;
  };
  expect(catalogue.players.length).toBeGreaterThan(20);
  const leakedRscCatalogueValues = catalogue.players.flatMap((player) =>
    [player.id, player.displayName, player.assetPath].filter(
      (value): value is string => Boolean(value && predictRsc.includes(value)),
    ),
  );
  expect(
    leakedRscCatalogueValues,
    "The initial decoded RSC must not contain player IDs, names, or portrait paths.",
  ).toEqual([]);
  const leakedHtmlCatalogueValues = catalogue.players.flatMap((player) =>
    [player.id, player.displayName, player.assetPath].filter(
      (value): value is string => Boolean(value && initialHtml.includes(value)),
    ),
  );
  expect(
    leakedHtmlCatalogueValues,
    "The initial HTML must not contain player IDs, names, or portrait paths.",
  ).toEqual([]);
  const predictionTable = page.getByRole("list", {
    name: "Premier League predicted positions",
  });
  const keyboardHandle = page.getByRole("button", { name: /^Move Arsenal,/u });
  await keyboardHandle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(predictionTable.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    /^Aston Villa, predicted position 1 of 20$/u,
  );
  await page
    .getByRole("button", {
      name: "Reset prediction table to alphabetical order",
    })
    .click();
  await expect(predictionTable.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    /^Arsenal, predicted position 1 of 20$/u,
  );
  await page
    .getByRole("textbox", { name: "Your display name" })
    .fill(participantName);
  await expect(
    page.getByRole("textbox", { name: "Your display name" }),
  ).toHaveValue(participantName);
  const continueButton = page.getByRole("button", {
    name: "Continue to spotlight picks",
  });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await acceptAlphabeticalPrediction(page);
  await expect.poll(() => playerCatalogueRequests.length).toBe(1);
  const topScorerCard = page.locator('[data-category="top_scorer"]');
  const playerPortraitNodes = page.locator(
    'img[src*="/player-faces/"], img[src*="%2Fplayer-faces%2F"]',
  );
  const topScorerCombobox = topScorerCard.getByRole("combobox", {
    name: "Top scorer",
  });
  await topScorerCombobox.click();
  await expect(
    topScorerCard.getByText("Type at least 2 letters to search players.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(topScorerCard.getByRole("option")).toHaveCount(1);
  await expect(
    topScorerCard.getByRole("option", {
      name: "Other player",
      exact: true,
    }),
  ).toBeVisible();
  await expect(topScorerCard.locator("img")).toHaveCount(0);
  await expect(playerPortraitNodes).toHaveCount(0);
  expect(playerPortraitRequests).toHaveLength(0);

  await topScorerCombobox.fill("a");
  await expect(
    topScorerCard.getByText("Type at least 2 letters to search players.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(topScorerCard.getByRole("option")).toHaveCount(1);
  await expect(topScorerCard.locator("img")).toHaveCount(0);
  await expect(playerPortraitNodes).toHaveCount(0);
  expect(playerPortraitRequests).toHaveLength(0);

  await topScorerCombobox.fill("an");
  const populatedSearchOptions = topScorerCard.getByRole("option");
  await expect(
    topScorerCard.getByRole("option", {
      name: "Other player",
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => populatedSearchOptions.count()).toBeGreaterThan(1);
  const populatedOptionNames = (
    await populatedSearchOptions.allTextContents()
  ).map((name) => name.trim());
  const playerOptionNames = populatedOptionNames.filter(
    (name) => name !== "Other player",
  );
  expect(playerOptionNames.length).toBeGreaterThan(0);
  expect(playerOptionNames.length).toBeLessThanOrEqual(20);
  expect(
    populatedOptionNames.filter((name) => name === "Other player"),
  ).toHaveLength(1);
  expect(populatedOptionNames.at(-1)).toBe("Other player");
  await topScorerCombobox.press("Escape");

  const customPlayerNames = await completeSpotlightPicks(
    page,
    `${uniquePrefix}Private`,
  );
  await expectCompletePredictionDraftPersisted(page, participantName);
  await expect(
    page.getByText(/Draft (?:saved in|restored from) this browser/u),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Make your spotlight picks" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Draft restored from this browser\./u),
  ).toBeVisible();
  await expect(
    page.getByText(/^7 of 7 spotlight categories started\./u),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review all predictions" }).click();
  const restoredReview = page.getByRole("dialog", {
    name: "Review every prediction",
  });
  await expect(restoredReview.getByText(/Submitting as/u)).toContainText(
    participantName,
  );
  await expect(restoredReview.locator("[data-category]")).toHaveCount(7);
  await expect(
    restoredReview
      .getByRole("list", {
        name: "Prediction review, positions 1 through 20",
      })
      .getByRole("listitem"),
  ).toHaveCount(20);
  for (const playerName of customPlayerNames) {
    await expect(
      restoredReview.getByText(playerName, { exact: true }),
    ).toBeVisible();
  }
  await restoredReview
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
  for (const customPlayerName of customPlayerNames) {
    expect(rawHtml).not.toContain(customPlayerName);
  }
  expect(privateTeamSentinels).toHaveLength(3);
  for (const privateTeam of privateTeamSentinels) {
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
  for (const customPlayerName of customPlayerNames) {
    expect(rawRsc).not.toContain(customPlayerName);
  }
  for (const privateTeam of privateTeamSentinels) {
    expect(rawRsc).not.toContain(privateTeam.displayName);
    expect(rawRsc).not.toContain(privateTeam.assetPath);
  }

  for (const spotlightSort of spotlightSorts) {
    const spotlightHtmlResponse = await page.request.get(
      `/spotlight?sort=${spotlightSort}`,
      { headers: { accept: "text/html" } },
    );
    expect(spotlightHtmlResponse.ok()).toBe(true);
    expect(spotlightHtmlResponse.headers()["content-type"]).toContain(
      "text/html",
    );
    const spotlightHtml = await spotlightHtmlResponse.text();
    expect(spotlightHtml).not.toContain("Spotlight accuracy leaderboard");
    expect(spotlightHtml).not.toContain(participantName);
    expect(spotlightHtml).not.toContain(predictionId);
    for (const customPlayerName of customPlayerNames) {
      expect(spotlightHtml).not.toContain(customPlayerName);
    }
    for (const privateTeam of privateTeamSentinels) {
      expect(spotlightHtml).not.toContain(privateTeam.displayName);
      expect(spotlightHtml).not.toContain(privateTeam.assetPath);
    }

    const spotlightRscResponse = await page.request.get(
      `/spotlight?sort=${spotlightSort}&_rsc=privacy-${spotlightSort}`,
      { headers: { accept: "text/x-component", rsc: "1" } },
    );
    expect(spotlightRscResponse.ok()).toBe(true);
    expect(spotlightRscResponse.headers()["content-type"]).toContain(
      "text/x-component",
    );
    const spotlightRsc = await spotlightRscResponse.text();
    expect(spotlightRsc).not.toContain("Spotlight accuracy leaderboard");
    expect(spotlightRsc).not.toContain(participantName);
    expect(spotlightRsc).not.toContain(predictionId);
    for (const customPlayerName of customPlayerNames) {
      expect(spotlightRsc).not.toContain(customPlayerName);
    }
    for (const privateTeam of privateTeamSentinels) {
      expect(spotlightRsc).not.toContain(privateTeam.displayName);
      expect(spotlightRsc).not.toContain(privateTeam.assetPath);
    }
  }

  await confirmationLink.click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `${participantName}'s prediction`,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(customPlayerNames[0]!, { exact: true }),
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

  await page.goto("/spotlight?sort=overrated_player");
  await expect(
    page.getByRole("heading", { level: 1, name: "Spotlight accuracy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Spotlight picks are still private",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Spotlight accuracy leaderboard")).toHaveCount(
    0,
  );
  await expect(page.getByText(participantName, { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("320–430px admin result and deadline controls reflow without writes", async ({
  page,
}, testInfo) => {
  test.skip(
    !reflowProjects.has(testInfo.project.name),
    "Exact-width Chromium administrator reflow coverage.",
  );
  test.setTimeout(90_000);
  expect([320, 430]).toContain(testInfo.project.use.viewport?.width);

  const adminSecret =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET;
  expect(
    adminSecret,
    "PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_SECRET must be available for E2E",
  ).toBeTruthy();

  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin sign in" }),
  ).toBeVisible();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(adminSecret!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/u);

  const sameOrigin = new URL(page.url()).origin;
  const unexpectedMutationRequests: string[] = [];
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (
      requestUrl.origin === sameOrigin &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      unexpectedMutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/admin/results");
  await expect(
    page.getByRole("heading", { level: 1, name: "Spotlight results" }),
  ).toBeVisible();
  await expect(
    page.getByText("Reveal and close first", { exact: true }),
  ).toBeVisible();
  const publishButtons = page.getByRole("button", {
    name: "Publish provisional",
  });
  await expect(publishButtons).toHaveCount(4);
  for (const publishButton of await publishButtons.all()) {
    await expect(publishButton).toBeDisabled();
  }

  const topScorerResults = page
    .getByRole("heading", { level: 3, name: "Top scorer" })
    .locator("xpath=ancestor::section");
  const removeButtons = topScorerResults.getByRole("button", {
    name: /^Remove /u,
  });
  await expect(removeButtons).toHaveCount(0);
  const addRowButton = topScorerResults.getByRole("button", {
    name: "Add row",
  });
  await addRowButton.focus();
  await expect(addRowButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(removeButtons).toHaveCount(1);
  await topScorerResults
    .getByRole("spinbutton", { name: /^Top scorer Goals for /u })
    .fill("3");
  await expect(
    topScorerResults.getByRole("cell", { exact: true, name: "1" }),
  ).toBeVisible();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(
    1,
  );
  await removeButtons.focus();
  await expect(removeButtons).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(removeButtons).toHaveCount(0);
  await expect(
    topScorerResults.getByText("Add the first reviewed row.", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/admin/settings");
  await expect(
    page.getByRole("heading", { level: 2, name: "Fixed submission deadline" }),
  ).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  const kickoffZone = page.getByLabel("View kickoff in another time zone");
  await expect(kickoffZone).toHaveValue("America/Chicago");
  await kickoffZone.selectOption("UTC");
  await expect(
    kickoffZone.locator("xpath=following-sibling::time"),
  ).toContainText("UTC");
  await expect(
    page.getByRole("button", { name: "Lock submissions now" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reveal predictions early" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(
    unexpectedMutationRequests,
    "Exact-width admin reflow must not save, publish, lock, or reveal.",
  ).toEqual([]);
});
