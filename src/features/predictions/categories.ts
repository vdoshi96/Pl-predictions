export const PLAYER_PREDICTION_CATEGORIES = [
  "top_scorer",
  "top_assister",
  "underdog_player",
  "overrated_player",
] as const;

export const TEAM_PREDICTION_CATEGORIES = [
  "most_clean_sheets",
  "underdog_team",
  "overrated_team",
] as const;

export const PREDICTION_CATEGORIES = [
  "top_scorer",
  "top_assister",
  "most_clean_sheets",
  "underdog_team",
  "overrated_team",
  "underdog_player",
  "overrated_player",
] as const;

export type PlayerPredictionCategory =
  (typeof PLAYER_PREDICTION_CATEGORIES)[number];
export type TeamPredictionCategory =
  (typeof TEAM_PREDICTION_CATEGORIES)[number];
export type PredictionCategory = (typeof PREDICTION_CATEGORIES)[number];

export type PredictionCategoryDefinition = Readonly<{
  category: PredictionCategory;
  description: string;
  label: string;
  subject: "player" | "team";
}>;

export const PREDICTION_CATEGORY_DEFINITIONS = [
  {
    category: "top_scorer",
    description: "Who will finish highest in the league goals ranking?",
    label: "Top scorer",
    subject: "player",
  },
  {
    category: "top_assister",
    description: "Who will finish highest in the league assists ranking?",
    label: "Top assister",
    subject: "player",
  },
  {
    category: "most_clean_sheets",
    description: "Which club will finish highest in the clean-sheets ranking?",
    label: "Most clean sheets",
    subject: "team",
  },
  {
    category: "underdog_team",
    description:
      "Which club will outperform the group’s average prediction most?",
    label: "Underdog team",
    subject: "team",
  },
  {
    category: "overrated_team",
    description:
      "Which club will underperform the group’s average prediction most?",
    label: "Overrated team",
    subject: "team",
  },
  {
    category: "underdog_player",
    description: "Which player will rank highest by average season rating?",
    label: "Underdog player",
    subject: "player",
  },
  {
    category: "overrated_player",
    description: "Which player will rank lowest by average season rating?",
    label: "Overrated player",
    subject: "player",
  },
] as const satisfies readonly PredictionCategoryDefinition[];

export const PREDICTION_CATEGORY_LABEL = Object.fromEntries(
  PREDICTION_CATEGORY_DEFINITIONS.map((definition) => [
    definition.category,
    definition.label,
  ]),
) as Record<PredictionCategory, string>;

export function isPredictionCategory(
  value: string,
): value is PredictionCategory {
  return (PREDICTION_CATEGORIES as readonly string[]).includes(value);
}

export function isPlayerPredictionCategory(
  category: PredictionCategory,
): category is PlayerPredictionCategory {
  return (PLAYER_PREDICTION_CATEGORIES as readonly string[]).includes(category);
}

export function isTeamPredictionCategory(
  category: PredictionCategory,
): category is TeamPredictionCategory {
  return (TEAM_PREDICTION_CATEGORIES as readonly string[]).includes(category);
}
