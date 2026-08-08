import { z } from "zod";

import { PREMIER_LEAGUE_TEAM_COUNT } from "@/data";

import {
  normalizeParticipantName,
  normalizedParticipantNameKey,
} from "./normalization";

const POSITION_VALUES = Array.from(
  { length: PREMIER_LEAGUE_TEAM_COUNT },
  (_, index) => index + 1,
);

export const participantNameSchema = z
  .string()
  .transform(normalizeParticipantName)
  .pipe(
    z
      .string()
      .min(2, "Enter a display name with at least 2 characters.")
      .max(40, "Display names must be 40 characters or fewer."),
  );

export const normalizedParticipantNameKeySchema =
  participantNameSchema.transform(normalizedParticipantNameKey);

export const predictionItemSchema = z
  .object({
    predictedPosition: z.number().int().min(1).max(PREMIER_LEAGUE_TEAM_COUNT),
    teamId: z.string().uuid(),
  })
  .strict();

export const predictionItemsSchema = z
  .array(predictionItemSchema)
  .length(
    PREMIER_LEAGUE_TEAM_COUNT,
    `A prediction must contain exactly ${PREMIER_LEAGUE_TEAM_COUNT} teams.`,
  )
  .superRefine((items, context) => {
    const teamIds = new Set<string>();
    const positions = new Set<number>();

    items.forEach((item, index) => {
      if (teamIds.has(item.teamId)) {
        context.addIssue({
          code: "custom",
          message: "Each team may appear only once.",
          path: [index, "teamId"],
        });
      }

      if (positions.has(item.predictedPosition)) {
        context.addIssue({
          code: "custom",
          message: "Each predicted position may appear only once.",
          path: [index, "predictedPosition"],
        });
      }

      teamIds.add(item.teamId);
      positions.add(item.predictedPosition);
    });

    const missingPositions = POSITION_VALUES.filter(
      (position) => !positions.has(position),
    );
    if (missingPositions.length > 0) {
      context.addIssue({
        code: "custom",
        message: `Missing predicted position${missingPositions.length === 1 ? "" : "s"}: ${missingPositions.join(", ")}.`,
      });
    }
  });

export function createPredictionItemsSchema(activeTeamIds: readonly string[]) {
  if (
    activeTeamIds.length !== PREMIER_LEAGUE_TEAM_COUNT ||
    new Set(activeTeamIds).size !== PREMIER_LEAGUE_TEAM_COUNT
  ) {
    throw new Error(
      "Prediction validation requires 20 unique active team IDs.",
    );
  }

  const activeTeamIdSet = new Set(activeTeamIds);

  return predictionItemsSchema.superRefine((items, context) => {
    items.forEach((item, index) => {
      if (!activeTeamIdSet.has(item.teamId)) {
        context.addIssue({
          code: "custom",
          message: "The prediction contains a team outside the active season.",
          path: [index, "teamId"],
        });
      }
    });

    const submittedTeamIds = new Set(items.map((item) => item.teamId));
    const missingTeamCount = activeTeamIds.filter(
      (teamId) => !submittedTeamIds.has(teamId),
    ).length;

    if (missingTeamCount > 0) {
      context.addIssue({
        code: "custom",
        message: `The prediction is missing ${missingTeamCount} active team${missingTeamCount === 1 ? "" : "s"}.`,
      });
    }
  });
}

export function createPredictionSubmissionSchema(
  activeTeamIds: readonly string[],
) {
  return z
    .object({
      items: createPredictionItemsSchema(activeTeamIds),
      participantName: participantNameSchema,
    })
    .strict();
}

export type ValidatedPredictionItem = z.infer<typeof predictionItemSchema>;
export type ValidatedPredictionItems = z.infer<typeof predictionItemsSchema>;
