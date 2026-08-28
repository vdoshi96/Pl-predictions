import { createHash } from "node:crypto";

import { z } from "zod";

import { rankMetricItems } from "@/features/scoring/categories";
import { PublicError } from "@/shared/errors";

import {
  SPOTLIGHT_RESULT_DATASETS,
  getResultDatasetDefinition,
  type SpotlightResultDataset,
  type SpotlightResultDraftInput,
  type SpotlightResultDraftRow,
} from "./types";

const draftRowSchema = z
  .object({
    metricValue: z.number().finite().nonnegative().max(99_999),
    subjectId: z.string().uuid(),
  })
  .strict();

export const spotlightResultDraftSchema = z
  .object({
    capturedAt: z.string().datetime({ offset: true }),
    coveredThroughRank: z.number().int().min(1).max(1000).nullable(),
    dataset: z.enum(SPOTLIGHT_RESULT_DATASETS),
    expectedWorkingSnapshotId: z.string().uuid().nullable(),
    rows: z.array(draftRowSchema).min(1).max(1000),
    source: z.string().trim().min(2).max(64),
    sourceReference: z.string().trim().max(2048).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.rows.forEach((row, index) => {
      if (seen.has(row.subjectId)) {
        context.addIssue({
          code: "custom",
          message: "Each player or club may appear only once.",
          path: ["rows", index, "subjectId"],
        });
      }
      seen.add(row.subjectId);

      if (
        value.dataset !== "player_ratings" &&
        !Number.isInteger(row.metricValue)
      ) {
        context.addIssue({
          code: "custom",
          message: "Goals, assists, and clean sheets must be whole numbers.",
          path: ["rows", index, "metricValue"],
        });
      }
      if (
        value.dataset === "player_ratings" &&
        (row.metricValue > 10 ||
          Math.abs(
            Math.round(row.metricValue * 1000) - row.metricValue * 1000,
          ) > 1e-9)
      ) {
        context.addIssue({
          code: "custom",
          message: "Ratings must be between 0 and 10 with at most 3 decimals.",
          path: ["rows", index, "metricValue"],
        });
      }
    });

    const definition = getResultDatasetDefinition(value.dataset);
    if (definition.subject === "team" && value.rows.length > 20) {
      context.addIssue({
        code: "custom",
        message: "A club result list cannot contain more than 20 clubs.",
        path: ["rows"],
      });
    }
  });

export type RankedSpotlightResultRow = SpotlightResultDraftRow & {
  outcomeRank: number;
};

export function rankSpotlightResultRows(
  rows: readonly SpotlightResultDraftRow[],
  direction: "ascending" | "descending" = "descending",
): RankedSpotlightResultRow[] {
  return rankMetricItems(
    rows.map((row) => ({
      id: row.subjectId,
      metric: row.metricValue,
      ...row,
    })),
    direction,
  ).map(({ rank, ...row }) => ({
    metricValue: row.metricValue,
    outcomeRank: rank,
    subjectId: row.subjectId,
  }));
}

function directionHasCoverage(
  rows: readonly SpotlightResultDraftRow[],
  coveredThroughRank: number,
  direction: "ascending" | "descending",
): boolean {
  const ranked = rankSpotlightResultRows(rows, direction);
  const covered = ranked.filter((row) => row.outcomeRank <= coveredThroughRank);
  return covered.length >= coveredThroughRank;
}

/**
 * Publishing turns omitted subjects into a resolved zero only when the owner
 * has supplied every occupied position through the declared boundary. Ties at
 * that boundary may make the row count larger than the boundary.
 */
export function assertPublishableCoverage(
  dataset: SpotlightResultDataset,
  rows: readonly SpotlightResultDraftRow[],
  coveredThroughRank: number | null,
  availableSubjectCount = Number.POSITIVE_INFINITY,
): asserts coveredThroughRank is number {
  if (coveredThroughRank === null) {
    throw new PublicError(
      "BAD_REQUEST",
      "Enter the rank through which this result list is complete.",
    );
  }

  if (
    !Number.isInteger(availableSubjectCount) &&
    availableSubjectCount !== Number.POSITIVE_INFINITY
  ) {
    throw new PublicError(
      "BAD_REQUEST",
      "The available result-subject count is invalid.",
    );
  }

  const directionCoverage = Math.min(coveredThroughRank, availableSubjectCount);

  if (!directionHasCoverage(rows, directionCoverage, "descending")) {
    throw new PublicError(
      "BAD_REQUEST",
      `Include every row and boundary tie through rank ${coveredThroughRank}.`,
    );
  }

  if (dataset === "player_ratings") {
    const minimumTwoSidedRows = Math.min(
      coveredThroughRank * 2,
      availableSubjectCount,
    );
    if (
      rows.length < minimumTwoSidedRows ||
      !directionHasCoverage(rows, directionCoverage, "ascending")
    ) {
      throw new PublicError(
        "BAD_REQUEST",
        `Ratings must cover every high and low row, including ties, through rank ${coveredThroughRank}.`,
      );
    }
  }
}

export function assertPickedRatingSubjects(
  rows: readonly SpotlightResultDraftRow[],
  pickedSubjectIds: readonly string[],
): void {
  const rowIds = new Set(rows.map((row) => row.subjectId));
  const pickedIds = new Set(pickedSubjectIds);
  const unpicked = [...rowIds].filter((subjectId) => !pickedIds.has(subjectId));
  if (unpicked.length > 0) {
    throw new PublicError(
      "BAD_REQUEST",
      `Remove unpicked players from the rating draft. ${unpicked.length} ${unpicked.length === 1 ? "row is" : "rows are"} outside the picked-player pools.`,
    );
  }
}

export function parseSpotlightResultDraft(
  input: unknown,
): SpotlightResultDraftInput {
  return spotlightResultDraftSchema.parse(input);
}

export function spotlightResultContentHash(
  input: Pick<
    SpotlightResultDraftInput,
    "coveredThroughRank" | "dataset" | "rows"
  >,
): string {
  const canonical = {
    coveredThroughRank: input.coveredThroughRank,
    dataset: input.dataset,
    rows: [...input.rows]
      .sort((left, right) => left.subjectId.localeCompare(right.subjectId))
      .map((row) => ({
        metricValue: Number(row.metricValue.toFixed(3)),
        subjectId: row.subjectId,
      })),
    version: 1,
  };
  return createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}
