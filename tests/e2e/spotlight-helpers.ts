import { expect, type Page } from "@playwright/test";

import { PREDICTION_CATEGORY_DEFINITIONS } from "../../src/features/predictions/categories";

export const ROSTER_TRANSITION_PLAYER_PICKS = [
  {
    category: "top_scorer",
    label: "Top scorer",
    option: "Ronald Araujo",
    portraitPath: "/player-faces/fc_liverpool_araujo_ronald.png",
    search: "Araujo",
  },
  {
    category: "top_assister",
    label: "Top assister",
    option: "Dwight McNeil",
    portraitPath: "/player-faces/crystal_palace_mcneil_dwight.png",
    search: "McNeil",
  },
  {
    category: "underdog_player",
    label: "Underdog player",
    option: "Alysson",
    portraitPath: "/player-faces/aston_villa_unknown_alysson.png",
    search: "Alysson",
  },
] as const;

const REMOVED_PLAYER = {
  name: "Lucas Digne",
  search: "Lucas Digne",
} as const;

const OTHER_PLAYER_PICK = {
  category: "overrated_player",
  label: "Overrated player",
} as const;

const TEAM_PICKS = [
  {
    category: "most_clean_sheets",
    label: "Most clean sheets",
    option: "AFC Bournemouth",
  },
  {
    category: "underdog_team",
    label: "Underdog team",
    option: "Arsenal",
  },
  {
    category: "overrated_team",
    label: "Overrated team",
    option: "Aston Villa",
  },
] as const;

export async function acceptAlphabeticalPrediction(page: Page) {
  const warning = page.getByRole("dialog", {
    name: "This table is still alphabetical",
  });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Yes, use A–Z" }).click();
}

export async function expectCompletePredictionDraftPersisted(
  page: Page,
  participantName: string,
  seasonSlug = "2026-27",
) {
  const storageKey = `dranx:prediction-draft:v1:${encodeURIComponent(seasonSlug)}`;
  const expectedCategoryKeys = PREDICTION_CATEGORY_DEFINITIONS.map(
    (definition) => definition.category,
  ).sort();

  await expect
    .poll(() =>
      page.evaluate(
        ({ draftKey }) => {
          const serialized = window.localStorage.getItem(draftKey);
          if (!serialized) return null;

          try {
            const value = JSON.parse(serialized) as Record<string, unknown>;
            const spotlightPicks =
              value.spotlightPicks &&
              typeof value.spotlightPicks === "object" &&
              !Array.isArray(value.spotlightPicks)
                ? (value.spotlightPicks as Record<string, unknown>)
                : {};
            return {
              categoryKeys: Object.keys(spotlightPicks).sort(),
              orderedTeamCount: Array.isArray(value.orderedTeamIds)
                ? value.orderedTeamIds.length
                : 0,
              participantName: value.participantName,
              savedAtValid:
                typeof value.savedAt === "string" &&
                !Number.isNaN(Date.parse(value.savedAt)),
              seasonSlug: value.seasonSlug,
              stage: value.stage,
              version: value.version,
            };
          } catch {
            return null;
          }
        },
        { draftKey: storageKey },
      ),
    )
    .toEqual({
      categoryKeys: expectedCategoryKeys,
      orderedTeamCount: 20,
      participantName,
      savedAtValid: true,
      seasonSlug,
      stage: "spotlight",
      version: 1,
    });
}

export async function completeSpotlightPicks(
  page: Page,
  customNamePrefix: string,
): Promise<string[]> {
  const selectedPlayerNames: string[] = ROSTER_TRANSITION_PLAYER_PICKS.map(
    (pick) => pick.option,
  );

  const removalCheckCard = page.locator(
    `[data-category="${ROSTER_TRANSITION_PLAYER_PICKS[0].category}"]`,
  );
  const removalCheckCombobox = removalCheckCard.getByRole("combobox", {
    name: ROSTER_TRANSITION_PLAYER_PICKS[0].label,
  });
  await removalCheckCombobox.click();
  await removalCheckCombobox.fill(REMOVED_PLAYER.search);
  await expect(
    removalCheckCard.getByRole("option", {
      name: REMOVED_PLAYER.name,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    removalCheckCard.getByText(
      "No matching player. Try another search or choose Other player below.",
      { exact: true },
    ),
  ).toBeVisible();
  await removalCheckCombobox.press("Escape");

  for (const pick of ROSTER_TRANSITION_PLAYER_PICKS) {
    const card = page.locator(`[data-category="${pick.category}"]`);
    const combobox = card.getByRole("combobox", { name: pick.label });

    await combobox.click();
    await combobox.fill(pick.search);
    const option = card.getByRole("option", {
      name: pick.option,
      exact: true,
    });
    await expect(option).toBeVisible();
    const portrait = option.locator("img");
    await expect(portrait).toBeVisible();
    await expect
      .poll(async () =>
        decodeURIComponent((await portrait.getAttribute("src")) ?? ""),
      )
      .toContain(pick.portraitPath);
    await option.click();
    await expect(combobox).toHaveValue(pick.option);
  }

  const customPlayerName = `${customNamePrefix} Other`;
  selectedPlayerNames.push(customPlayerName);
  const otherPlayerCard = page.locator(
    `[data-category="${OTHER_PLAYER_PICK.category}"]`,
  );
  await otherPlayerCard
    .getByRole("combobox", { name: OTHER_PLAYER_PICK.label })
    .click();
  await otherPlayerCard
    .getByRole("option", { name: "Other player", exact: true })
    .click();
  await expect(
    otherPlayerCard.getByRole("combobox", { name: OTHER_PLAYER_PICK.label }),
  ).toHaveValue("Other player");
  const otherPlayerName = otherPlayerCard.getByLabel("Player’s full name");
  await otherPlayerName.fill(customPlayerName);
  await expect(otherPlayerName).toHaveValue(customPlayerName);

  for (const pick of TEAM_PICKS) {
    const card = page.locator(`[data-category="${pick.category}"]`);
    const combobox = card.getByRole("combobox", { name: pick.label });
    await combobox.click();
    await card.getByRole("option", { name: pick.option, exact: true }).click();
    await expect(combobox).toHaveValue(pick.option);
  }

  await expect(
    page.getByText(/^7 of 7 spotlight categories started\./u),
  ).toBeVisible();
  return selectedPlayerNames;
}
