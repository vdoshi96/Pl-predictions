import { z } from "zod";

import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data/teams";
import { participantNameSchema } from "@/features/predictions/validation";

const teamSlugSchema = z.enum(PREMIER_LEAGUE_2026_27_TEAM_SLUGS);
const fixtureResultSchema = z.enum(["home_win", "draw", "away_win", "void"]);

export const createWinStreakProfileInputSchema = z
  .object({
    displayName: participantNameSchema,
    website: z.string().max(200).default(""),
  })
  .strict();

export const winStreakPickInputSchema = z
  .object({ teamSlug: teamSlugSchema })
  .strict();

export const winStreakRoundResultsInputSchema = z
  .object({
    capturedAt: z.iso.datetime({ offset: true }),
    fixtures: z
      .array(
        z
          .object({
            fixtureId: z.uuid(),
            result: fixtureResultSchema,
          })
          .strict(),
      )
      .length(10),
    matchweek: z.number().int().min(2).max(38),
    source: z.string().trim().min(2).max(120),
    sourceReference: z.url().max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.fixtures.map((fixture) => fixture.fixtureId)).size !== 10
    ) {
      context.addIssue({
        code: "custom",
        message: "Provide one result for each fixture.",
        path: ["fixtures"],
      });
    }
  });

export type CreateWinStreakProfileInput = z.infer<
  typeof createWinStreakProfileInputSchema
>;
export type WinStreakPickInput = z.infer<typeof winStreakPickInputSchema>;
export type WinStreakRoundResultsInput = z.infer<
  typeof winStreakRoundResultsInputSchema
>;
