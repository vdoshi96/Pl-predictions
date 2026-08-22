import { z } from "zod";

import { PREMIER_LEAGUE_TEAM_COUNT } from "@/data";

import {
  PREDICTION_CATEGORIES,
  PLAYER_PREDICTION_CATEGORIES,
  TEAM_PREDICTION_CATEGORIES,
} from "./categories";
import {
  hasDisallowedControlCharacter,
  normalizeDisplayText,
  normalizeParticipantName,
  normalizedDisplayTextKey,
  normalizedParticipantNameKey,
} from "./normalization";

const POSITION_VALUES = Array.from(
  { length: PREMIER_LEAGUE_TEAM_COUNT },
  (_, index) => index + 1,
);

export const participantNameSchema = z
  .string()
  .refine((value) => !hasDisallowedControlCharacter(value), {
    message: "Display names cannot contain control characters.",
  })
  .transform(normalizeParticipantName)
  .pipe(
    z
      .string()
      .min(2, "Enter a display name with at least 2 characters.")
      .max(40, "Display names must be 40 characters or fewer."),
  )
  .superRefine((value, context) => {
    if (normalizedParticipantNameKey(value).length > 40) {
      context.addIssue({
        code: "custom",
        message: "That display name cannot be normalized safely.",
      });
    }
  });

export const normalizedParticipantNameKeySchema =
  participantNameSchema.transform(normalizedParticipantNameKey);

export const customPlayerNameSchema = z
  .string()
  .refine((value) => !hasDisallowedControlCharacter(value), {
    message: "Player names cannot contain control characters.",
  })
  .transform(normalizeDisplayText)
  .pipe(
    z
      .string()
      .min(2, "Enter a player name with at least 2 characters.")
      .max(120, "Player names must be 120 characters or fewer."),
  )
  .superRefine((value, context) => {
    if (normalizedDisplayTextKey(value).length > 120) {
      context.addIssue({
        code: "custom",
        message: "That player name cannot be normalized safely.",
      });
    }
  });

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

const teamCategoryPickSchema = z
  .object({
    category: z.enum(TEAM_PREDICTION_CATEGORIES),
    teamId: z.string().uuid(),
  })
  .strict();

const catalogPlayerCategoryPickSchema = z
  .object({
    category: z.enum(PLAYER_PREDICTION_CATEGORIES),
    playerId: z.string().uuid(),
  })
  .strict();

const customPlayerCategoryPickSchema = z
  .object({
    category: z.enum(PLAYER_PREDICTION_CATEGORIES),
    customPlayerName: customPlayerNameSchema,
  })
  .strict();

export const predictionCategoryPickSchema = z.union([
  teamCategoryPickSchema,
  catalogPlayerCategoryPickSchema,
  customPlayerCategoryPickSchema,
]);

export const predictionCategoryPicksSchema = z
  .array(predictionCategoryPickSchema)
  .length(
    PREDICTION_CATEGORIES.length,
    `A prediction must contain exactly ${PREDICTION_CATEGORIES.length} spotlight picks.`,
  )
  .superRefine((picks, context) => {
    const categories = new Set<string>();

    picks.forEach((pick, index) => {
      if (categories.has(pick.category)) {
        context.addIssue({
          code: "custom",
          message: "Each spotlight category may appear only once.",
          path: [index, "category"],
        });
      }
      categories.add(pick.category);
    });

    const missing = PREDICTION_CATEGORIES.filter(
      (category) => !categories.has(category),
    );
    if (missing.length > 0) {
      context.addIssue({
        code: "custom",
        message: `Missing spotlight categor${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}.`,
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

export function createPredictionCategoryPicksSchema(
  activeTeamIds: readonly string[],
  activePlayerIds: readonly string[],
) {
  const activeTeamIdSet = new Set(activeTeamIds);
  const activePlayerIdSet = new Set(activePlayerIds);

  return predictionCategoryPicksSchema.superRefine((picks, context) => {
    picks.forEach((pick, index) => {
      if ("teamId" in pick && !activeTeamIdSet.has(pick.teamId)) {
        context.addIssue({
          code: "custom",
          message: "Choose a club from the active season.",
          path: [index, "teamId"],
        });
      }

      if ("playerId" in pick && !activePlayerIdSet.has(pick.playerId)) {
        context.addIssue({
          code: "custom",
          message: "Choose an available player or use Other player.",
          path: [index, "playerId"],
        });
      }
    });
  });
}

export function createPredictionSubmissionSchema(
  activeTeamIds: readonly string[],
  activePlayerIds: readonly string[] = [],
) {
  return z
    .object({
      categoryPicks: createPredictionCategoryPicksSchema(
        activeTeamIds,
        activePlayerIds,
      ),
      items: createPredictionItemsSchema(activeTeamIds),
      participantName: participantNameSchema,
    })
    .strict();
}

export type ValidatedPredictionItem = z.infer<typeof predictionItemSchema>;
export type ValidatedPredictionItems = z.infer<typeof predictionItemsSchema>;
export type ValidatedPredictionCategoryPick = z.infer<
  typeof predictionCategoryPickSchema
>;
export type ValidatedPredictionCategoryPicks = z.infer<
  typeof predictionCategoryPicksSchema
>;
