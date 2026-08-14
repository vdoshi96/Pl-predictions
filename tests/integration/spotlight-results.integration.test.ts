// @vitest-environment node

import { randomUUID } from "node:crypto";

import { and, count, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { getDb } from "@/db/client";
import {
  adminAuditLogs,
  players,
  predictions,
  predictionCategoryPicks,
  seasons,
  spotlightResultAliases,
  spotlightResultItems,
  spotlightResultSnapshotAliases,
  spotlightResultSnapshots,
  spotlightResultStates,
} from "@/db/schema";
import {
  applyResultPointerTransition,
  buildFinalizeResultQuery,
  buildPublishResultQuery,
  buildSaveResultAliasQuery,
  buildUndoFinalResultQuery,
  createResultOnlyPlayerAtomically,
  createStandaloneResultOnlyPlayerAtomically,
  saveResultDraftAtomically,
} from "@/features/results";
import { getManualResultAssignments } from "@/features/results/queries";

import { assertIsolatedDatabaseEnvironment } from "../test-environment-safety";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
if (enabled) {
  assertIsolatedDatabaseEnvironment(process.env, "Neon integration tests");
}

const cleanupSeasonIds = new Set<string>();
const cleanupRequestIds = new Set<string>();

afterEach(async () => {
  if (!enabled) return;
  const db = getDb();
  for (const requestId of cleanupRequestIds) {
    await db
      .delete(adminAuditLogs)
      .where(eq(adminAuditLogs.requestId, requestId));
  }
  cleanupRequestIds.clear();
  for (const seasonId of cleanupSeasonIds) {
    await db.delete(seasons).where(eq(seasons.id, seasonId));
  }
  cleanupSeasonIds.clear();
});

describe.runIf(enabled)("spotlight result transitions", () => {
  it("saves immutable rows and atomically publishes, finalizes, and undoes exact pointers", async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const seasonId = randomUUID();
    const playerId = randomUUID();
    const predictionId = randomUUID();
    const requestId = `results-integration-${suffix}`;
    cleanupSeasonIds.add(seasonId);
    cleanupRequestIds.add(requestId);

    await db.insert(seasons).values({
      competitionCode: "QA",
      id: seasonId,
      name: "Spotlight results QA",
      openingKickoff: new Date("2099-08-01T12:00:00.000Z"),
      revealPredictions: true,
      slug: `results-qa-${suffix}`,
      startYear: 2099,
      submissionsLocked: true,
    });
    await db.insert(players).values({
      displayName: "Result-only player",
      id: playerId,
      isActive: false,
      seasonId,
      slug: `result-only-${suffix}`,
      sortName: `Result only ${suffix}`,
    });
    await db.insert(predictions).values({
      id: predictionId,
      normalizedParticipantName: `qa ${suffix}`,
      participantName: `QA ${suffix}`,
      seasonId,
    });
    await db.insert(predictionCategoryPicks).values({
      category: "top_assister",
      playerId,
      predictionId,
    });
    await db.insert(predictionCategoryPicks).values({
      category: "top_scorer",
      customPlayerName: "QA Newcomer",
      normalizedCustomPlayerName: "qa newcomer",
      predictionId,
    });
    await db.insert(spotlightResultStates).values({
      dataset: "goals",
      seasonId,
    });

    const resultOnly = await createResultOnlyPlayerAtomically(db, {
      customPlayerName: "QA Newcomer",
      normalizedCustomPlayerName: "qa newcomer",
      requestId,
      seasonId,
      slug: `result-only-qa-newcomer-${suffix}`,
    });
    expect(resultOnly).toMatchObject({ applied: true });
    if (!resultOnly.playerId) {
      throw new Error("An inactive result-only player is required.");
    }
    const [[createdResultOnly], [createdAlias]] = await Promise.all([
      db
        .select({ isActive: players.isActive })
        .from(players)
        .where(eq(players.id, resultOnly.playerId))
        .limit(1),
      db
        .select({ playerId: spotlightResultAliases.playerId })
        .from(spotlightResultAliases)
        .where(
          and(
            eq(spotlightResultAliases.seasonId, seasonId),
            eq(
              spotlightResultAliases.normalizedCustomPlayerName,
              "qa newcomer",
            ),
          ),
        )
        .limit(1),
    ]);
    expect(createdResultOnly?.isActive).toBe(false);
    expect(createdAlias?.playerId).toBe(resultOnly.playerId);

    const standaloneResultOnly =
      await createStandaloneResultOnlyPlayerAtomically(db, {
        displayName: "Unpredicted factual subject",
        normalizedDisplayName: "unpredicted factual subject",
        requestId,
        seasonId,
        slug: `result-only-unpredicted-${suffix}`,
      });
    expect(standaloneResultOnly.applied).toBe(true);
    if (!standaloneResultOnly.playerId) {
      throw new Error("A standalone result-only player is required.");
    }
    const [standalonePlayer] = await db
      .select({ isActive: players.isActive })
      .from(players)
      .where(eq(players.id, standaloneResultOnly.playerId))
      .limit(1);
    expect(standalonePlayer?.isActive).toBe(false);

    const saved = await saveResultDraftAtomically(db, {
      capturedAt: new Date("2099-07-31T12:00:00.000Z"),
      contentHash: "a".repeat(64),
      coveredThroughRank: 1,
      dataset: "goals",
      expectedWorkingSnapshotId: null,
      requestId,
      rows: [
        {
          metricValue: 24,
          outcomeRank: 1,
          subjectId: resultOnly.playerId,
        },
      ],
      seasonId,
      source: "Integration owner review",
      sourceReference: "fixture",
      subject: "player",
    });
    expect(saved).toMatchObject({ applied: true });
    expect(saved.pinnedAliases).toEqual([
      {
        normalizedCustomPlayerName: "qa newcomer",
        playerId: resultOnly.playerId,
      },
    ]);
    expect(saved.snapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    if (!saved.snapshotId) throw new Error("A saved snapshot is required.");

    const staleSave = await saveResultDraftAtomically(db, {
      capturedAt: new Date("2099-07-31T13:00:00.000Z"),
      contentHash: "b".repeat(64),
      coveredThroughRank: 1,
      dataset: "goals",
      expectedWorkingSnapshotId: null,
      requestId,
      rows: [
        {
          metricValue: 25,
          outcomeRank: 1,
          subjectId: resultOnly.playerId,
        },
      ],
      seasonId,
      source: "Stale writer",
      sourceReference: null,
      subject: "player",
    });
    expect(staleSave).toEqual({
      applied: false,
      pinnedAliases: [],
      snapshotId: null,
    });

    const identicalSave = await saveResultDraftAtomically(db, {
      capturedAt: new Date("2099-07-31T12:00:00.000Z"),
      contentHash: "a".repeat(64),
      coveredThroughRank: 1,
      dataset: "goals",
      expectedWorkingSnapshotId: saved.snapshotId,
      requestId,
      rows: [
        {
          metricValue: 24,
          outcomeRank: 1,
          subjectId: resultOnly.playerId,
        },
      ],
      seasonId,
      source: "Integration owner review",
      sourceReference: "fixture",
      subject: "player",
    });
    expect(identicalSave.applied).toBe(true);
    expect(identicalSave.snapshotId).not.toBe(saved.snapshotId);
    if (!identicalSave.snapshotId) {
      throw new Error("A second immutable snapshot version is required.");
    }
    const latestSnapshotId = identicalSave.snapshotId;

    const [[snapshotCount], [itemCount], pinnedAliases, [sealedSnapshot]] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(spotlightResultSnapshots)
          .where(eq(spotlightResultSnapshots.seasonId, seasonId)),
        db
          .select({ value: count() })
          .from(spotlightResultItems)
          .where(eq(spotlightResultItems.snapshotId, latestSnapshotId)),
        db
          .select({
            normalizedCustomPlayerName:
              spotlightResultSnapshotAliases.normalizedCustomPlayerName,
            playerId: spotlightResultSnapshotAliases.playerId,
            snapshotId: spotlightResultSnapshotAliases.snapshotId,
          })
          .from(spotlightResultSnapshotAliases)
          .where(
            eq(spotlightResultSnapshotAliases.snapshotId, latestSnapshotId),
          ),
        db
          .select({ sealedAt: spotlightResultSnapshots.sealedAt })
          .from(spotlightResultSnapshots)
          .where(eq(spotlightResultSnapshots.id, latestSnapshotId))
          .limit(1),
      ]);
    expect(snapshotCount?.value).toBe(2);
    expect(itemCount?.value).toBe(1);
    expect(pinnedAliases).toEqual([
      {
        normalizedCustomPlayerName: "qa newcomer",
        playerId: resultOnly.playerId,
        snapshotId: latestSnapshotId,
      },
    ]);
    expect(sealedSnapshot?.sealedAt).toBeInstanceOf(Date);
    await expect(
      db.insert(spotlightResultItems).values({
        metricValue: 1,
        outcomeRank: 2,
        playerId: standaloneResultOnly.playerId,
        snapshotId: latestSnapshotId,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(spotlightResultSnapshotAliases).values({
        customPlayerName: "Late alias",
        normalizedCustomPlayerName: "late alias",
        playerId,
        snapshotId: latestSnapshotId,
      }),
    ).rejects.toThrow();
    await expect(
      db
        .delete(spotlightResultSnapshots)
        .where(eq(spotlightResultSnapshots.id, saved.snapshotId)),
    ).rejects.toThrow();

    const basePointers = {
      activeSnapshotId: null,
      dataset: "goals" as const,
      finalSnapshotId: null,
      requestId,
      seasonId,
      workingSnapshotId: latestSnapshotId,
    };
    await expect(
      applyResultPointerTransition(
        db,
        buildPublishResultQuery({
          ...basePointers,
          coverageAttested: true,
          expectedBracketCount: 2,
        }),
      ),
    ).resolves.toBe(false);
    await expect(
      applyResultPointerTransition(
        db,
        buildPublishResultQuery({
          ...basePointers,
          coverageAttested: true,
          expectedBracketCount: 1,
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      applyResultPointerTransition(
        db,
        buildPublishResultQuery({
          ...basePointers,
          activeSnapshotId: latestSnapshotId,
          coverageAttested: true,
          expectedBracketCount: 1,
        }),
      ),
    ).resolves.toBe(false);
    const [publishAuditCount] = await db
      .select({ value: count() })
      .from(adminAuditLogs)
      .where(
        and(
          eq(adminAuditLogs.requestId, requestId),
          eq(adminAuditLogs.action, "spotlight_results.published"),
        ),
      );
    expect(publishAuditCount?.value).toBe(1);

    await expect(
      applyResultPointerTransition(
        db,
        buildSaveResultAliasQuery({
          customPlayerName: "QA Newcomer",
          normalizedCustomPlayerName: "qa newcomer",
          playerId,
          requestId,
          seasonId,
        }),
      ),
    ).resolves.toBe(true);
    const [[remappedLiveAlias], [stillPinnedAlias]] = await Promise.all([
      db
        .select({ playerId: spotlightResultAliases.playerId })
        .from(spotlightResultAliases)
        .where(
          and(
            eq(spotlightResultAliases.seasonId, seasonId),
            eq(
              spotlightResultAliases.normalizedCustomPlayerName,
              "qa newcomer",
            ),
          ),
        )
        .limit(1),
      db
        .select({ playerId: spotlightResultSnapshotAliases.playerId })
        .from(spotlightResultSnapshotAliases)
        .where(
          and(
            eq(spotlightResultSnapshotAliases.snapshotId, latestSnapshotId),
            eq(
              spotlightResultSnapshotAliases.normalizedCustomPlayerName,
              "qa newcomer",
            ),
          ),
        )
        .limit(1),
    ]);
    expect(remappedLiveAlias?.playerId).toBe(playerId);
    expect(stillPinnedAlias?.playerId).toBe(resultOnly.playerId);
    const pinnedAssignments = await getManualResultAssignments(
      seasonId,
      [predictionId],
      1,
    );
    expect(
      pinnedAssignments.get(predictionId)?.get("top_scorer"),
    ).toMatchObject({ accuracyPoints: 1, resultRank: 1 });
    await expect(
      applyResultPointerTransition(
        db,
        buildFinalizeResultQuery({
          ...basePointers,
          activeSnapshotId: latestSnapshotId,
        }),
      ),
    ).resolves.toBe(true);

    const [finalState] = await db
      .select()
      .from(spotlightResultStates)
      .where(
        and(
          eq(spotlightResultStates.seasonId, seasonId),
          eq(spotlightResultStates.dataset, "goals"),
        ),
      )
      .limit(1);
    expect(finalState).toMatchObject({
      activeSnapshotId: latestSnapshotId,
      finalSnapshotId: latestSnapshotId,
      workingSnapshotId: latestSnapshotId,
    });

    await expect(
      applyResultPointerTransition(
        db,
        buildUndoFinalResultQuery({
          ...basePointers,
          activeSnapshotId: latestSnapshotId,
          finalSnapshotId: latestSnapshotId,
        }),
      ),
    ).resolves.toBe(true);
    const [snapshotVersions, auditRows] = await Promise.all([
      db
        .select({
          contentHash: spotlightResultSnapshots.contentHash,
          id: spotlightResultSnapshots.id,
          sealedAt: spotlightResultSnapshots.sealedAt,
        })
        .from(spotlightResultSnapshots)
        .where(eq(spotlightResultSnapshots.seasonId, seasonId)),
      db
        .select({ action: adminAuditLogs.action })
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.requestId, requestId)),
    ]);
    expect(snapshotVersions).toHaveLength(2);
    expect(
      snapshotVersions.every(
        (snapshot) =>
          snapshot.sealedAt instanceof Date &&
          /^[0-9a-f]{64}$/u.test(snapshot.contentHash),
      ),
    ).toBe(true);
    expect(
      new Set(snapshotVersions.map((snapshot) => snapshot.contentHash)).size,
    ).toBe(1);
    await expect(
      db
        .update(spotlightResultSnapshots)
        .set({ source: "Forbidden rewrite" })
        .where(eq(spotlightResultSnapshots.id, latestSnapshotId)),
    ).rejects.toThrow();
    await expect(
      db
        .update(spotlightResultSnapshotAliases)
        .set({ playerId })
        .where(eq(spotlightResultSnapshotAliases.snapshotId, latestSnapshotId)),
    ).rejects.toThrow();
    await expect(
      db
        .update(spotlightResultItems)
        .set({ metricValue: 99 })
        .where(eq(spotlightResultItems.snapshotId, latestSnapshotId)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(spotlightResultItems)
        .where(eq(spotlightResultItems.snapshotId, latestSnapshotId)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(spotlightResultSnapshotAliases)
        .where(eq(spotlightResultSnapshotAliases.snapshotId, latestSnapshotId)),
    ).rejects.toThrow();
    expect(auditRows.map((row) => row.action).sort()).toEqual([
      "spotlight_results.alias_saved",
      "spotlight_results.draft_saved",
      "spotlight_results.draft_saved",
      "spotlight_results.finalization_undone",
      "spotlight_results.finalized",
      "spotlight_results.published",
      "spotlight_results.result_only_player_created",
      "spotlight_results.result_only_player_created",
    ]);
  });

  it("lets exactly one concurrent draft CAS win without leaving an open candidate", async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const seasonId = randomUUID();
    const playerId = randomUUID();
    const requestIds = [`results-race-a-${suffix}`, `results-race-b-${suffix}`];
    cleanupSeasonIds.add(seasonId);
    requestIds.forEach((requestId) => cleanupRequestIds.add(requestId));

    await db.insert(seasons).values({
      competitionCode: "QA",
      id: seasonId,
      name: "Spotlight result CAS QA",
      openingKickoff: new Date("2099-08-01T12:00:00.000Z"),
      slug: `results-race-${suffix}`,
      startYear: 2099,
    });
    await db.insert(players).values({
      displayName: "Race player",
      id: playerId,
      seasonId,
      slug: `race-player-${suffix}`,
      sortName: `Race player ${suffix}`,
    });
    await db.insert(spotlightResultStates).values({
      dataset: "goals",
      seasonId,
    });

    const saves = await Promise.all(
      requestIds.map((requestId, index) =>
        saveResultDraftAtomically(db, {
          capturedAt: new Date(`2099-07-31T1${index}:00:00.000Z`),
          contentHash: String(index + 1).repeat(64),
          coveredThroughRank: 1,
          dataset: "goals",
          expectedWorkingSnapshotId: null,
          requestId,
          rows: [
            { metricValue: 20 + index, outcomeRank: 1, subjectId: playerId },
          ],
          seasonId,
          source: `Concurrent writer ${index + 1}`,
          sourceReference: null,
          subject: "player",
        }),
      ),
    );
    expect(saves.map((save) => save.applied).sort()).toEqual([false, true]);
    const winner = saves.find((save) => save.applied);
    const [[snapshotCount], [auditCount], [state], snapshots] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(spotlightResultSnapshots)
          .where(eq(spotlightResultSnapshots.seasonId, seasonId)),
        db
          .select({ value: count() })
          .from(adminAuditLogs)
          .where(
            and(
              eq(adminAuditLogs.seasonId, seasonId),
              eq(adminAuditLogs.action, "spotlight_results.draft_saved"),
            ),
          ),
        db
          .select({
            workingSnapshotId: spotlightResultStates.workingSnapshotId,
          })
          .from(spotlightResultStates)
          .where(
            and(
              eq(spotlightResultStates.seasonId, seasonId),
              eq(spotlightResultStates.dataset, "goals"),
            ),
          )
          .limit(1),
        db
          .select({
            id: spotlightResultSnapshots.id,
            sealedAt: spotlightResultSnapshots.sealedAt,
          })
          .from(spotlightResultSnapshots)
          .where(eq(spotlightResultSnapshots.seasonId, seasonId)),
      ]);
    expect(snapshotCount?.value).toBe(1);
    expect(auditCount?.value).toBe(1);
    expect(state?.workingSnapshotId).toBe(winner?.snapshotId);
    expect(snapshots).toEqual([
      { id: winner?.snapshotId, sealedAt: expect.any(Date) },
    ]);
  });

  it("scores cutoff ties and both rating directions from sealed factual snapshots", async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const seasonId = randomUUID();
    const requestId = `results-scoring-${suffix}`;
    const playerIds = Array.from({ length: 6 }, () => randomUUID());
    const predictionIds = Array.from({ length: 4 }, () => randomUUID());
    cleanupSeasonIds.add(seasonId);
    cleanupRequestIds.add(requestId);

    await db.insert(seasons).values({
      competitionCode: "QA",
      id: seasonId,
      name: "Spotlight scoring QA",
      openingKickoff: new Date("2099-08-01T12:00:00.000Z"),
      revealPredictions: true,
      slug: `results-scoring-${suffix}`,
      startYear: 2099,
      submissionsLocked: true,
    });
    await db.insert(players).values(
      playerIds.map((id, index) => ({
        displayName: `Scoring player ${index + 1}`,
        id,
        seasonId,
        slug: `scoring-player-${index + 1}-${suffix}`,
        sortName: `Scoring player ${index + 1} ${suffix}`,
      })),
    );
    await db.insert(predictions).values(
      predictionIds.map((id, index) => ({
        id,
        normalizedParticipantName: `scoring ${index + 1} ${suffix}`,
        participantName: `Scoring ${index + 1} ${suffix}`,
        seasonId,
      })),
    );
    await db.insert(predictionCategoryPicks).values([
      {
        category: "top_scorer",
        playerId: playerIds[0],
        predictionId: predictionIds[0],
      },
      {
        category: "underdog_player",
        playerId: playerIds[0],
        predictionId: predictionIds[0],
      },
      {
        category: "top_assister",
        playerId: playerIds[0],
        predictionId: predictionIds[0],
      },
      {
        category: "overrated_player",
        playerId: playerIds[4],
        predictionId: predictionIds[0],
      },
      {
        category: "top_scorer",
        playerId: playerIds[1],
        predictionId: predictionIds[1],
      },
      {
        category: "top_scorer",
        playerId: playerIds[2],
        predictionId: predictionIds[2],
      },
      {
        category: "top_scorer",
        playerId: playerIds[4],
        predictionId: predictionIds[3],
      },
      {
        category: "underdog_player",
        playerId: playerIds[3],
        predictionId: predictionIds[3],
      },
      {
        category: "overrated_player",
        playerId: playerIds[0],
        predictionId: predictionIds[3],
      },
    ]);
    await db.insert(spotlightResultStates).values([
      { dataset: "assists", seasonId },
      { dataset: "goals", seasonId },
      { dataset: "player_ratings", seasonId },
    ]);

    const goals = await saveResultDraftAtomically(db, {
      capturedAt: new Date("2099-07-31T12:00:00.000Z"),
      contentHash: "e".repeat(64),
      coveredThroughRank: 4,
      dataset: "goals",
      expectedWorkingSnapshotId: null,
      requestId,
      rows: [
        { metricValue: 20, outcomeRank: 1, subjectId: playerIds[0] },
        { metricValue: 20, outcomeRank: 1, subjectId: playerIds[1] },
        { metricValue: 15, outcomeRank: 3, subjectId: playerIds[2] },
        { metricValue: 10, outcomeRank: 4, subjectId: playerIds[3] },
        { metricValue: 10, outcomeRank: 4, subjectId: playerIds[5] },
      ],
      seasonId,
      source: "Scoring fixture goals",
      sourceReference: null,
      subject: "player",
    });
    const ratings = await saveResultDraftAtomically(db, {
      capturedAt: new Date("2099-07-31T12:00:00.000Z"),
      contentHash: "f".repeat(64),
      coveredThroughRank: 4,
      dataset: "player_ratings",
      expectedWorkingSnapshotId: null,
      requestId,
      rows: [
        { metricValue: 9.123, outcomeRank: 1, subjectId: playerIds[0] },
        { metricValue: 8.5, outcomeRank: 2, subjectId: playerIds[1] },
        { metricValue: 7.333, outcomeRank: 3, subjectId: playerIds[2] },
        { metricValue: 5.5, outcomeRank: 4, subjectId: playerIds[3] },
        { metricValue: 3, outcomeRank: 5, subjectId: playerIds[5] },
        { metricValue: 1.001, outcomeRank: 6, subjectId: playerIds[4] },
      ],
      seasonId,
      source: "Scoring fixture ratings",
      sourceReference: null,
      subject: "player",
    });
    expect(goals.applied).toBe(true);
    expect(ratings.applied).toBe(true);
    if (!goals.snapshotId || !ratings.snapshotId) {
      throw new Error("Both scoring snapshots are required.");
    }

    for (const [dataset, snapshotId] of [
      ["goals", goals.snapshotId],
      ["player_ratings", ratings.snapshotId],
    ] as const) {
      await expect(
        applyResultPointerTransition(
          db,
          buildPublishResultQuery({
            activeSnapshotId: null,
            coverageAttested: true,
            dataset,
            expectedBracketCount: 4,
            finalSnapshotId: null,
            requestId,
            seasonId,
            workingSnapshotId: snapshotId,
          }),
        ),
      ).resolves.toBe(true);
    }

    const [goalCutoffRows, assignments] = await Promise.all([
      db
        .select({
          outcomeRank: spotlightResultItems.outcomeRank,
          playerId: spotlightResultItems.playerId,
        })
        .from(spotlightResultItems)
        .where(eq(spotlightResultItems.snapshotId, goals.snapshotId)),
      getManualResultAssignments(seasonId, predictionIds, 4),
    ]);
    expect(goalCutoffRows.filter((row) => row.outcomeRank === 4)).toHaveLength(
      2,
    );
    expect(assignments.get(predictionIds[0])?.get("top_scorer")).toMatchObject({
      accuracyPoints: 4,
      resultRank: 1,
    });
    expect(assignments.get(predictionIds[1])?.get("top_scorer")).toMatchObject({
      accuracyPoints: 4,
      resultRank: 1,
    });
    expect(assignments.get(predictionIds[2])?.get("top_scorer")).toMatchObject({
      accuracyPoints: 2,
      resultRank: 3,
    });
    expect(assignments.get(predictionIds[3])?.get("top_scorer")).toMatchObject({
      accuracyPoints: 0,
      metricLabel: "Outside top 4",
      resultRank: 5,
    });
    expect(
      assignments.get(predictionIds[0])?.get("underdog_player"),
    ).toMatchObject({
      accuracyPoints: 4,
      metricLabel: "Rating 9.123",
      resultRank: 1,
    });
    expect(
      assignments.get(predictionIds[0])?.get("overrated_player"),
    ).toMatchObject({
      accuracyPoints: 4,
      metricLabel: "Rating 1.001",
      resultRank: 1,
    });
    expect(
      assignments.get(predictionIds[0])?.get("top_assister"),
    ).toBeUndefined();
    expect(
      assignments.get(predictionIds[3])?.get("overrated_player"),
    ).toMatchObject({
      accuracyPoints: 0,
      metricLabel: "Outside lowest 4",
      resultRank: 5,
    });

    await db.delete(predictions).where(eq(predictions.id, predictionIds[1]));
    const afterDeletion = await getManualResultAssignments(
      seasonId,
      [predictionIds[0], predictionIds[2], predictionIds[3]],
      3,
    );
    expect(
      afterDeletion.get(predictionIds[0])?.get("top_scorer"),
    ).toMatchObject({ accuracyPoints: 3, resultRank: 1 });
  });

  it("rolls back wrong-season, malformed, and duplicate-canonical result facts", async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const seasonId = randomUUID();
    const otherSeasonId = randomUUID();
    const playerId = randomUUID();
    const otherPlayerId = randomUUID();
    const predictionId = randomUUID();
    const requestId = `results-constraints-${suffix}`;
    cleanupSeasonIds.add(seasonId);
    cleanupSeasonIds.add(otherSeasonId);
    cleanupRequestIds.add(requestId);

    await db.insert(seasons).values([
      {
        competitionCode: "QA",
        id: seasonId,
        name: "Spotlight constraints QA",
        openingKickoff: new Date("2099-08-01T12:00:00.000Z"),
        slug: `results-constraints-${suffix}`,
        startYear: 2099,
      },
      {
        competitionCode: "QB",
        id: otherSeasonId,
        name: "Other spotlight constraints QA",
        openingKickoff: new Date("2100-08-01T12:00:00.000Z"),
        slug: `results-c-other-${suffix}`,
        startYear: 2100,
      },
    ]);
    await db.insert(players).values([
      {
        displayName: "Canonical Existing",
        id: playerId,
        seasonId,
        slug: `canonical-existing-${suffix}`,
        sortName: `Canonical Existing ${suffix}`,
      },
      {
        displayName: "Other season player",
        id: otherPlayerId,
        seasonId: otherSeasonId,
        slug: `other-season-player-${suffix}`,
        sortName: `Other Season ${suffix}`,
      },
    ]);
    await db.insert(predictions).values({
      id: predictionId,
      normalizedParticipantName: `constraints ${suffix}`,
      participantName: `Constraints ${suffix}`,
      seasonId,
    });
    await db.insert(predictionCategoryPicks).values({
      category: "top_scorer",
      customPlayerName: "Canonical Existing",
      normalizedCustomPlayerName: "canonical existing",
      predictionId,
    });
    await db.insert(spotlightResultStates).values([
      { dataset: "goals", seasonId },
      { dataset: "player_ratings", seasonId },
    ]);

    await expect(
      saveResultDraftAtomically(db, {
        capturedAt: new Date("2099-07-31T10:00:00.000Z"),
        contentHash: "c".repeat(64),
        coveredThroughRank: 1,
        dataset: "goals",
        expectedWorkingSnapshotId: null,
        requestId,
        rows: [{ metricValue: 10, outcomeRank: 1, subjectId: otherPlayerId }],
        seasonId,
        source: "Wrong season",
        sourceReference: null,
        subject: "player",
      }),
    ).rejects.toThrow();
    await expect(
      saveResultDraftAtomically(db, {
        capturedAt: new Date("2099-07-31T11:00:00.000Z"),
        contentHash: "d".repeat(64),
        coveredThroughRank: 1,
        dataset: "player_ratings",
        expectedWorkingSnapshotId: null,
        requestId,
        rows: [{ metricValue: 10.001, outcomeRank: 1, subjectId: playerId }],
        seasonId,
        source: "Malformed rating",
        sourceReference: null,
        subject: "player",
      }),
    ).rejects.toThrow();
    await expect(
      createStandaloneResultOnlyPlayerAtomically(db, {
        displayName: "Canonical Existing",
        normalizedDisplayName: "canonical existing",
        requestId,
        seasonId,
        slug: `duplicate-canonical-${suffix}`,
      }),
    ).resolves.toMatchObject({ applied: false, playerId: null });
    await expect(
      createResultOnlyPlayerAtomically(db, {
        customPlayerName: "Canonical Existing",
        normalizedCustomPlayerName: "canonical existing",
        requestId,
        seasonId,
        slug: `duplicate-alias-canonical-${suffix}`,
      }),
    ).resolves.toMatchObject({ applied: false, playerId: null });

    const concurrentCreators = await Promise.all([
      createStandaloneResultOnlyPlayerAtomically(db, {
        displayName: "Concurrent Newcomer",
        normalizedDisplayName: "concurrent newcomer",
        requestId,
        seasonId,
        slug: `concurrent-newcomer-a-${suffix}`,
      }),
      createStandaloneResultOnlyPlayerAtomically(db, {
        displayName: "Concurrent Newcomer",
        normalizedDisplayName: "concurrent newcomer",
        requestId,
        seasonId,
        slug: `concurrent-newcomer-b-${suffix}`,
      }),
    ]);
    expect(concurrentCreators.map((creator) => creator.applied).sort()).toEqual(
      [false, true],
    );

    const [
      [snapshotCount],
      states,
      [seasonPlayerCount],
      [concurrentPlayerCount],
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(spotlightResultSnapshots)
        .where(eq(spotlightResultSnapshots.seasonId, seasonId)),
      db
        .select({
          activeSnapshotId: spotlightResultStates.activeSnapshotId,
          workingSnapshotId: spotlightResultStates.workingSnapshotId,
        })
        .from(spotlightResultStates)
        .where(eq(spotlightResultStates.seasonId, seasonId)),
      db
        .select({ value: count() })
        .from(players)
        .where(eq(players.seasonId, seasonId)),
      db
        .select({ value: count() })
        .from(players)
        .where(
          and(
            eq(players.seasonId, seasonId),
            eq(players.displayName, "Concurrent Newcomer"),
          ),
        ),
    ]);
    expect(snapshotCount?.value).toBe(0);
    expect(states).toHaveLength(2);
    expect(states).toEqual(
      expect.arrayContaining([
        { activeSnapshotId: null, workingSnapshotId: null },
        { activeSnapshotId: null, workingSnapshotId: null },
      ]),
    );
    expect(seasonPlayerCount?.value).toBe(2);
    expect(concurrentPlayerCount?.value).toBe(1);
  });
});
