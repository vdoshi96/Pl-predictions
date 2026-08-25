import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  predictionCategoryPicks,
  predictions,
  spotlightResultAliases,
} from "@/db/schema";
import {
  isPredictionCategory,
  PREDICTION_CATEGORIES,
  type PredictionCategory,
} from "@/features/predictions/categories";

import {
  RESULT_DATASET_BY_CATEGORY,
  SPOTLIGHT_RESULT_DATASETS,
  type SpotlightResultDataset,
} from "./types";

export type PickedSubjectsByDataset = Readonly<
  Record<SpotlightResultDataset, readonly string[]>
>;

export type PickedSubjectsByCategory = Readonly<
  Record<PredictionCategory, readonly string[]>
>;

export async function getPickedSubjectsByCategory(
  seasonId: string,
  options: { resolveAliases?: boolean } = {},
): Promise<PickedSubjectsByCategory> {
  const resolveAliases = options.resolveAliases ?? true;
  const picked = Object.fromEntries(
    PREDICTION_CATEGORIES.map((category) => [category, [] as string[]]),
  ) as Record<PredictionCategory, string[]>;

  const rows = await getDb()
    .select({
      aliasPlayerId: spotlightResultAliases.playerId,
      category: predictionCategoryPicks.category,
      playerId: predictionCategoryPicks.playerId,
      teamId: predictionCategoryPicks.teamId,
    })
    .from(predictionCategoryPicks)
    .innerJoin(
      predictions,
      eq(predictions.id, predictionCategoryPicks.predictionId),
    )
    .leftJoin(
      spotlightResultAliases,
      and(
        eq(spotlightResultAliases.seasonId, seasonId),
        eq(
          spotlightResultAliases.normalizedCustomPlayerName,
          predictionCategoryPicks.normalizedCustomPlayerName,
        ),
      ),
    )
    .where(eq(predictions.seasonId, seasonId));

  for (const row of rows) {
    if (!isPredictionCategory(row.category)) continue;
    const subjectId =
      row.playerId ?? row.teamId ?? (resolveAliases ? row.aliasPlayerId : null);
    if (!subjectId) continue;
    const bucket = picked[row.category];
    if (!bucket.includes(subjectId)) bucket.push(subjectId);
  }

  return picked;
}

export async function getPickedSubjectsByDataset(
  seasonId: string,
): Promise<PickedSubjectsByDataset> {
  const picked = Object.fromEntries(
    SPOTLIGHT_RESULT_DATASETS.map((dataset) => [dataset, [] as string[]]),
  ) as Record<SpotlightResultDataset, string[]>;

  const byCategory = await getPickedSubjectsByCategory(seasonId);
  for (const category of PREDICTION_CATEGORIES) {
    const dataset = RESULT_DATASET_BY_CATEGORY[category];
    if (!dataset) continue;
    for (const subjectId of byCategory[category]) {
      const bucket = picked[dataset];
      if (!bucket.includes(subjectId)) bucket.push(subjectId);
    }
  }
  return picked;
}
