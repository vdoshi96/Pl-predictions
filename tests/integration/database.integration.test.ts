// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, count, eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { ACTIVE_SEASON } from "@/data";
import { getDb } from "@/db/client";
import {
  players,
  predictionCategoryPicks,
  predictionItems,
  predictions,
  seasons,
  standingsImportRuns,
  standingsSnapshots,
  teams,
} from "@/db/schema";
import {
  buildAtomicPredictionInsertQuery,
  insertPredictionAtomically,
} from "@/features/predictions/atomic-insert";
import { normalizedParticipantNameKey } from "@/features/predictions/normalization";
import { createPrediction } from "@/features/predictions/service";
import type { ValidatedPredictionCategoryPick } from "@/features/predictions/validation";
import { resolveIsolatedTestNow } from "@/features/seasons/clock";
import { PublicError } from "@/shared/errors";
import { STANDINGS_FUTURE_TIMESTAMP_ERROR_CODE } from "@/features/standings/validation";
import { importCanonicalStandings } from "../../scripts/import-standings";

const enabled =
  process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const createdPredictionIds = new Set<string>();
const importSources = new Set<string>();
const originalSeasonSubmissionSettings = new Map<
  string,
  {
    openingKickoff: Date;
    revealPredictions: boolean;
    submissionDeadline: Date | null;
    submissionsLocked: boolean;
  }
>();
const originalSeasonStateBySource = new Map<
  string,
  {
    activeSnapshotId: string | null;
    finalSnapshotId: string | null;
    seasonId: string;
    standingsAcceptedThrough: Date | null;
  }
>();

async function activeFixture() {
  const db = getDb();
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug))
    .limit(1);
  if (!season) throw new Error("Seeded active season is required.");
  const activeTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.seasonId, season.id));
  return { activeTeams, db, season };
}

function categoryPicksFor(
  activeTeams: Awaited<ReturnType<typeof activeFixture>>["activeTeams"],
): ValidatedPredictionCategoryPick[] {
  const [cleanSheetsTeam, underdogTeam, overratedTeam] = activeTeams;
  if (!cleanSheetsTeam || !underdogTeam || !overratedTeam) {
    throw new Error("Three seeded teams are required for spotlight picks.");
  }

  return [
    { category: "top_scorer", customPlayerName: "Fixture Top Scorer" },
    { category: "top_assister", customPlayerName: "Fixture Top Assister" },
    { category: "most_clean_sheets", teamId: cleanSheetsTeam.id },
    { category: "underdog_team", teamId: underdogTeam.id },
    { category: "overrated_team", teamId: overratedTeam.id },
    { category: "underdog_player", customPlayerName: "Fixture Underdog" },
    { category: "overrated_player", customPlayerName: "Fixture Overrated" },
  ];
}

function rememberSeasonSubmissionSettings(
  season: Awaited<ReturnType<typeof activeFixture>>["season"],
) {
  if (!originalSeasonSubmissionSettings.has(season.id)) {
    originalSeasonSubmissionSettings.set(season.id, {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionDeadline: season.submissionDeadline,
      submissionsLocked: season.submissionsLocked,
    });
  }
}

afterEach(async () => {
  if (!enabled) return;
  const db = getDb();
  for (const id of createdPredictionIds) {
    await db.delete(predictions).where(eq(predictions.id, id));
  }
  createdPredictionIds.clear();

  for (const [seasonId, settings] of originalSeasonSubmissionSettings) {
    await db
      .update(seasons)
      .set({
        openingKickoff: settings.openingKickoff,
        revealPredictions: settings.revealPredictions,
        submissionDeadline: settings.submissionDeadline,
        submissionsLocked: settings.submissionsLocked,
      })
      .where(eq(seasons.id, seasonId));

    const [restored] = await db
      .select({
        openingKickoff: seasons.openingKickoff,
        revealPredictions: seasons.revealPredictions,
        submissionDeadline: seasons.submissionDeadline,
        submissionsLocked: seasons.submissionsLocked,
      })
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .limit(1);
    if (
      restored?.openingKickoff.getTime() !==
        settings.openingKickoff.getTime() ||
      restored?.submissionDeadline?.getTime() !==
        settings.submissionDeadline?.getTime() ||
      restored?.submissionsLocked !== settings.submissionsLocked ||
      restored?.revealPredictions !== settings.revealPredictions
    ) {
      throw new Error(
        "Integration cleanup did not restore submission settings.",
      );
    }
  }
  originalSeasonSubmissionSettings.clear();

  for (const source of importSources) {
    const originalSeasonState = originalSeasonStateBySource.get(source);
    if (originalSeasonState) {
      await db
        .update(seasons)
        .set({
          activeSnapshotId: originalSeasonState.activeSnapshotId,
          finalSnapshotId: originalSeasonState.finalSnapshotId,
          standingsAcceptedThrough:
            originalSeasonState.standingsAcceptedThrough,
        })
        .where(eq(seasons.id, originalSeasonState.seasonId));
    }

    await db
      .delete(standingsImportRuns)
      .where(eq(standingsImportRuns.source, source));
    await db
      .delete(standingsSnapshots)
      .where(eq(standingsSnapshots.source, source));

    const [[remainingRuns], [remainingSnapshots], restoredSeasons] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(standingsImportRuns)
          .where(eq(standingsImportRuns.source, source)),
        db
          .select({ value: count() })
          .from(standingsSnapshots)
          .where(eq(standingsSnapshots.source, source)),
        originalSeasonState
          ? db
              .select({
                activeSnapshotId: seasons.activeSnapshotId,
                finalSnapshotId: seasons.finalSnapshotId,
                standingsAcceptedThrough: seasons.standingsAcceptedThrough,
              })
              .from(seasons)
              .where(eq(seasons.id, originalSeasonState.seasonId))
              .limit(1)
          : Promise.resolve([]),
      ]);

    if (remainingRuns?.value !== 0 || remainingSnapshots?.value !== 0) {
      throw new Error(`Integration cleanup left artifacts for ${source}.`);
    }
    if (
      originalSeasonState &&
      (restoredSeasons[0]?.activeSnapshotId !==
        originalSeasonState.activeSnapshotId ||
        restoredSeasons[0]?.finalSnapshotId !==
          originalSeasonState.finalSnapshotId ||
        restoredSeasons[0]?.standingsAcceptedThrough?.getTime() !==
          originalSeasonState.standingsAcceptedThrough?.getTime())
    ) {
      throw new Error(`Integration cleanup did not restore ${source}.`);
    }
  }
  importSources.clear();
  originalSeasonStateBySource.clear();
});

describe.runIf(enabled)("Neon integration", () => {
  it("atomically creates and cascades one prediction with 20 table rows and 7 spotlight picks", async () => {
    const { activeTeams, db } = await activeFixture();
    const suffix = randomUUID().slice(0, 8);
    const created = await createPrediction({
      categoryPicks: categoryPicksFor(activeTeams),
      honeypot: "",
      participantName: `QA ${suffix}`,
      items: activeTeams.map((team, index) => ({
        predictedPosition: index + 1,
        teamId: team.id,
      })),
    });
    createdPredictionIds.add(created.id);

    const [[itemCount], [pickCount]] = await Promise.all([
      db
        .select({ value: count() })
        .from(predictionItems)
        .where(eq(predictionItems.predictionId, created.id)),
      db
        .select({ value: count() })
        .from(predictionCategoryPicks)
        .where(eq(predictionCategoryPicks.predictionId, created.id)),
    ]);
    expect(itemCount?.value).toBe(20);
    expect(pickCount?.value).toBe(7);

    await db
      .delete(predictionCategoryPicks)
      .where(
        and(
          eq(predictionCategoryPicks.predictionId, created.id),
          eq(predictionCategoryPicks.category, "top_scorer"),
        ),
      );
    await expect(
      db.insert(predictionCategoryPicks).values({
        category: "top_scorer",
        predictionId: created.id,
      }),
    ).rejects.toThrow();

    const otherSeasonId = randomUUID();
    const otherPlayerId = randomUUID();
    await db.insert(seasons).values({
      competitionCode: "QA",
      id: otherSeasonId,
      name: "Cross-season QA",
      openingKickoff: new Date("2099-08-01T12:00:00.000Z"),
      slug: `qa-${suffix}`,
      startYear: 2099,
    });
    try {
      await expect(
        db.insert(players).values({
          displayName: "Wrong-season club player",
          seasonId: otherSeasonId,
          slug: "wrong-season-club-player",
          sortName: "Wrong-season club player",
          teamId: activeTeams[0]!.id,
        }),
      ).rejects.toThrow();
      await db.insert(players).values({
        displayName: "Other-season player",
        id: otherPlayerId,
        seasonId: otherSeasonId,
        slug: "other-season-player",
        sortName: "Other-season player",
      });
      await expect(
        db.insert(predictionCategoryPicks).values({
          category: "top_scorer",
          playerId: otherPlayerId,
          predictionId: created.id,
        }),
      ).rejects.toThrow();
    } finally {
      await db.delete(seasons).where(eq(seasons.id, otherSeasonId));
    }

    await db.delete(predictions).where(eq(predictions.id, created.id));
    createdPredictionIds.delete(created.id);

    const [[remainingItems], [remainingPicks]] = await Promise.all([
      db
        .select({ value: count() })
        .from(predictionItems)
        .where(eq(predictionItems.predictionId, created.id)),
      db
        .select({ value: count() })
        .from(predictionCategoryPicks)
        .where(eq(predictionCategoryPicks.predictionId, created.id)),
    ]);
    expect(remainingItems?.value).toBe(0);
    expect(remainingPicks?.value).toBe(0);
  });

  it("enforces case-insensitive participant uniqueness in Postgres", async () => {
    const { activeTeams } = await activeFixture();
    const suffix = randomUUID().slice(0, 8);
    const items = activeTeams.map((team, index) => ({
      predictedPosition: index + 1,
      teamId: team.id,
    }));
    const created = await createPrediction({
      categoryPicks: categoryPicksFor(activeTeams),
      honeypot: "",
      participantName: `Friend ${suffix}`,
      items,
    });
    createdPredictionIds.add(created.id);

    await expect(
      createPrediction({
        categoryPicks: categoryPicksFor(activeTeams),
        honeypot: "",
        participantName: `  FRIEND   ${suffix.toUpperCase()}  `,
        items,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PublicError>>({ code: "CONFLICT" }),
    );
  });

  it("closes at the database deadline boundary without partial rows", async () => {
    const { activeTeams, db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db
      .update(seasons)
      .set({
        submissionDeadline: resolveIsolatedTestNow() ?? new Date(),
        submissionsLocked: false,
      })
      .where(eq(seasons.id, season.id));

    const suffix = randomUUID().slice(0, 8);
    const participantName = `Boundary ${suffix}`;
    const normalizedName = normalizedParticipantNameKey(participantName);
    const items = activeTeams.map((team, index) => ({
      predictedPosition: index + 1,
      teamId: team.id,
    }));

    await expect(
      createPrediction(
        {
          categoryPicks: categoryPicksFor(activeTeams),
          honeypot: "",
          items,
          participantName,
        },
        new Date("2000-01-01T00:00:00.000Z"),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PublicError>>({
        code: "SUBMISSIONS_CLOSED",
        message: "Predictions are closed for this season.",
      }),
    );

    const [persisted] = await db
      .select({ value: count() })
      .from(predictions)
      .where(
        and(
          eq(predictions.seasonId, season.id),
          eq(predictions.normalizedParticipantName, normalizedName),
        ),
      );
    expect(persisted?.value).toBe(0);
  });

  it("serializes a concurrent admin lock before the guarded insert", async () => {
    const { activeTeams, db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db
      .update(seasons)
      .set({ submissionDeadline: null, submissionsLocked: false })
      .where(eq(seasons.id, season.id));

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required.");
    const pool = new Pool({ connectionString: databaseUrl });
    const admin = await pool.connect();
    const predictionId = randomUUID();
    createdPredictionIds.add(predictionId);
    let transactionOpen = false;

    try {
      await admin.query("begin");
      transactionOpen = true;
      await admin.query(
        `update seasons
         set submissions_locked = true, updated_at = now()
         where id = $1`,
        [season.id],
      );

      let insertSettled = false;
      const insertOutcome = insertPredictionAtomically(db, {
        categoryPicks: categoryPicksFor(activeTeams),
        id: predictionId,
        items: activeTeams.map((team, index) => ({
          predictedPosition: index + 1,
          teamId: team.id,
        })),
        normalizedParticipantName: `lock race ${predictionId.slice(0, 8)}`,
        participantName: `Lock Race ${predictionId.slice(0, 8)}`,
        receiptTokenHash: predictionId.replaceAll("-", "").repeat(2),
        seasonId: season.id,
      }).then(
        (value) => {
          insertSettled = true;
          return { status: "fulfilled" as const, value };
        },
        (error: unknown) => {
          insertSettled = true;
          return { error, status: "rejected" as const };
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(insertSettled).toBe(false);

      await admin.query("commit");
      transactionOpen = false;
      const outcome = await insertOutcome;
      expect(outcome).toEqual({ status: "fulfilled", value: false });

      const [[predictionCount], [itemCount], [pickCount]] = await Promise.all([
        db
          .select({ value: count() })
          .from(predictions)
          .where(eq(predictions.id, predictionId)),
        db
          .select({ value: count() })
          .from(predictionItems)
          .where(eq(predictionItems.predictionId, predictionId)),
        db
          .select({ value: count() })
          .from(predictionCategoryPicks)
          .where(eq(predictionCategoryPicks.predictionId, predictionId)),
      ]);
      expect(predictionCount?.value).toBe(0);
      expect(itemCount?.value).toBe(0);
      expect(pickCount?.value).toBe(0);
    } finally {
      if (transactionOpen) await admin.query("rollback");
      admin.release();
      await pool.end();
    }
  }, 15_000);

  it("rechecks wall-clock time after a row lock crosses the deadline", async () => {
    const { activeTeams, db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db.execute(sql`
      update "seasons"
      set
        "opening_kickoff" = clock_timestamp() + interval '10 seconds',
        "submission_deadline" = clock_timestamp() + interval '2 seconds',
        "submissions_locked" = false,
        "reveal_predictions" = false
      where "id" = ${season.id}::uuid
    `);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required.");
    const pool = new Pool({ connectionString: databaseUrl });
    const blocker = await pool.connect();
    const predictionId = randomUUID();
    createdPredictionIds.add(predictionId);
    let transactionOpen = false;

    try {
      await blocker.query("begin");
      transactionOpen = true;
      await blocker.query("select id from seasons where id = $1 for update", [
        season.id,
      ]);

      let insertSettled = false;
      const insertOutcome = db
        .execute(
          buildAtomicPredictionInsertQuery(
            {
              categoryPicks: categoryPicksFor(activeTeams),
              id: predictionId,
              items: activeTeams.map((team, index) => ({
                predictedPosition: index + 1,
                teamId: team.id,
              })),
              normalizedParticipantName: `deadline race ${predictionId.slice(0, 8)}`,
              participantName: `Deadline Race ${predictionId.slice(0, 8)}`,
              receiptTokenHash: predictionId.replaceAll("-", "").repeat(2),
              seasonId: season.id,
            },
            sql<Date>`clock_timestamp()`,
          ),
        )
        .then((result) => {
          insertSettled = true;
          return result;
        });

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(insertSettled).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 2_100));

      await blocker.query("commit");
      transactionOpen = false;
      const result = await insertOutcome;
      expect(result.rows[0]).toMatchObject({
        inserted: false,
        itemCount: 0,
        pickCount: 0,
      });

      const [persisted] = await db
        .select({ value: count() })
        .from(predictions)
        .where(eq(predictions.id, predictionId));
      expect(persisted?.value).toBe(0);
    } finally {
      if (transactionOpen) await blocker.query("rollback");
      blocker.release();
      await pool.end();
    }
  }, 15_000);

  it("rejects an inconsistent unlocked season once predictions are revealed", async () => {
    const { activeTeams, db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db
      .update(seasons)
      .set({
        revealPredictions: true,
        submissionDeadline: null,
        submissionsLocked: false,
      })
      .where(eq(seasons.id, season.id));

    const predictionId = randomUUID();
    createdPredictionIds.add(predictionId);
    await expect(
      insertPredictionAtomically(db, {
        categoryPicks: categoryPicksFor(activeTeams),
        id: predictionId,
        items: activeTeams.map((team, index) => ({
          predictedPosition: index + 1,
          teamId: team.id,
        })),
        normalizedParticipantName: `revealed guard ${predictionId.slice(0, 8)}`,
        participantName: `Revealed Guard ${predictionId.slice(0, 8)}`,
        receiptTokenHash: predictionId.replaceAll("-", "").repeat(2),
        seasonId: season.id,
      }),
    ).resolves.toBe(false);

    const [persisted] = await db
      .select({ value: count() })
      .from(predictions)
      .where(eq(predictions.id, predictionId));
    expect(persisted?.value).toBe(0);
  });

  it("keeps imports provisional and retains the last good snapshot", async () => {
    const { activeTeams, db, season } = await activeFixture();
    const source = `integration-test-${randomUUID()}`;
    importSources.add(source);
    originalSeasonStateBySource.set(source, {
      activeSnapshotId: season.activeSnapshotId,
      finalSnapshotId: season.finalSnapshotId,
      seasonId: season.id,
      standingsAcceptedThrough: season.standingsAcceptedThrough,
    });
    const capturedAt = new Date(Date.now() + 5_000).toISOString();
    const valid = {
      capturedAt,
      // A source completion claim is only a candidate. Only the authenticated
      // administrator finalization action may write final status.
      isFinal: true,
      kind: "snapshot" as const,
      matchweek: 1,
      seasonSlug: season.slug,
      source,
      sourceReference: null,
      sourceUpdatedAt: null,
      standings: activeTeams.map((team, index) => ({
        actualPosition: ((index + 1) % 20) + 1,
        leaguePoints: index,
        playedGames: 1,
        teamSlug: team.slug,
      })),
      version: 1 as const,
    };

    const imported = await importCanonicalStandings(valid);
    expect(imported.status).toBe("succeeded");
    if (!("snapshotId" in imported)) {
      throw new Error("A successful import must identify its snapshot.");
    }
    const [importedSnapshot] = await db
      .select({ isFinal: standingsSnapshots.isFinal })
      .from(standingsSnapshots)
      .where(eq(standingsSnapshots.id, imported.snapshotId));
    const [afterValid] = await db
      .select({
        activeSnapshotId: seasons.activeSnapshotId,
        finalSnapshotId: seasons.finalSnapshotId,
      })
      .from(seasons)
      .where(eq(seasons.id, season.id));
    expect(importedSnapshot?.isFinal).toBe(false);
    expect(afterValid?.finalSnapshotId).toBe(season.finalSnapshotId);

    await expect(
      importCanonicalStandings({
        ...valid,
        capturedAt: new Date(Date.now() + 10_000).toISOString(),
        standings: valid.standings.slice(0, 19),
      }),
    ).rejects.toBeTruthy();
    const [afterInvalid] = await db
      .select({ activeSnapshotId: seasons.activeSnapshotId })
      .from(seasons)
      .where(eq(seasons.id, season.id));
    expect(afterInvalid?.activeSnapshotId).toBe(afterValid?.activeSnapshotId);
  });

  it("advances a monotonic observation watermark and can reactivate historical content", async () => {
    const { activeTeams, db, season } = await activeFixture();
    const source = `watermark-${randomUUID()}`;
    importSources.add(source);
    originalSeasonStateBySource.set(source, {
      activeSnapshotId: season.activeSnapshotId,
      finalSnapshotId: season.finalSnapshotId,
      seasonId: season.id,
      standingsAcceptedThrough: season.standingsAcceptedThrough,
    });

    const firstCaptureMs = Math.max(
      Date.now() + 30_000,
      (season.standingsAcceptedThrough?.getTime() ?? 0) + 1_000,
    );
    expect(firstCaptureMs).toBeLessThan(Date.now() + 4 * 60_000);
    const firstCapture = new Date(firstCaptureMs).toISOString();
    const duplicateCapture = new Date(firstCaptureMs + 10_000).toISOString();
    const secondCapture = new Date(firstCaptureMs + 20_000).toISOString();
    const returnCapture = new Date(firstCaptureMs + 30_000).toISOString();
    const firstTable = {
      capturedAt: firstCapture,
      isFinal: false,
      kind: "snapshot" as const,
      matchweek: 7,
      seasonSlug: season.slug,
      source,
      sourceReference: null,
      sourceUpdatedAt: null,
      standings: activeTeams.map((team, index) => ({
        actualPosition: index + 1,
        leaguePoints: 40 - index,
        playedGames: 7,
        teamSlug: team.slug,
      })),
      version: 1 as const,
    };
    const secondTable = {
      ...firstTable,
      capturedAt: secondCapture,
      matchweek: 8,
      standings: activeTeams.map((team, index) => ({
        actualPosition: activeTeams.length - index,
        leaguePoints: 45 - index,
        playedGames: 8,
        teamSlug: team.slug,
      })),
    };

    const first = await importCanonicalStandings(firstTable);
    expect(first.status).toBe("succeeded");
    if (!("snapshotId" in first)) throw new Error("Missing first snapshot ID.");

    const duplicate = await importCanonicalStandings({
      ...firstTable,
      capturedAt: duplicateCapture,
    });
    expect(duplicate).toMatchObject({
      snapshotId: first.snapshotId,
      status: "duplicate",
    });
    const [afterDuplicate] = await db
      .select({
        activeSnapshotId: seasons.activeSnapshotId,
        standingsAcceptedThrough: seasons.standingsAcceptedThrough,
      })
      .from(seasons)
      .where(eq(seasons.id, season.id));
    expect(afterDuplicate).toEqual({
      activeSnapshotId: first.snapshotId,
      standingsAcceptedThrough: new Date(duplicateCapture),
    });

    const second = await importCanonicalStandings(secondTable);
    expect(second.status).toBe("succeeded");
    if (!("snapshotId" in second))
      throw new Error("Missing second snapshot ID.");

    const returned = await importCanonicalStandings({
      ...firstTable,
      capturedAt: returnCapture,
    });
    expect(returned).toMatchObject({
      snapshotId: first.snapshotId,
      status: "succeeded",
    });
    const [[afterReturn], [firstSnapshot]] = await Promise.all([
      db
        .select({
          activeSnapshotId: seasons.activeSnapshotId,
          standingsAcceptedThrough: seasons.standingsAcceptedThrough,
        })
        .from(seasons)
        .where(eq(seasons.id, season.id)),
      db
        .select({ capturedAt: standingsSnapshots.capturedAt })
        .from(standingsSnapshots)
        .where(eq(standingsSnapshots.id, first.snapshotId)),
    ]);
    expect(afterReturn).toEqual({
      activeSnapshotId: first.snapshotId,
      standingsAcceptedThrough: new Date(returnCapture),
    });
    expect(firstSnapshot?.capturedAt).toEqual(new Date(firstCapture));

    await expect(importCanonicalStandings(secondTable)).rejects.toThrow(
      "rejected as stale",
    );
    const [afterStale] = await db
      .select({
        activeSnapshotId: seasons.activeSnapshotId,
        standingsAcceptedThrough: seasons.standingsAcceptedThrough,
      })
      .from(seasons)
      .where(eq(seasons.id, season.id));
    expect(afterStale).toEqual(afterReturn);
  });

  it.each(["capturedAt", "sourceUpdatedAt"] as const)(
    "rejects a future-dated %s without changing the active snapshot",
    async (field) => {
      const { activeTeams, db, season } = await activeFixture();
      const source = `future-${field === "capturedAt" ? "capture" : "source"}-${randomUUID()}`;
      importSources.add(source);
      originalSeasonStateBySource.set(source, {
        activeSnapshotId: season.activeSnapshotId,
        finalSnapshotId: season.finalSnapshotId,
        seasonId: season.id,
        standingsAcceptedThrough: season.standingsAcceptedThrough,
      });
      const futureYear = "9999-01-01T00:00:00.000Z";
      const payload = {
        capturedAt: new Date().toISOString(),
        isFinal: false,
        kind: "snapshot" as const,
        matchweek: 2,
        seasonSlug: season.slug,
        source,
        sourceReference: null,
        sourceUpdatedAt: null as string | null,
        standings: activeTeams.map((team, index) => ({
          actualPosition: ((index + 2) % 20) + 1,
          leaguePoints: index + 1,
          playedGames: 2,
          teamSlug: team.slug,
        })),
        version: 1 as const,
      };
      payload[field] = futureYear;

      await expect(importCanonicalStandings(payload)).rejects.toThrow(
        "timestamp is implausibly far in the future",
      );

      const [[afterRejected], [rejectedRun], [createdSnapshotCount]] =
        await Promise.all([
          db
            .select({ activeSnapshotId: seasons.activeSnapshotId })
            .from(seasons)
            .where(eq(seasons.id, season.id))
            .limit(1),
          db
            .select({
              errorCode: standingsImportRuns.errorCode,
              status: standingsImportRuns.status,
            })
            .from(standingsImportRuns)
            .where(eq(standingsImportRuns.source, source))
            .limit(1),
          db
            .select({ value: count() })
            .from(standingsSnapshots)
            .where(eq(standingsSnapshots.source, source)),
        ]);

      expect(afterRejected?.activeSnapshotId).toBe(season.activeSnapshotId);
      expect(rejectedRun).toEqual({
        errorCode: STANDINGS_FUTURE_TIMESTAMP_ERROR_CODE,
        status: "rejected",
      });
      expect(createdSnapshotCount?.value).toBe(0);
    },
  );
});
