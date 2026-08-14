"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  players,
  predictions,
  predictionCategoryPicks,
  spotlightResultItems,
  spotlightResultSnapshotAliases,
  spotlightResultSnapshots,
  spotlightResultStates,
  teams,
} from "@/db/schema";
import { getAdminAuditMetadata, requireAdminMutation } from "@/features/admin";
import { normalizedDisplayTextKey } from "@/features/predictions/normalization";
import { customPlayerNameSchema } from "@/features/predictions/validation";
import {
  applyResultPointerTransition,
  assertPublishableCoverage,
  buildFinalizeResultQuery,
  buildPublishResultQuery,
  buildSaveResultAliasQuery,
  buildUndoFinalResultQuery,
  createResultOnlyPlayerAtomically,
  createStandaloneResultOnlyPlayerAtomically,
  getResultDatasetDefinition,
  parseSpotlightResultDraft,
  rankSpotlightResultRows,
  RESULT_CATEGORIES_BY_DATASET,
  saveResultDraftAtomically,
  SPOTLIGHT_RESULT_DATASETS,
  spotlightResultContentHash,
  type SpotlightResultActionResult,
  type SpotlightResultDraftInput,
} from "@/features/results";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { PublicError, safeErrorMessage } from "@/shared/errors";
import { getSeasonAccess } from "@/shared/policy";

const pointerSchema = z
  .object({
    activeSnapshotId: z.string().uuid().nullable(),
    dataset: z.enum(SPOTLIGHT_RESULT_DATASETS),
    finalSnapshotId: z.string().uuid().nullable(),
    workingSnapshotId: z.string().uuid().nullable(),
  })
  .strict();

const publishPointerSchema = pointerSchema
  .extend({ coverageAttested: z.literal(true) })
  .strict();

const aliasSchema = z
  .object({
    customPlayerName: z.string(),
    playerId: z.string().uuid(),
  })
  .strict();

function revalidateResultViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/results");
  revalidatePath("/spotlight");
  revalidatePath("/leaderboard");
  revalidatePath("/entries/[id]", "page");
}

function resultActionFailure(error: unknown): SpotlightResultActionResult {
  if (error instanceof z.ZodError) {
    return {
      message:
        error.issues[0]?.message ?? "Check every result row and try again.",
      ok: false,
    };
  }
  return { message: safeErrorMessage(error), ok: false };
}

async function assertSubjectsBelongToSeason(
  input: SpotlightResultDraftInput,
  seasonId: string,
) {
  const uniqueIds = [...new Set(input.rows.map((row) => row.subjectId))];
  const definition = getResultDatasetDefinition(input.dataset);
  const db = getDb();
  const rows =
    definition.subject === "player"
      ? await db
          .select({ id: players.id })
          .from(players)
          .where(
            and(eq(players.seasonId, seasonId), inArray(players.id, uniqueIds)),
          )
      : await db
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(eq(teams.seasonId, seasonId), inArray(teams.id, uniqueIds)),
          );
  if (rows.length !== uniqueIds.length) {
    throw new PublicError(
      "BAD_REQUEST",
      `Every ${definition.subject} must belong to the active season.`,
    );
  }
}

export async function saveSpotlightResultDraft(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const parsed = parseSpotlightResultDraft(input);
    const { databaseNow, season } = await getActiveSeasonContext();
    const capturedAt = new Date(parsed.capturedAt);
    if (capturedAt.getTime() > databaseNow.getTime() + 5 * 60_000) {
      throw new PublicError(
        "BAD_REQUEST",
        "The captured time cannot be more than five minutes in the future.",
      );
    }
    await assertSubjectsBelongToSeason(parsed, season.id);
    const definition = getResultDatasetDefinition(parsed.dataset);
    const db = getDb();
    await db
      .insert(spotlightResultStates)
      .values({ dataset: parsed.dataset, seasonId: season.id })
      .onConflictDoNothing();
    const audit = await getAdminAuditMetadata();
    const saved = await saveResultDraftAtomically(db, {
      capturedAt,
      contentHash: spotlightResultContentHash(parsed),
      coveredThroughRank: parsed.coveredThroughRank,
      dataset: parsed.dataset,
      expectedWorkingSnapshotId: parsed.expectedWorkingSnapshotId,
      requestId: audit.requestId,
      rows: rankSpotlightResultRows(parsed.rows),
      seasonId: season.id,
      source: parsed.source,
      sourceReference: parsed.sourceReference,
      subject: definition.subject,
    });
    if (!saved.applied || !saved.snapshotId) {
      throw new PublicError(
        "CONFLICT",
        "The working result changed. Refresh and review the current draft.",
      );
    }
    revalidateResultViews();
    return {
      message: "Draft saved. Public scoring is unchanged until you publish it.",
      ok: true,
      pinnedAliases: saved.pinnedAliases,
      snapshotId: saved.snapshotId,
    };
  } catch (error) {
    return resultActionFailure(error);
  }
}

export async function publishSpotlightResult(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const parsed = publishPointerSchema.parse(input);
    if (!parsed.workingSnapshotId) {
      throw new PublicError("BAD_REQUEST", "Save a draft before publishing.");
    }
    const { databaseNow, season } = await getActiveSeasonContext();
    const access = getSeasonAccess(
      {
        openingKickoff: season.openingKickoff,
        revealPredictions: season.revealPredictions,
        submissionsLocked: season.submissionsLocked,
      },
      databaseNow,
    );
    if (!access.predictionsRevealed || access.submissionsOpen) {
      throw new PublicError(
        "CONFLICT",
        "Permanently close submissions and reveal predictions before publishing results.",
      );
    }
    const db = getDb();
    const definition = getResultDatasetDefinition(parsed.dataset);
    const relevantCategories = RESULT_CATEGORIES_BY_DATASET[parsed.dataset];
    const unresolvedAliasesPromise =
      relevantCategories.length === 0
        ? Promise.resolve([] as { customPlayerName: string | null }[])
        : db
            .selectDistinct({
              customPlayerName: predictionCategoryPicks.customPlayerName,
            })
            .from(predictionCategoryPicks)
            .innerJoin(
              predictions,
              eq(predictions.id, predictionCategoryPicks.predictionId),
            )
            .leftJoin(
              spotlightResultSnapshotAliases,
              and(
                eq(
                  spotlightResultSnapshotAliases.snapshotId,
                  parsed.workingSnapshotId,
                ),
                eq(
                  spotlightResultSnapshotAliases.normalizedCustomPlayerName,
                  predictionCategoryPicks.normalizedCustomPlayerName,
                ),
              ),
            )
            .where(
              and(
                eq(predictions.seasonId, season.id),
                inArray(predictionCategoryPicks.category, [
                  ...relevantCategories,
                ]),
                isNotNull(predictionCategoryPicks.normalizedCustomPlayerName),
                isNull(spotlightResultSnapshotAliases.playerId),
              ),
            );
    const subjectCountPromise =
      definition.subject === "player"
        ? db
            .select({ value: count() })
            .from(players)
            .where(eq(players.seasonId, season.id))
        : db
            .select({ value: count() })
            .from(teams)
            .where(eq(teams.seasonId, season.id));
    const [
      [snapshot],
      [bracketCountRow],
      unresolvedAliases,
      [subjectCountRow],
    ] = await Promise.all([
      db
        .select({
          coveredThroughRank: spotlightResultSnapshots.coveredThroughRank,
          dataset: spotlightResultSnapshots.dataset,
          seasonId: spotlightResultSnapshots.seasonId,
        })
        .from(spotlightResultSnapshots)
        .where(eq(spotlightResultSnapshots.id, parsed.workingSnapshotId))
        .limit(1),
      db
        .select({ value: count() })
        .from(predictions)
        .where(eq(predictions.seasonId, season.id)),
      unresolvedAliasesPromise,
      subjectCountPromise,
    ]);
    if (
      !snapshot ||
      snapshot.seasonId !== season.id ||
      snapshot.dataset !== parsed.dataset
    ) {
      throw new PublicError("BAD_REQUEST", "That result draft is unavailable.");
    }
    const bracketCount = bracketCountRow?.value ?? 0;
    if (bracketCount < 1) {
      throw new PublicError(
        "BAD_REQUEST",
        "At least one submitted bracket is required before publishing results.",
      );
    }
    if (snapshot.coveredThroughRank !== bracketCount) {
      throw new PublicError(
        "BAD_REQUEST",
        `Coverage must equal the current ${bracketCount} submitted bracket${bracketCount === 1 ? "" : "s"}. Save a new draft with coverage through rank ${bracketCount}.`,
      );
    }
    if (unresolvedAliases.length > 0) {
      const sample = unresolvedAliases
        .slice(0, 3)
        .map((row) => row.customPlayerName)
        .filter(Boolean)
        .join(", ");
      throw new PublicError(
        "BAD_REQUEST",
        `Match every Other-player spelling before publishing${sample ? `: ${sample}${unresolvedAliases.length > 3 ? ", …" : ""}` : "."}`,
      );
    }
    const itemRows = await db
      .select({
        metricValue: spotlightResultItems.metricValue,
        playerId: spotlightResultItems.playerId,
        teamId: spotlightResultItems.teamId,
      })
      .from(spotlightResultItems)
      .where(eq(spotlightResultItems.snapshotId, parsed.workingSnapshotId));
    assertPublishableCoverage(
      parsed.dataset,
      itemRows.map((row) => ({
        metricValue: row.metricValue,
        subjectId: row.playerId ?? row.teamId ?? "",
      })),
      snapshot.coveredThroughRank,
      subjectCountRow?.value ?? 0,
    );
    const audit = await getAdminAuditMetadata();
    const applied = await applyResultPointerTransition(
      db,
      buildPublishResultQuery({
        ...parsed,
        expectedBracketCount: bracketCount,
        requestId: audit.requestId,
        seasonId: season.id,
      }),
    );
    if (!applied) {
      throw new PublicError(
        "CONFLICT",
        "The result state changed before publishing. Refresh and try again.",
      );
    }
    revalidateResultViews();
    return { message: "Provisional result published.", ok: true };
  } catch (error) {
    return resultActionFailure(error);
  }
}

function resultOnlyPlayerSlug(normalizedName: string) {
  const base = normalizedName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-GB")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 64);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  return `result-only-${base || "player"}-${suffix}`;
}

async function assertNoExistingCanonicalPlayer(
  seasonId: string,
  normalizedDisplayName: string,
) {
  const seasonPlayers = await getDb()
    .select({ displayName: players.displayName })
    .from(players)
    .where(eq(players.seasonId, seasonId));
  const existing = seasonPlayers.find(
    (player) =>
      normalizedDisplayTextKey(player.displayName) === normalizedDisplayName,
  );
  if (existing) {
    throw new PublicError(
      "BAD_REQUEST",
      `${existing.displayName} already exists in this season. Reuse that canonical player instead of creating a duplicate result-only subject.`,
    );
  }
}

export async function createSpotlightResultOnlyPlayer(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const { customPlayerName: rawName } = z
      .object({ customPlayerName: z.string() })
      .strict()
      .parse(input);
    const customPlayerName = customPlayerNameSchema.parse(rawName);
    const normalizedCustomPlayerName =
      normalizedDisplayTextKey(customPlayerName);
    const { season } = await getActiveSeasonContext();
    await assertNoExistingCanonicalPlayer(
      season.id,
      normalizedCustomPlayerName,
    );
    const audit = await getAdminAuditMetadata();
    const created = await createResultOnlyPlayerAtomically(getDb(), {
      customPlayerName,
      normalizedCustomPlayerName,
      requestId: audit.requestId,
      seasonId: season.id,
      slug: resultOnlyPlayerSlug(normalizedCustomPlayerName),
    });
    if (!created.applied || !created.playerId) {
      throw new PublicError(
        "CONFLICT",
        "That Other-player spelling was already matched or is no longer used. Refresh and review it.",
      );
    }
    revalidateResultViews();
    return {
      message: "Inactive result-only player created and matched.",
      ok: true,
      playerId: created.playerId,
    };
  } catch (error) {
    return resultActionFailure(error);
  }
}

export async function createStandaloneSpotlightResultOnlyPlayer(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const { displayName: rawName } = z
      .object({ displayName: z.string() })
      .strict()
      .parse(input);
    const displayName = customPlayerNameSchema.parse(rawName);
    const normalizedDisplayName = normalizedDisplayTextKey(displayName);
    const { season } = await getActiveSeasonContext();
    await assertNoExistingCanonicalPlayer(season.id, normalizedDisplayName);
    const audit = await getAdminAuditMetadata();
    const created = await createStandaloneResultOnlyPlayerAtomically(getDb(), {
      displayName,
      normalizedDisplayName,
      requestId: audit.requestId,
      seasonId: season.id,
      slug: resultOnlyPlayerSlug(normalizedDisplayName),
    });
    if (!created.applied || !created.playerId) {
      throw new PublicError(
        "CONFLICT",
        "The result-only player could not be created. Refresh and try again.",
      );
    }
    revalidateResultViews();
    return {
      message: "Inactive result-only player created for factual result rows.",
      ok: true,
      playerId: created.playerId,
    };
  } catch (error) {
    return resultActionFailure(error);
  }
}

export async function finalizeSpotlightResult(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const parsed = pointerSchema.parse(input);
    const { season } = await getActiveSeasonContext();
    const audit = await getAdminAuditMetadata();
    const applied = await applyResultPointerTransition(
      getDb(),
      buildFinalizeResultQuery({
        ...parsed,
        requestId: audit.requestId,
        seasonId: season.id,
      }),
    );
    if (!applied) {
      throw new PublicError(
        "CONFLICT",
        "The active result changed before finalization. Refresh and try again.",
      );
    }
    revalidateResultViews();
    return { message: "Result marked final.", ok: true };
  } catch (error) {
    return resultActionFailure(error);
  }
}

export async function undoFinalSpotlightResult(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const parsed = pointerSchema.parse(input);
    const { season } = await getActiveSeasonContext();
    const audit = await getAdminAuditMetadata();
    const applied = await applyResultPointerTransition(
      getDb(),
      buildUndoFinalResultQuery({
        ...parsed,
        requestId: audit.requestId,
        seasonId: season.id,
      }),
    );
    if (!applied) {
      throw new PublicError(
        "CONFLICT",
        "Final status changed before undo. Refresh and try again.",
      );
    }
    revalidateResultViews();
    return {
      message: "Final status undone; the result remains active.",
      ok: true,
    };
  } catch (error) {
    return resultActionFailure(error);
  }
}

export async function saveSpotlightResultAlias(
  input: unknown,
): Promise<SpotlightResultActionResult> {
  try {
    await requireAdminMutation();
    const parsed = aliasSchema.parse(input);
    const customPlayerName = customPlayerNameSchema.parse(
      parsed.customPlayerName,
    );
    const normalizedCustomPlayerName =
      normalizedDisplayTextKey(customPlayerName);
    const { season } = await getActiveSeasonContext();
    const [pick] = await getDb()
      .select({ name: predictionCategoryPicks.customPlayerName })
      .from(predictionCategoryPicks)
      .innerJoin(
        predictions,
        eq(predictions.id, predictionCategoryPicks.predictionId),
      )
      .where(
        and(
          eq(predictions.seasonId, season.id),
          eq(
            predictionCategoryPicks.normalizedCustomPlayerName,
            normalizedCustomPlayerName,
          ),
        ),
      )
      .limit(1);
    if (!pick?.name) {
      throw new PublicError(
        "BAD_REQUEST",
        "That Other-player spelling is not used by an active-season entry.",
      );
    }
    const audit = await getAdminAuditMetadata();
    const applied = await applyResultPointerTransition(
      getDb(),
      buildSaveResultAliasQuery({
        customPlayerName: pick.name,
        normalizedCustomPlayerName,
        playerId: parsed.playerId,
        requestId: audit.requestId,
        seasonId: season.id,
      }),
    );
    if (!applied) {
      throw new PublicError(
        "BAD_REQUEST",
        "Choose an active- or inactive-catalogue player from this season.",
      );
    }
    revalidateResultViews();
    return { message: "Other-player spelling matched.", ok: true };
  } catch (error) {
    return resultActionFailure(error);
  }
}
