import type { PredictionCategory } from "@/features/predictions/categories";

export const SPOTLIGHT_RESULT_DATASETS = [
  "goals",
  "assists",
  "clean_sheets",
  "player_ratings",
] as const;

export type SpotlightResultDataset = (typeof SPOTLIGHT_RESULT_DATASETS)[number];

export type SpotlightResultSubject = "player" | "team";

export type SpotlightResultDatasetDefinition = Readonly<{
  dataset: SpotlightResultDataset;
  labels: readonly string[];
  metricLabel: string;
  subject: SpotlightResultSubject;
}>;

export const SPOTLIGHT_RESULT_DATASET_DEFINITIONS = [
  {
    dataset: "goals",
    labels: ["Top scorer"],
    metricLabel: "Goals",
    subject: "player",
  },
  {
    dataset: "assists",
    labels: ["Top assister"],
    metricLabel: "Assists",
    subject: "player",
  },
  {
    dataset: "clean_sheets",
    labels: ["Most clean sheets"],
    metricLabel: "Clean sheets",
    subject: "team",
  },
  {
    dataset: "player_ratings",
    labels: ["Underdog player", "Overrated player"],
    metricLabel: "Season rating",
    subject: "player",
  },
] as const satisfies readonly SpotlightResultDatasetDefinition[];

export const RESULT_DATASET_BY_CATEGORY: Partial<
  Record<PredictionCategory, SpotlightResultDataset>
> = {
  most_clean_sheets: "clean_sheets",
  overrated_player: "player_ratings",
  top_assister: "assists",
  top_scorer: "goals",
  underdog_player: "player_ratings",
};

export const RESULT_CATEGORIES_BY_DATASET = {
  assists: ["top_assister"],
  clean_sheets: [],
  goals: ["top_scorer"],
  player_ratings: ["underdog_player", "overrated_player"],
} as const satisfies Record<
  SpotlightResultDataset,
  readonly PredictionCategory[]
>;

export type SpotlightResultDraftRow = Readonly<{
  metricValue: number;
  subjectId: string;
}>;

export type SpotlightResultDraftInput = Readonly<{
  capturedAt: string;
  coveredThroughRank: number | null;
  dataset: SpotlightResultDataset;
  expectedWorkingSnapshotId: string | null;
  rows: readonly SpotlightResultDraftRow[];
  source: string;
  sourceReference: string | null;
}>;

export type SpotlightResultActionResult =
  | Readonly<{
      message: string;
      ok: true;
      pinnedAliases?: readonly {
        normalizedCustomPlayerName: string;
        playerId: string;
      }[];
      playerId?: string;
      snapshotId?: string;
    }>
  | Readonly<{ message: string; ok: false }>;

export function isSpotlightResultDataset(
  value: string,
): value is SpotlightResultDataset {
  return (SPOTLIGHT_RESULT_DATASETS as readonly string[]).includes(value);
}

export function getResultDatasetDefinition(dataset: SpotlightResultDataset) {
  const definition = SPOTLIGHT_RESULT_DATASET_DEFINITIONS.find(
    (candidate) => candidate.dataset === dataset,
  );
  if (!definition)
    throw new Error(`Unsupported spotlight dataset: ${dataset}.`);
  return definition;
}
