import {
  PREDICTION_CATEGORY_DEFINITIONS,
  type PredictionCategory,
} from "./categories";
import type { SpotlightPicksDraft } from "./spotlight-predictions-form";

export function normalizedCustomName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizedCustomNameKey(value: string) {
  return normalizedCustomName(value).toLocaleLowerCase("en-GB");
}

export function spotlightPicksAreComplete(picks: SpotlightPicksDraft): boolean {
  return spotlightIncompleteCategories(picks).length === 0;
}

export function spotlightIncompleteCategories(
  picks: SpotlightPicksDraft,
): PredictionCategory[] {
  return PREDICTION_CATEGORY_DEFINITIONS.flatMap((definition) => {
    const pick = picks[definition.category];
    if (!pick) return [definition.category];

    if (definition.subject === "team") {
      return pick.kind === "team" && Boolean(pick.teamId)
        ? []
        : [definition.category];
    }

    if (pick.kind === "player") {
      return pick.playerId && pick.displayName.trim()
        ? []
        : [definition.category];
    }
    return pick.kind === "custom-player" &&
      normalizedCustomName(pick.customPlayerName).length >= 2 &&
      normalizedCustomName(pick.customPlayerName).length <= 120 &&
      normalizedCustomNameKey(pick.customPlayerName).length <= 120
      ? []
      : [definition.category];
  });
}
