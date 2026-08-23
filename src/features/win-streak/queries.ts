import "server-only";

import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db/client";
import {
  teams,
  winStreakFixtures,
  winStreakPicks,
  winStreakProfiles,
  winStreakRounds,
} from "@/db/schema";
import { getActiveSeasonContext } from "@/features/seasons/queries";

import {
  deriveWinStreakParticipant,
  rankWinStreakLeaderboard,
  type WinStreakParticipantFacts,
  type WinStreakPickFact,
  type WinStreakResult,
} from "./scoring";
import {
  isWinStreakMatchweek,
  isWinStreakTeamSlug,
  type WinStreakMatchweek,
  type WinStreakTeamSlug,
} from "./fixtures";
import { readWinStreakReceipt, receiptMatchesHash } from "./receipt";
import { WIN_STREAK_PROFILE_LIMIT } from "./atomic";
import type {
  WinStreakActiveRoundView,
  WinStreakHistoryView,
  WinStreakLeaderboardRow,
  WinStreakPublicPick,
  WinStreakViewerView,
} from "./view-model";

export type WinStreakPageData = {
  activeRound: WinStreakActiveRoundView | null;
  leaderboard: readonly WinStreakLeaderboardRow[];
  viewer: WinStreakViewerView | null;
};

const pickedHomeTeams = alias(teams, "win_streak_picked_home_teams");
const pickedAwayTeams = alias(teams, "win_streak_picked_away_teams");
const SNAPSHOT_READ_ATTEMPTS = 3;

async function loadRoundRows(seasonId: string) {
  return getDb()
    .select({
      fixtureContentHash: winStreakRounds.fixtureContentHash,
      id: winStreakRounds.id,
      matchweek: winStreakRounds.matchweek,
      pickDeadline: winStreakRounds.pickDeadline,
      resolvedAt: winStreakRounds.resolvedAt,
    })
    .from(winStreakRounds)
    .where(eq(winStreakRounds.seasonId, seasonId))
    .orderBy(asc(winStreakRounds.matchweek));
}

function roundSnapshotVersion(
  rows: Awaited<ReturnType<typeof loadRoundRows>>,
): string {
  return rows
    .map((round) =>
      [
        round.id,
        round.matchweek,
        round.pickDeadline.toISOString(),
        round.resolvedAt?.toISOString() ?? "open",
        round.fixtureContentHash,
      ].join("|"),
    )
    .join("\n");
}

function requiredMatchweek(value: number): WinStreakMatchweek {
  if (!isWinStreakMatchweek(value)) {
    throw new Error(
      `Database returned unsupported Win Streak Matchweek ${value}.`,
    );
  }
  return value;
}

function requiredTeamSlug(value: string): WinStreakTeamSlug {
  if (!isWinStreakTeamSlug(value)) {
    throw new Error(`Database returned unknown Win Streak club ${value}.`);
  }
  return value;
}

function requiredResult(value: string | null): WinStreakResult {
  if (
    value !== null &&
    value !== "home_win" &&
    value !== "draw" &&
    value !== "away_win" &&
    value !== "void"
  ) {
    throw new Error(`Database returned unknown Win Streak result ${value}.`);
  }
  return value;
}

function publicPick(
  pick: {
    isHome: boolean;
    matchweek: number;
    opponentTeamSlug: WinStreakTeamSlug;
    teamSlug: WinStreakTeamSlug;
  } | null,
): WinStreakPublicPick | null {
  return pick
    ? {
        isHome: pick.isHome,
        matchweek: pick.matchweek,
        opponentTeamSlug: pick.opponentTeamSlug,
        teamSlug: pick.teamSlug,
      }
    : null;
}

async function authorizedProfileId(seasonId: string): Promise<string | null> {
  const receipt = await readWinStreakReceipt();
  if (!receipt) return null;

  const [profile] = await getDb()
    .select({
      id: winStreakProfiles.id,
      receiptTokenHash: winStreakProfiles.receiptTokenHash,
      seasonId: winStreakProfiles.seasonId,
    })
    .from(winStreakProfiles)
    .where(eq(winStreakProfiles.id, receipt.profileId))
    .limit(1);
  return profile &&
    profile.seasonId === seasonId &&
    receiptMatchesHash(receipt.token, profile.receiptTokenHash) &&
    profile.id === receipt.profileId
    ? profile.id
    : null;
}

async function readWinStreakPageData(
  attempt: number,
): Promise<WinStreakPageData> {
  const { databaseNow, season } = await getActiveSeasonContext();
  const db = getDb();
  const roundRows = await loadRoundRows(season.id);
  const [profileRows, pickRows, viewerProfileId] = await Promise.all([
    db
      .select({
        displayName: winStreakProfiles.participantName,
        id: winStreakProfiles.id,
        joinedMatchweek: winStreakRounds.matchweek,
      })
      .from(winStreakProfiles)
      .innerJoin(
        winStreakRounds,
        eq(winStreakRounds.id, winStreakProfiles.joinedRoundId),
      )
      .where(eq(winStreakProfiles.seasonId, season.id))
      .orderBy(asc(winStreakProfiles.createdAt))
      .limit(WIN_STREAK_PROFILE_LIMIT + 1),
    db
      .select({
        awayTeamSlug: pickedAwayTeams.slug,
        homeTeamSlug: pickedHomeTeams.slug,
        kickoffAt: winStreakFixtures.kickoffAt,
        matchweek: winStreakRounds.matchweek,
        profileId: winStreakPicks.profileId,
        result: winStreakFixtures.result,
        teamSlug: teams.slug,
      })
      .from(winStreakPicks)
      .innerJoin(
        winStreakProfiles,
        eq(winStreakProfiles.id, winStreakPicks.profileId),
      )
      .innerJoin(
        winStreakRounds,
        eq(winStreakRounds.id, winStreakPicks.roundId),
      )
      .innerJoin(
        winStreakFixtures,
        eq(winStreakFixtures.id, winStreakPicks.fixtureId),
      )
      .innerJoin(teams, eq(teams.id, winStreakPicks.teamId))
      .innerJoin(
        pickedHomeTeams,
        eq(pickedHomeTeams.id, winStreakFixtures.homeTeamId),
      )
      .innerJoin(
        pickedAwayTeams,
        eq(pickedAwayTeams.id, winStreakFixtures.awayTeamId),
      )
      .where(eq(winStreakProfiles.seasonId, season.id))
      .orderBy(asc(winStreakRounds.matchweek))
      .limit(WIN_STREAK_PROFILE_LIMIT * 37 + 1),
    authorizedProfileId(season.id),
  ]);

  if (
    profileRows.length > WIN_STREAK_PROFILE_LIMIT ||
    pickRows.length > WIN_STREAK_PROFILE_LIMIT * 37
  ) {
    throw new Error(
      "Win Streak storage exceeds its bounded public read limit.",
    );
  }

  if (roundRows.length !== 37) {
    throw new Error(
      `Win Streak requires 37 seeded rounds; found ${roundRows.length}.`,
    );
  }
  const firstUnresolvedIndex = roundRows.findIndex(
    (round) => round.resolvedAt === null,
  );
  if (
    firstUnresolvedIndex >= 0 &&
    roundRows
      .slice(firstUnresolvedIndex + 1)
      .some((round) => round.resolvedAt !== null)
  ) {
    throw new Error("Win Streak rounds must resolve in matchweek order.");
  }
  const resolvedThroughMatchweek =
    firstUnresolvedIndex === 0
      ? null
      : requiredMatchweek(
          roundRows[
            firstUnresolvedIndex === -1
              ? roundRows.length - 1
              : firstUnresolvedIndex - 1
          ]!.matchweek,
        );
  const activeRoundRow =
    firstUnresolvedIndex === -1 ? null : roundRows[firstUnresolvedIndex]!;

  const picksByProfile = new Map<string, WinStreakPickFact[]>();
  for (const row of pickRows) {
    const facts = picksByProfile.get(row.profileId) ?? [];
    facts.push({
      awayTeamSlug: requiredTeamSlug(row.awayTeamSlug),
      homeTeamSlug: requiredTeamSlug(row.homeTeamSlug),
      kickoffAt: row.kickoffAt.toISOString(),
      matchweek: requiredMatchweek(row.matchweek),
      result: requiredResult(row.result),
      teamSlug: requiredTeamSlug(row.teamSlug),
    });
    picksByProfile.set(row.profileId, facts);
  }

  const projections = profileRows.map((profile) => ({
    id: profile.id,
    projection: deriveWinStreakParticipant({
      displayName: profile.displayName,
      joinedMatchweek: requiredMatchweek(profile.joinedMatchweek),
      picks: picksByProfile.get(profile.id) ?? [],
      resolvedThroughMatchweek,
    } satisfies WinStreakParticipantFacts),
  }));
  const idByDisplayName = new Map(
    profileRows.map((profile) => [profile.displayName, profile.id] as const),
  );
  const leaderboard = rankWinStreakLeaderboard(
    projections.map(({ projection }) => projection),
  ).map((entry): WinStreakLeaderboardRow => ({
    bestStreak: entry.bestStreak,
    currentPick: publicPick(entry.nextPick),
    currentStreak: entry.currentStreak,
    displayName: entry.displayName,
    isViewer: idByDisplayName.get(entry.displayName) === viewerProfileId,
    rank: entry.rank,
  }));

  const activeRound = activeRoundRow
    ? await activeRoundView(
        activeRoundRow.id,
        requiredMatchweek(activeRoundRow.matchweek),
        activeRoundRow.pickDeadline,
        databaseNow,
      )
    : null;
  const verifiedRoundRows = await loadRoundRows(season.id);
  if (
    roundSnapshotVersion(verifiedRoundRows) !== roundSnapshotVersion(roundRows)
  ) {
    if (attempt + 1 >= SNAPSHOT_READ_ATTEMPTS) {
      throw new Error(
        "Win Streak changed while the public leaderboard was loading. Refresh and try again.",
      );
    }
    return readWinStreakPageData(attempt + 1);
  }
  const viewerProjection = projections.find(
    (candidate) => candidate.id === viewerProfileId,
  )?.projection;
  const viewer = viewerProjection
    ? ({
        bestStreak: viewerProjection.bestStreak,
        currentPick: publicPick(viewerProjection.nextPick),
        currentStreak: viewerProjection.currentStreak,
        displayName: viewerProjection.displayName,
        history: viewerProjection.history.map(
          (entry): WinStreakHistoryView => ({
            isHome: entry.isHome,
            matchweek: entry.matchweek,
            opponentTeamSlug: entry.opponentTeamSlug,
            outcome: entry.outcome,
            teamSlug: entry.teamSlug,
          }),
        ),
        usedWinningTeamSlugs: viewerProjection.usedWinningTeamSlugs,
      } satisfies WinStreakViewerView)
    : null;

  return { activeRound, leaderboard, viewer };
}

export async function getWinStreakPageData(): Promise<WinStreakPageData> {
  return readWinStreakPageData(0);
}

async function activeRoundView(
  roundId: string,
  matchweek: WinStreakMatchweek,
  deadline: Date,
  databaseNow: Date,
): Promise<WinStreakActiveRoundView> {
  const fixtureRows = await getDb()
    .select({
      awayTeamId: winStreakFixtures.awayTeamId,
      homeTeamId: winStreakFixtures.homeTeamId,
      kickoffAt: winStreakFixtures.kickoffAt,
    })
    .from(winStreakFixtures)
    .where(eq(winStreakFixtures.roundId, roundId))
    .orderBy(asc(winStreakFixtures.kickoffAt));
  if (fixtureRows.length !== 10) {
    throw new Error(`Matchweek ${matchweek} must contain 10 fixtures.`);
  }
  const teamRows = await getDb()
    .select({ id: teams.id, slug: teams.slug })
    .from(teams);
  const teamSlugById = new Map(teamRows.map((team) => [team.id, team.slug]));

  return {
    deadlineAt: deadline.toISOString(),
    fixtures: fixtureRows.map((fixture) => ({
      awayTeamSlug: requiredTeamSlug(
        teamSlugById.get(fixture.awayTeamId) ?? "",
      ),
      homeTeamSlug: requiredTeamSlug(
        teamSlugById.get(fixture.homeTeamId) ?? "",
      ),
      kickoffAt: fixture.kickoffAt.toISOString(),
    })),
    matchweek,
    pickOpen: databaseNow.getTime() < deadline.getTime(),
  };
}
