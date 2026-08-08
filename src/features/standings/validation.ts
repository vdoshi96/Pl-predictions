import { z } from "zod";

import {
  PREMIER_LEAGUE_2026_27_TEAM_SLUGS,
  PREMIER_LEAGUE_MATCH_COUNT,
  PREMIER_LEAGUE_TEAM_COUNT,
} from "@/data";

const teamSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

/**
 * Permit ordinary provider/host clock drift without allowing a bad automation
 * clock to activate a far-future snapshot and poison the monotonic stale guard.
 */
export const STANDINGS_TIMESTAMP_MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
export const STANDINGS_FUTURE_TIMESTAMP_ERROR_CODE = "future_timestamp";

type StandingsTimestampMetadata = {
  capturedAt: string;
  sourceUpdatedAt: string | null;
};

export type StandingsFutureTimestampViolation = {
  field: keyof StandingsTimestampMetadata;
  latestAllowedAt: Date;
  receivedAt: Date;
};

export function findStandingsFutureTimestampViolation(
  metadata: StandingsTimestampMetadata,
  authoritativeNow: Date,
): StandingsFutureTimestampViolation | null {
  const authoritativeTime = authoritativeNow.getTime();
  if (!Number.isFinite(authoritativeTime)) {
    throw new Error("An authoritative current timestamp is required.");
  }

  const latestAllowedAt = new Date(
    authoritativeTime + STANDINGS_TIMESTAMP_MAX_FUTURE_SKEW_MS,
  );
  const candidates: Array<[keyof StandingsTimestampMetadata, string | null]> = [
    ["capturedAt", metadata.capturedAt],
    ["sourceUpdatedAt", metadata.sourceUpdatedAt],
  ];

  for (const [field, value] of candidates) {
    if (!value) continue;

    const receivedAt = new Date(value);
    if (receivedAt.getTime() > latestAllowedAt.getTime()) {
      return { field, latestAllowedAt, receivedAt };
    }
  }

  return null;
}

const nullablePlayedGamesSchema = z
  .number()
  .int()
  .min(0)
  .max(PREMIER_LEAGUE_MATCH_COUNT)
  .nullable()
  .default(null);

// A points deduction can make a total negative, so the lower bound is not zero.
const nullableLeaguePointsSchema = z
  .number()
  .int()
  .min(-100)
  .max(PREMIER_LEAGUE_MATCH_COUNT * 3)
  .nullable()
  .default(null);

export const canonicalStandingsItemSchema = z
  .object({
    actualPosition: z.number().int().min(1).max(PREMIER_LEAGUE_TEAM_COUNT),
    leaguePoints: nullableLeaguePointsSchema,
    playedGames: nullablePlayedGamesSchema,
    teamSlug: teamSlugSchema,
  })
  .strict();

export const standingsItemsSchema = z
  .array(canonicalStandingsItemSchema)
  .length(
    PREMIER_LEAGUE_TEAM_COUNT,
    `A standings snapshot must contain exactly ${PREMIER_LEAGUE_TEAM_COUNT} teams.`,
  )
  .superRefine((items, context) => {
    const teamSlugs = new Set<string>();
    const positions = new Set<number>();

    items.forEach((item, index) => {
      if (teamSlugs.has(item.teamSlug)) {
        context.addIssue({
          code: "custom",
          message: "Each team may appear only once in a standings snapshot.",
          path: [index, "teamSlug"],
        });
      }

      if (positions.has(item.actualPosition)) {
        context.addIssue({
          code: "custom",
          message: "Each actual position may appear only once.",
          path: [index, "actualPosition"],
        });
      }

      teamSlugs.add(item.teamSlug);
      positions.add(item.actualPosition);
    });

    const missingPositions = Array.from(
      { length: PREMIER_LEAGUE_TEAM_COUNT },
      (_, index) => index + 1,
    ).filter((position) => !positions.has(position));

    if (missingPositions.length > 0) {
      context.addIssue({
        code: "custom",
        message: `Missing actual position${missingPositions.length === 1 ? "" : "s"}: ${missingPositions.join(", ")}.`,
      });
    }
  });

export function createStandingsItemsSchema(knownTeamSlugs: readonly string[]) {
  if (
    knownTeamSlugs.length !== PREMIER_LEAGUE_TEAM_COUNT ||
    new Set(knownTeamSlugs).size !== PREMIER_LEAGUE_TEAM_COUNT
  ) {
    throw new Error(
      "Standings validation requires 20 unique active team slugs.",
    );
  }

  const knownTeamSlugSet = new Set(knownTeamSlugs);

  return standingsItemsSchema.superRefine((items, context) => {
    items.forEach((item, index) => {
      if (!knownTeamSlugSet.has(item.teamSlug)) {
        context.addIssue({
          code: "custom",
          message: "The snapshot contains a team outside the active season.",
          path: [index, "teamSlug"],
        });
      }
    });

    const submittedTeamSlugs = new Set(items.map((item) => item.teamSlug));
    const missingTeamCount = knownTeamSlugs.filter(
      (teamSlug) => !submittedTeamSlugs.has(teamSlug),
    ).length;

    if (missingTeamCount > 0) {
      context.addIssue({
        code: "custom",
        message: `The snapshot is missing ${missingTeamCount} active team${missingTeamCount === 1 ? "" : "s"}.`,
      });
    }
  });
}

const canonicalSnapshotMetadataSchema = z
  .object({
    capturedAt: z.string().datetime({ offset: true }),
    // Advisory source metadata only. Importers always create provisional
    // snapshots; authenticated admin finalization is a separate mutation.
    isFinal: z.boolean().default(false),
    kind: z.literal("snapshot"),
    matchweek: z
      .number()
      .int()
      .min(1)
      .max(PREMIER_LEAGUE_MATCH_COUNT)
      .nullable()
      .default(null),
    seasonSlug: teamSlugSchema,
    source: z.string().trim().min(1).max(64),
    sourceReference: z.string().url().max(2048).nullable().default(null),
    sourceUpdatedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .default(null),
    version: z.literal(1),
  })
  .strict();

export const canonicalStandingsSnapshotBaseSchema =
  canonicalSnapshotMetadataSchema.extend({
    standings: standingsItemsSchema,
  });

export function createCanonicalStandingsSnapshotSchema(
  knownTeamSlugs: readonly string[],
) {
  return canonicalSnapshotMetadataSchema.extend({
    standings: createStandingsItemsSchema(knownTeamSlugs),
  });
}

export const canonicalStandingsSnapshotSchema =
  createCanonicalStandingsSnapshotSchema(PREMIER_LEAGUE_2026_27_TEAM_SLUGS);

export const canonicalStandingsFailureCodeSchema = z.enum([
  "authentication_failed",
  "invalid_source_data",
  "permission_denied",
  "rate_limited",
  "source_unavailable",
  "unknown",
]);

export const canonicalStandingsFailureSchema = z
  .object({
    code: canonicalStandingsFailureCodeSchema,
    kind: z.literal("failure"),
    message: z.string().trim().min(1).max(500),
    observedAt: z.string().datetime({ offset: true }),
    seasonSlug: teamSlugSchema,
    source: z.string().trim().min(1).max(64),
    version: z.literal(1),
  })
  .strict();

export const canonicalStandingsImportEnvelopeSchema = z.discriminatedUnion(
  "kind",
  [canonicalStandingsSnapshotBaseSchema, canonicalStandingsFailureSchema],
);

export const canonicalStandingsImportPayloadSchema = z.discriminatedUnion(
  "kind",
  [canonicalStandingsSnapshotSchema, canonicalStandingsFailureSchema],
);
