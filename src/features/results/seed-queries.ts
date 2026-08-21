import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { predictionCategoryPicks, predictions } from "@/db/schema";
import { isPredictionCategory } from "@/features/predictions/categories";

import {
  RESULT_DATASET_BY_CATEGORY,
  SPOTLIGHT_RESULT_DATASETS,
  type SpotlightResultDataset,
} from "./types";

export type PickedSubjectsByDataset = Readonly<
  Record<SpotlightResultDataset, readonly string[]>
>;

export async function getPickedSubjectsByDataset(
  seasonId: string,
): Promise<PickedSubjectsByDataset> {
  const picked = Object.fromEntries(
    SPOTLIGHT_RESULT_DATASETS.map((dataset) => [dataset, [] as string[]]),
  ) as Record<SpotlightResultDataset, string[]>;

  const rows = await getDb()
    .select({
      category: predictionCategoryPicks.category,
      playerId: predictionCategoryPicks.playerId,
      teamId: predictionCategoryPicks.teamId,
    })
    .from(predictionCategoryPicks)
    .innerJoin(
      predictions,
      eq(predictions.id, predictionCategoryPicks.predictionId),
    )
    .where(eq(predictions.seasonId, seasonId));

  for (const row of rows) {
    if (!isPredictionCategory(row.category)) continue;
    const dataset = RESULT_DATASET_BY_CATEGORY[row.category];
    if (!dataset) continue;
    const subjectId = row.playerId ?? row.teamId;
    if (!subjectId) continue;
    const bucket = picked[dataset];
    if (!bucket.includes(subjectId)) bucket.push(subjectId);
  }
  return picked;
}
