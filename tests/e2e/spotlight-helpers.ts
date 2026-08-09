import { expect, type Page } from "@playwright/test";

const CATALOG_PLAYER_PICKS = [
  {
    category: "top_scorer",
    label: "Top scorer",
    option: "Cole Palmer",
    search: "Cole",
  },
  {
    category: "top_assister",
    label: "Top assister",
    option: "Declan Rice",
    search: "Rice",
  },
  {
    category: "underdog_player",
    label: "Underdog player",
    option: "Elliot Anderson",
    search: "Anderson",
  },
] as const;

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

export async function completeSpotlightPicks(
  page: Page,
  customNamePrefix: string,
): Promise<string[]> {
  const selectedPlayerNames: string[] = CATALOG_PLAYER_PICKS.map(
    (pick) => pick.option,
  );

  for (const pick of CATALOG_PLAYER_PICKS) {
    const card = page.locator(`[data-category="${pick.category}"]`);
    const combobox = card.getByRole("combobox", { name: pick.label });

    await combobox.click();
    await combobox.fill(pick.search);
    const option = card.getByRole("option", {
      name: pick.option,
      exact: true,
    });
    await expect(option).toBeVisible();
    await expect(option.locator("img")).toBeVisible();
    await option.click();
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
  await otherPlayerCard.getByLabel("Player’s full name").fill(customPlayerName);

  for (const pick of TEAM_PICKS) {
    const card = page.locator(`[data-category="${pick.category}"]`);
    await card.getByRole("combobox", { name: pick.label }).click();
    await card.getByRole("option", { name: pick.option, exact: true }).click();
  }

  await expect(
    page.getByText("7 of 7 spotlight categories started.", { exact: true }),
  ).toBeVisible();
  return selectedPlayerNames;
}
