// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  ACTIVE_SEASON,
  PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
  PREMIER_LEAGUE_2026_27_PLAYERS,
} from "@/data";
import { getDb } from "@/db/client";
import {
  adminAuditLogs,
  adminSessions,
  players,
  predictionCategoryPicks,
  predictionItems,
  predictions,
  seasons,
  standingsImportRuns,
  standingsItems,
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
import { closeSeasonPermanentlyAtomically } from "@/features/seasons/closure";
import {
  getActiveSeasonContext,
  getActiveSeasonPlayers,
} from "@/features/seasons/queries";
import { PublicError } from "@/shared/errors";
import {
  clearSecurityRateLimit,
  reserveSecurityAttempt,
} from "@/features/security/rate-limit";
import {
  isAdminSessionActive,
  registerAdminSession,
  revokeAdminSession,
} from "@/features/admin/session-store";
import { STANDINGS_FUTURE_TIMESTAMP_ERROR_CODE } from "@/features/standings/validation";
import { importCanonicalStandings } from "../../scripts/import-standings";
import { seedDatabase } from "../../scripts/seed";
import { getSpotlightPicksByPredictionId } from "@/features/leaderboard/pick-queries";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { getSeasonTableView } from "@/features/standings/season-table";
import { assertIsolatedDatabaseEnvironment } from "../test-environment-safety";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
if (enabled) {
  assertIsolatedDatabaseEnvironment(process.env, "Neon integration tests");
}
const createdPredictionIds = new Set<string>();
const closureAuditRequestIds = new Set<string>();
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

  if (closureAuditRequestIds.size > 0) {
    await db
      .delete(adminAuditLogs)
      .where(inArray(adminAuditLogs.requestId, [...closureAuditRequestIds]));
    closureAuditRequestIds.clear();
  }

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
  it("persists rate limits and supports server-side session revocation", async () => {
    const requestHeaders = new Headers({
      "x-vercel-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    });
    let keyHash = "";
    try {
      for (let attemptNumber = 1; attemptNumber <= 5; attemptNumber += 1) {
        const attempt = await reserveSecurityAttempt({
          blockSeconds: 900,
          limit: 5,
          requestHeaders,
          scope: "admin_login",
          windowSeconds: 900,
        });
        keyHash = attempt.keyHash;
        expect(attempt.allowed).toBe(true);
      }
      await expect(
        reserveSecurityAttempt({
          blockSeconds: 900,
          limit: 5,
          requestHeaders,
          scope: "admin_login",
          windowSeconds: 900,
        }),
      ).resolves.toMatchObject({ allowed: false });
    } finally {
      if (keyHash) await clearSecurityRateLimit("admin_login", keyHash);
    }

    const sessionId = randomUUID().replaceAll("-", "").repeat(2);
    await registerAdminSession(sessionId, new Date(Date.now() + 60_000));
    expect(await isAdminSessionActive(sessionId)).toBe(true);
    await revokeAdminSession(sessionId);
    expect(await isAdminSessionActive(sessionId)).toBe(false);
    const [remaining] = await getDb()
      .select({ value: count() })
      .from(adminSessions)
      .where(eq(adminSessions.id, sessionId));
    expect(remaining?.value).toBe(0);
  });

  it("guards season consensus before reveal and derives movement from the previous snapshot", async () => {
    const { activeTeams, db, season } = await activeFixture();
    const suffix = randomUUID().slice(0, 8);
    const source = `season-glance-${suffix}`;
    const predictionIds = [randomUUID(), randomUUID()];
    const predictionIdSet = new Set<string>(predictionIds);
    const now = (resolveIsolatedTestNow() ?? new Date()).getTime();
    const firstCapturedAt = new Date(now - 120_000);
    const secondCapturedAt = new Date(now - 60_000);
    const privateOpeningKickoff = new Date(now + 86_400_000);
    const scoredOpeningKickoff = new Date(now - 86_400_000);
    const [baselinePredictionCount] = await db
      .select({ value: count() })
      .from(predictions)
      .where(eq(predictions.seasonId, season.id));
    rememberSeasonSubmissionSettings(season);
    importSources.add(source);
    originalSeasonStateBySource.set(source, {
      activeSnapshotId: season.activeSnapshotId,
      finalSnapshotId: season.finalSnapshotId,
      seasonId: season.id,
      standingsAcceptedThrough: season.standingsAcceptedThrough,
    });
    for (const predictionId of predictionIds) {
      createdPredictionIds.add(predictionId);
    }

    await db
      .update(seasons)
      .set({
        openingKickoff: privateOpeningKickoff,
        revealPredictions: false,
        submissionsLocked: false,
      })
      .where(eq(seasons.id, season.id));
    await db.insert(predictions).values(
      predictionIds.map((id, index) => ({
        createdAt: new Date(now - 300_000 + index * 1_000),
        id,
        normalizedParticipantName: `season glance ${index} ${suffix}`,
        participantName: `Season Glance ${index + 1} ${suffix}`,
        seasonId: season.id,
      })),
    );
    await db.insert(predictionItems).values([
      ...activeTeams.map((team, index) => ({
        predictedPosition: index + 1,
        predictionId: predictionIds[0]!,
        teamId: team.id,
      })),
      ...[...activeTeams].reverse().map((team, index) => ({
        predictedPosition: index + 1,
        predictionId: predictionIds[1]!,
        teamId: team.id,
      })),
    ]);
    await db.insert(predictionCategoryPicks).values(
      predictionIds.flatMap((predictionId, index) =>
        categoryPicksFor(activeTeams).map((pick) => ({
          category: pick.category,
          customPlayerName:
            "customPlayerName" in pick
              ? `${pick.customPlayerName} ${index} ${suffix}`
              : undefined,
          normalizedCustomPlayerName:
            "customPlayerName" in pick
              ? `${pick.customPlayerName} ${index} ${suffix}`.toLowerCase()
              : undefined,
          predictionId,
          teamId: "teamId" in pick ? pick.teamId : undefined,
        })),
      ),
    );

    const snapshotInput = {
      isFinal: false,
      kind: "snapshot" as const,
      seasonSlug: season.slug,
      source,
      sourceReference: null,
      sourceUpdatedAt: null,
      version: 1 as const,
    };
    const first = await importCanonicalStandings({
      ...snapshotInput,
      capturedAt: firstCapturedAt.toISOString(),
      matchweek: 1,
      standings: activeTeams.map((team, index) => ({
        actualPosition: index + 1,
        leaguePoints: activeTeams.length - index,
        playedGames: 1,
        teamSlug: team.slug,
      })),
    });
    expect(first.status).toBe("succeeded");
    const second = await importCanonicalStandings({
      ...snapshotInput,
      capturedAt: secondCapturedAt.toISOString(),
      matchweek: 2,
      standings: [...activeTeams].reverse().map((team, index) => ({
        actualPosition: index + 1,
        leaguePoints: activeTeams.length - index,
        playedGames: 2,
        teamSlug: team.slug,
      })),
    });
    expect(second.status).toBe("succeeded");

    const privateView = await getSeasonTableView();
    expect(privateView).toMatchObject({
      consensusActive: false,
      entryCount: 0,
      predictionsRevealed: false,
      rows: null,
    });

    await db
      .update(seasons)
      .set({
        openingKickoff: scoredOpeningKickoff,
        revealPredictions: true,
        submissionsLocked: true,
      })
      .where(eq(seasons.id, season.id));
    const [seasonView, leaderboardView] = await Promise.all([
      getSeasonTableView(),
      getLeaderboardView(),
    ]);
    expect(seasonView.predictionsRevealed).toBe(true);
    expect(seasonView.consensusActive).toBe(true);
    expect(seasonView.entryCount).toBe(
      Number(baselinePredictionCount?.value ?? 0) + 2,
    );
    expect(seasonView.rows).toHaveLength(20);
    expect(seasonView.rows?.every((row) => row.avgPredicted !== null)).toBe(
      true,
    );
    const fixtureMovement = new Map(
      leaderboardView.scoredEntries
        ?.filter((entry) => predictionIdSet.has(entry.id))
        .map((entry) => [entry.id, entry.movement]),
    );
    expect(fixtureMovement.get(predictionIds[0]!)).toBeLessThan(0);
    expect(fixtureMovement.get(predictionIds[1]!)).toBeGreaterThan(0);
  });

  it("reseeds by stable external ID while retaining inactive historical player references", async () => {
    const { activeTeams, db, season } = await activeFixture();
    const fixturePlayer = PREMIER_LEAGUE_2026_27_PLAYERS.find(
      (player) =>
        player.externalId &&
        player.assetPath &&
        activeTeams.some((team) => team.slug === player.teamSlug),
    );
    if (!fixturePlayer?.externalId || !fixturePlayer.assetPath) {
      throw new Error("A seeded portrait player is required.");
    }

    const expectedTeam = activeTeams.find(
      (team) => team.slug === fixturePlayer.teamSlug,
    );
    const staleTeam = activeTeams.find((team) => team.id !== expectedTeam?.id);
    if (!expectedTeam || !staleTeam) {
      throw new Error("Two seeded teams are required.");
    }

    const [fixturePlayerBefore] = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.seasonId, season.id),
          eq(players.externalId, fixturePlayer.externalId),
        ),
      )
      .limit(1);
    if (!fixturePlayerBefore) {
      throw new Error("The selected fixture player is not seeded.");
    }

    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const historicalPlayerId = randomUUID();
    const historicalExternalId =
      1_900_000_000 + (Number.parseInt(suffix.slice(0, 7), 16) % 100_000_000);
    const historicalAssetPath = `/player-faces/qa-historical-${suffix}.png`;
    let predictionId: string | undefined;

    await db.insert(players).values({
      assetPath: historicalAssetPath,
      displayName: "QA Historical Player",
      externalId: historicalExternalId,
      firstName: "QA Historical",
      id: historicalPlayerId,
      isActive: true,
      lastName: "Player",
      seasonId: season.id,
      slug: `qa-historical-${suffix}`,
      sortName: `Player, QA Historical ${suffix}`,
      teamId: staleTeam.id,
    });

    try {
      const categoryPicks = categoryPicksFor(activeTeams);
      categoryPicks[0] = {
        category: "top_scorer",
        playerId: historicalPlayerId,
      };
      categoryPicks[1] = {
        category: "top_assister",
        playerId: fixturePlayerBefore.id,
      };
      const created = await createPrediction({
        categoryPicks,
        honeypot: "",
        participantName: `Seed QA ${suffix}`,
        items: activeTeams.map((team, index) => ({
          predictedPosition: index + 1,
          teamId: team.id,
        })),
      });
      predictionId = created.id;
      createdPredictionIds.add(created.id);

      await db
        .update(players)
        .set({
          assetPath: `/player-faces/qa-stale-${suffix}.png`,
          displayName: "QA Stale Fixture Player",
          firstName: "QA Stale",
          isActive: false,
          lastName: "Fixture Player",
          slug: `qa-stale-${suffix}`,
          sortName: `Stale, QA ${suffix}`,
          teamId: staleTeam.id,
        })
        .where(eq(players.id, fixturePlayerBefore.id));

      const firstSeed = await seedDatabase(db);
      expect(firstSeed).toEqual({
        playerCount: PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
        seasonId: season.id,
        teamCount: 20,
      });

      const [[fixturePlayerAfter], [historicalPlayerAfter], referencedPicks] =
        await Promise.all([
          db
            .select()
            .from(players)
            .where(eq(players.id, fixturePlayerBefore.id))
            .limit(1),
          db
            .select()
            .from(players)
            .where(eq(players.id, historicalPlayerId))
            .limit(1),
          db
            .select({
              category: predictionCategoryPicks.category,
              playerId: predictionCategoryPicks.playerId,
            })
            .from(predictionCategoryPicks)
            .where(eq(predictionCategoryPicks.predictionId, created.id)),
        ]);

      expect(fixturePlayerAfter).toMatchObject({
        assetPath: fixturePlayer.assetPath,
        displayName: fixturePlayer.displayName,
        externalId: fixturePlayer.externalId,
        id: fixturePlayerBefore.id,
        isActive: true,
        slug: fixturePlayer.slug,
        teamId: expectedTeam.id,
      });
      expect(historicalPlayerAfter).toMatchObject({
        assetPath: historicalAssetPath,
        externalId: historicalExternalId,
        id: historicalPlayerId,
        isActive: false,
      });
      expect(
        referencedPicks.find((pick) => pick.category === "top_scorer"),
      ).toMatchObject({ playerId: historicalPlayerId });
      expect(
        referencedPicks.find((pick) => pick.category === "top_assister"),
      ).toMatchObject({ playerId: fixturePlayerBefore.id });

      const historicalPicks = await getSpotlightPicksByPredictionId([
        created.id,
      ]);
      expect(historicalPicks.get(created.id)?.[0]).toMatchObject({
        assetPath: historicalAssetPath,
        category: "top_scorer",
        displayName: "QA Historical Player",
      });
      expect(historicalPicks.get(created.id)?.[1]).toMatchObject({
        assetPath: fixturePlayer.assetPath,
        category: "top_assister",
        displayName: fixturePlayer.displayName,
      });

      const { season: activeSeason } = await getActiveSeasonContext();
      const activePlayers = await getActiveSeasonPlayers(activeSeason.id);
      expect(activePlayers).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);
      expect(
        activePlayers.some((player) => player.id === historicalPlayerId),
      ).toBe(false);
      expect(
        activePlayers.some((player) => player.id === fixturePlayerBefore.id),
      ).toBe(true);

      const secondSeed = await seedDatabase(db);
      expect(secondSeed).toEqual(firstSeed);
      const [[fixturePlayerAfterSecondSeed], [historicalAfterSecondSeed]] =
        await Promise.all([
          db
            .select({ id: players.id, isActive: players.isActive })
            .from(players)
            .where(eq(players.id, fixturePlayerBefore.id))
            .limit(1),
          db
            .select({ id: players.id, isActive: players.isActive })
            .from(players)
            .where(eq(players.id, historicalPlayerId))
            .limit(1),
        ]);
      expect(fixturePlayerAfterSecondSeed).toEqual({
        id: fixturePlayerBefore.id,
        isActive: true,
      });
      expect(historicalAfterSecondSeed).toEqual({
        id: historicalPlayerId,
        isActive: false,
      });
    } finally {
      if (predictionId) {
        await db.delete(predictions).where(eq(predictions.id, predictionId));
        createdPredictionIds.delete(predictionId);
      }
      await db.delete(players).where(eq(players.id, historicalPlayerId));
      await db
        .update(players)
        .set({
          assetPath: fixturePlayerBefore.assetPath,
          displayName: fixturePlayerBefore.displayName,
          firstName: fixturePlayerBefore.firstName,
          isActive: fixturePlayerBefore.isActive,
          lastName: fixturePlayerBefore.lastName,
          slug: fixturePlayerBefore.slug,
          sortName: fixturePlayerBefore.sortName,
          teamId: fixturePlayerBefore.teamId,
          updatedAt: fixturePlayerBefore.updatedAt,
        })
        .where(eq(players.id, fixturePlayerBefore.id));
    }
  });

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

  it("ignores the legacy earlier-deadline column during an atomic submission", async () => {
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

    const created = await createPrediction(
      {
        categoryPicks: categoryPicksFor(activeTeams),
        honeypot: "",
        items,
        participantName,
      },
      new Date("2000-01-01T00:00:00.000Z"),
    );
    createdPredictionIds.add(created.id);

    const [persisted] = await db
      .select({ value: count() })
      .from(predictions)
      .where(
        and(
          eq(predictions.seasonId, season.id),
          eq(predictions.normalizedParticipantName, normalizedName),
        ),
      );
    expect(persisted?.value).toBe(1);
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

  it("allows only one permanent close transition and one truthful audit", async () => {
    const { db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db
      .update(seasons)
      .set({
        openingKickoff: new Date("2099-08-21T19:00:00.000Z"),
        revealPredictions: false,
        submissionsLocked: false,
      })
      .where(eq(seasons.id, season.id));

    const lockRequestId = `closure-lock-${randomUUID()}`;
    const revealRequestId = `closure-reveal-${randomUUID()}`;
    closureAuditRequestIds.add(lockRequestId);
    closureAuditRequestIds.add(revealRequestId);

    const outcomes = await Promise.all([
      closeSeasonPermanentlyAtomically(db, {
        intent: "lock",
        requestId: lockRequestId,
        seasonId: season.id,
      }),
      closeSeasonPermanentlyAtomically(db, {
        intent: "reveal",
        requestId: revealRequestId,
        seasonId: season.id,
      }),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);

    const [closedSeason] = await db
      .select({
        revealPredictions: seasons.revealPredictions,
        submissionsLocked: seasons.submissionsLocked,
      })
      .from(seasons)
      .where(eq(seasons.id, season.id))
      .limit(1);
    expect(closedSeason).toEqual({
      revealPredictions: true,
      submissionsLocked: true,
    });

    const audits = await db
      .select({
        action: adminAuditLogs.action,
        requestId: adminAuditLogs.requestId,
      })
      .from(adminAuditLogs)
      .where(
        inArray(adminAuditLogs.requestId, [lockRequestId, revealRequestId]),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toMatch(
      /^season\.(submissions_locked|predictions_revealed_early)$/u,
    );

    const noOpRequestId = `closure-noop-${randomUUID()}`;
    closureAuditRequestIds.add(noOpRequestId);
    await expect(
      closeSeasonPermanentlyAtomically(db, {
        intent: "lock",
        requestId: noOpRequestId,
        seasonId: season.id,
      }),
    ).resolves.toBe(false);
    const [noOpAuditCount] = await db
      .select({ value: count() })
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.requestId, noOpRequestId));
    expect(noOpAuditCount?.value).toBe(0);
  });

  it("does not mutate or audit a close request after natural kickoff", async () => {
    const { db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db
      .update(seasons)
      .set({
        openingKickoff: new Date("2000-01-01T00:00:00.000Z"),
        revealPredictions: false,
        submissionsLocked: false,
      })
      .where(eq(seasons.id, season.id));

    const requestId = `closure-natural-${randomUUID()}`;
    closureAuditRequestIds.add(requestId);
    await expect(
      closeSeasonPermanentlyAtomically(db, {
        intent: "reveal",
        requestId,
        seasonId: season.id,
      }),
    ).resolves.toBe(false);

    const [[unchangedSeason], [auditCount]] = await Promise.all([
      db
        .select({
          revealPredictions: seasons.revealPredictions,
          submissionsLocked: seasons.submissionsLocked,
        })
        .from(seasons)
        .where(eq(seasons.id, season.id))
        .limit(1),
      db
        .select({ value: count() })
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.requestId, requestId)),
    ]);
    expect(unchangedSeason).toEqual({
      revealPredictions: false,
      submissionsLocked: false,
    });
    expect(auditCount?.value).toBe(0);
  });

  it("does not close or audit when its season row lock crosses kickoff", async () => {
    const { db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db.execute(sql`
      update "seasons"
      set
        "opening_kickoff" = clock_timestamp() + interval '2 seconds',
        "submissions_locked" = false,
        "reveal_predictions" = false
      where "id" = ${season.id}::uuid
    `);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required.");
    const pool = new Pool({ connectionString: databaseUrl });
    const blocker = await pool.connect();
    const requestId = `closure-kickoff-race-${randomUUID()}`;
    closureAuditRequestIds.add(requestId);
    let transactionOpen = false;

    try {
      await blocker.query("begin");
      transactionOpen = true;
      await blocker.query("select id from seasons where id = $1 for update", [
        season.id,
      ]);

      let closeSettled = false;
      const closeOutcome = closeSeasonPermanentlyAtomically(db, {
        authoritativeNow: sql<Date>`clock_timestamp()`,
        intent: "lock",
        requestId,
        seasonId: season.id,
      }).then((value) => {
        closeSettled = true;
        return value;
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(closeSettled).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 2_100));

      await blocker.query("commit");
      transactionOpen = false;
      await expect(closeOutcome).resolves.toBe(false);

      const [[unchangedSeason], [auditCount]] = await Promise.all([
        db
          .select({
            revealPredictions: seasons.revealPredictions,
            submissionsLocked: seasons.submissionsLocked,
          })
          .from(seasons)
          .where(eq(seasons.id, season.id))
          .limit(1),
        db
          .select({ value: count() })
          .from(adminAuditLogs)
          .where(eq(adminAuditLogs.requestId, requestId)),
      ]);
      expect(unchangedSeason).toEqual({
        revealPredictions: false,
        submissionsLocked: false,
      });
      expect(auditCount?.value).toBe(0);
    } finally {
      if (transactionOpen) await blocker.query("rollback");
      blocker.release();
      await pool.end();
    }
  }, 15_000);

  it("rechecks wall-clock time after a row lock crosses opening kickoff", async () => {
    const { activeTeams, db, season } = await activeFixture();
    rememberSeasonSubmissionSettings(season);
    await db.execute(sql`
      update "seasons"
      set
        "opening_kickoff" = clock_timestamp() + interval '2 seconds',
        "submission_deadline" = clock_timestamp() + interval '10 seconds',
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
      .select({
        isFinal: standingsSnapshots.isFinal,
        source: standingsSnapshots.source,
      })
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
      db
        .update(standingsSnapshots)
        .set({ source: `${source}-tampered` })
        .where(eq(standingsSnapshots.id, imported.snapshotId)),
    ).rejects.toThrow();
    const [snapshotAfterRejectedUpdate] = await db
      .select({ source: standingsSnapshots.source })
      .from(standingsSnapshots)
      .where(eq(standingsSnapshots.id, imported.snapshotId));
    expect(snapshotAfterRejectedUpdate?.source).toBe(importedSnapshot?.source);
    const [importedItem] = await db
      .select({
        snapshotId: standingsItems.snapshotId,
        teamId: standingsItems.teamId,
      })
      .from(standingsItems)
      .where(eq(standingsItems.snapshotId, imported.snapshotId))
      .limit(1);
    expect(importedItem).toBeTruthy();
    await expect(
      db
        .delete(standingsItems)
        .where(
          and(
            eq(standingsItems.snapshotId, imported.snapshotId),
            eq(standingsItems.teamId, importedItem!.teamId),
          ),
        ),
    ).rejects.toThrow();
    const [itemAfterRejectedDelete] = await db
      .select({ teamId: standingsItems.teamId })
      .from(standingsItems)
      .where(
        and(
          eq(standingsItems.snapshotId, imported.snapshotId),
          eq(standingsItems.teamId, importedItem!.teamId),
        ),
      );
    expect(itemAfterRejectedDelete?.teamId).toBe(importedItem?.teamId);

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
