import "server-only";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { players, predictionCategoryPicks, teams } from "@/db/schema";
import {
  isPredictionCategory,
  PREDICTION_CATEGORIES,
  PREDICTION_CATEGORY_LABEL,
  isTeamPredictionCategory,
} from "@/features/predictions/categories";

import type { SpotlightPickDisplay } from "./spotlight-pick-grid";

export async function getSpotlightPicksByPredictionId(
  predictionIds: readonly string[],
): Promise<Map<string, SpotlightPickDisplay[]>> {
  if (predictionIds.length === 0) return new Map();

  const rows = await getDb()
    .select({
      category: predictionCategoryPicks.category,
      customPlayerName: predictionCategoryPicks.customPlayerName,
      normalizedCustomPlayerName:
        predictionCategoryPicks.normalizedCustomPlayerName,
      playerAssetPath: players.assetPath,
      playerDisplayName: players.displayName,
      playerId: predictionCategoryPicks.playerId,
      predictionId: predictionCategoryPicks.predictionId,
      teamAssetPath: teams.assetPath,
      teamDisplayName: teams.displayName,
      teamId: predictionCategoryPicks.teamId,
      teamShortName: teams.shortName,
    })
    .from(predictionCategoryPicks)
    .leftJoin(players, eq(players.id, predictionCategoryPicks.playerId))
    .leftJoin(teams, eq(teams.id, predictionCategoryPicks.teamId))
    .where(inArray(predictionCategoryPicks.predictionId, [...predictionIds]));
  const grouped = new Map<string, SpotlightPickDisplay[]>();

  for (const row of rows) {
    if (!isPredictionCategory(row.category)) {
      throw new Error("A spotlight pick has an unsupported category.");
    }

    const teamSubject = isTeamPredictionCategory(row.category);
    const displayName = teamSubject
      ? row.teamDisplayName
      : (row.playerDisplayName ?? row.customPlayerName);
    if (!displayName) {
      throw new Error("A spotlight pick is missing its selected subject.");
    }

    const picks = grouped.get(row.predictionId) ?? [];
    picks.push({
      assetPath: teamSubject ? row.teamAssetPath : row.playerAssetPath,
      category: row.category,
      displayName,
      label: PREDICTION_CATEGORY_LABEL[row.category],
      normalizedCustomPlayerName: row.normalizedCustomPlayerName,
      playerId: row.playerId,
      shortName: teamSubject ? row.teamShortName : null,
      subject: teamSubject ? "team" : "player",
      teamId: row.teamId,
    });
    grouped.set(row.predictionId, picks);
  }

  const order = new Map(
    PREDICTION_CATEGORIES.map((category, index) => [category, index]),
  );
  for (const picks of grouped.values()) {
    picks.sort(
      (left, right) =>
        (order.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.category) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return grouped;
}
