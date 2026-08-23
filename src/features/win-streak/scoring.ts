import {
  WIN_STREAK_MATCHWEEKS,
  getWinStreakFixtureForTeam,
  getWinStreakTeam,
  isWinStreakMatchweek,
  isWinStreakTeamSlug,
  type WinStreakFixture,
  type WinStreakMatchweek,
  type WinStreakTeamSlug,
} from "./fixtures";

export type WinStreakResult = "home_win" | "draw" | "away_win" | "void" | null;

export type WinStreakPickFact = {
  readonly matchweek: WinStreakMatchweek;
  readonly result: WinStreakResult;
  readonly teamSlug: WinStreakTeamSlug;
};

export type WinStreakParticipantFacts = {
  readonly displayName: string;
  readonly joinedMatchweek: WinStreakMatchweek;
  readonly picks: readonly WinStreakPickFact[];
  readonly resolvedThroughMatchweek: WinStreakMatchweek | null;
};

export type WinStreakPickOutcome =
  "pending" | "win" | "draw" | "loss" | "missed" | "void";

export type WinStreakHistoryEntry = {
  readonly isHome: boolean | null;
  readonly kickoffAt: string | null;
  readonly matchweek: WinStreakMatchweek;
  readonly opponentTeamSlug: WinStreakTeamSlug | null;
  readonly outcome: WinStreakPickOutcome;
  readonly result: WinStreakResult;
  readonly teamSlug: WinStreakTeamSlug | null;
};

export type WinStreakNextPick = {
  readonly isHome: boolean;
  readonly kickoffAt: string;
  readonly matchweek: WinStreakMatchweek;
  readonly opponentTeamSlug: WinStreakTeamSlug;
  readonly teamSlug: WinStreakTeamSlug;
};

export type WinStreakParticipantProjection = {
  readonly availableTeamCount: number;
  readonly bestStreak: number;
  readonly currentStreak: number;
  readonly displayName: string;
  readonly history: readonly WinStreakHistoryEntry[];
  readonly nextPick: WinStreakNextPick | null;
  readonly usedWinningTeamSlugs: readonly WinStreakTeamSlug[];
};

export type WinStreakLeaderboardEntry = WinStreakParticipantProjection & {
  readonly rank: number;
};

const RESULT_SET = new Set<Exclude<WinStreakResult, null>>([
  "home_win",
  "draw",
  "away_win",
  "void",
]);

function scoringError(message: string): never {
  throw new Error(`Invalid Win Streak facts: ${message}`);
}

function resultIsValid(result: WinStreakResult): boolean {
  return result === null || RESULT_SET.has(result);
}

function nextMatchweek(
  matchweek: WinStreakMatchweek | null,
): WinStreakMatchweek | null {
  if (matchweek === null) return WIN_STREAK_MATCHWEEKS[0];
  const index = WIN_STREAK_MATCHWEEKS.indexOf(matchweek);
  return WIN_STREAK_MATCHWEEKS[index + 1] ?? null;
}

function pickOutcome(
  pick: WinStreakPickFact,
  fixture: WinStreakFixture,
): Exclude<WinStreakPickOutcome, "missed"> {
  if (pick.result === null) return "pending";
  if (pick.result === "void") return "void";
  if (pick.result === "draw") return "draw";

  const pickedHomeTeam = fixture.homeTeamSlug === pick.teamSlug;
  return (pick.result === "home_win" && pickedHomeTeam) ||
    (pick.result === "away_win" && !pickedHomeTeam)
    ? "win"
    : "loss";
}

function historyForPick(
  pick: WinStreakPickFact,
  fixture: WinStreakFixture,
): WinStreakHistoryEntry {
  const isHome = fixture.homeTeamSlug === pick.teamSlug;
  return {
    isHome,
    kickoffAt: fixture.kickoffAt,
    matchweek: pick.matchweek,
    opponentTeamSlug: isHome ? fixture.awayTeamSlug : fixture.homeTeamSlug,
    outcome: pickOutcome(pick, fixture),
    result: pick.result,
    teamSlug: pick.teamSlug,
  };
}

function missedHistory(matchweek: WinStreakMatchweek): WinStreakHistoryEntry {
  return {
    isHome: null,
    kickoffAt: null,
    matchweek,
    opponentTeamSlug: null,
    outcome: "missed",
    result: null,
    teamSlug: null,
  };
}

function toNextPick(entry: WinStreakHistoryEntry): WinStreakNextPick | null {
  if (
    entry.outcome !== "pending" ||
    entry.teamSlug === null ||
    entry.opponentTeamSlug === null ||
    entry.kickoffAt === null ||
    entry.isHome === null
  ) {
    return null;
  }
  return {
    isHome: entry.isHome,
    kickoffAt: entry.kickoffAt,
    matchweek: entry.matchweek,
    opponentTeamSlug: entry.opponentTeamSlug,
    teamSlug: entry.teamSlug,
  };
}

function validatedPicks(
  facts: WinStreakParticipantFacts,
): readonly WinStreakPickFact[] {
  if (!facts.displayName.trim()) {
    scoringError("display name is empty.");
  }
  if (!isWinStreakMatchweek(facts.joinedMatchweek)) {
    scoringError(`unsupported joined Matchweek ${facts.joinedMatchweek}.`);
  }
  if (
    facts.resolvedThroughMatchweek !== null &&
    !isWinStreakMatchweek(facts.resolvedThroughMatchweek)
  ) {
    scoringError(
      `unsupported resolved Matchweek ${facts.resolvedThroughMatchweek}.`,
    );
  }

  const openMatchweek = nextMatchweek(facts.resolvedThroughMatchweek);
  if (openMatchweek !== null && facts.joinedMatchweek > openMatchweek) {
    scoringError(
      `joined Matchweek ${facts.joinedMatchweek} is after the open Matchweek ${openMatchweek}.`,
    );
  }

  const picks = facts.picks
    .map((pick) => ({ ...pick }))
    .sort((left, right) => left.matchweek - right.matchweek);
  const seenMatchweeks = new Set<WinStreakMatchweek>();
  for (const pick of picks) {
    if (
      !isWinStreakMatchweek(pick.matchweek) ||
      !isWinStreakTeamSlug(pick.teamSlug) ||
      !resultIsValid(pick.result)
    ) {
      scoringError(`Matchweek ${pick.matchweek} contains an invalid pick.`);
    }
    if (pick.matchweek < facts.joinedMatchweek) {
      scoringError(
        `Matchweek ${pick.matchweek} precedes the participant join round.`,
      );
    }
    if (seenMatchweeks.has(pick.matchweek)) {
      scoringError(`Matchweek ${pick.matchweek} has more than one pick.`);
    }
    seenMatchweeks.add(pick.matchweek);

    if (pick.result === null) {
      if (openMatchweek === null || pick.matchweek !== openMatchweek) {
        scoringError(
          `unresolved pick must belong to the open Matchweek ${openMatchweek ?? "after the season"}.`,
        );
      }
    } else if (
      facts.resolvedThroughMatchweek === null ||
      pick.matchweek > facts.resolvedThroughMatchweek
    ) {
      scoringError(
        `resolved pick in Matchweek ${pick.matchweek} exceeds the completed rounds.`,
      );
    }
  }
  return picks;
}

export function deriveWinStreakParticipant(
  facts: WinStreakParticipantFacts,
): WinStreakParticipantProjection {
  const picks = validatedPicks(facts);
  const pickByMatchweek = new Map(
    picks.map((pick) => [pick.matchweek, pick] as const),
  );
  const pendingPick = picks.find((pick) => pick.result === null) ?? null;
  const lastHistoryMatchweek =
    pendingPick?.matchweek ?? facts.resolvedThroughMatchweek;
  const historyMatchweeks =
    lastHistoryMatchweek === null
      ? []
      : WIN_STREAK_MATCHWEEKS.filter(
          (matchweek) =>
            matchweek >= facts.joinedMatchweek &&
            matchweek <= lastHistoryMatchweek,
        );

  let bestStreak = 0;
  let currentStreak = 0;
  const usedWinningTeamSlugs = new Set<WinStreakTeamSlug>();
  const history: WinStreakHistoryEntry[] = [];

  for (const matchweek of historyMatchweeks) {
    const pick = pickByMatchweek.get(matchweek);
    if (!pick) {
      history.push(missedHistory(matchweek));
      continue;
    }
    if (usedWinningTeamSlugs.has(pick.teamSlug)) {
      scoringError(
        `Matchweek ${matchweek} reuses ${getWinStreakTeam(pick.teamSlug).displayName} during the active streak.`,
      );
    }

    const fixture = getWinStreakFixtureForTeam(matchweek, pick.teamSlug);
    const entry = historyForPick(pick, fixture);
    history.push(entry);
    if (entry.outcome === "win") {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      usedWinningTeamSlugs.add(pick.teamSlug);
    } else if (entry.outcome === "draw" || entry.outcome === "loss") {
      currentStreak = 0;
      usedWinningTeamSlugs.clear();
    }
  }

  const nextPick = history.length > 0 ? toNextPick(history.at(-1)!) : null;
  return {
    availableTeamCount: PREMIER_LEAGUE_TEAM_COUNT - usedWinningTeamSlugs.size,
    bestStreak,
    currentStreak,
    displayName: facts.displayName,
    history,
    nextPick,
    usedWinningTeamSlugs: [...usedWinningTeamSlugs],
  };
}

const PREMIER_LEAGUE_TEAM_COUNT = 20;
const DISPLAY_NAME_COLLATOR = new Intl.Collator("en-GB", {
  sensitivity: "base",
  usage: "sort",
});

export function rankWinStreakLeaderboard(
  participants: readonly WinStreakParticipantProjection[],
): readonly WinStreakLeaderboardEntry[] {
  const sorted = participants
    .map((participant, originalIndex) => ({ participant, originalIndex }))
    .sort((left, right) => {
      const scoreDifference =
        right.participant.bestStreak - left.participant.bestStreak;
      if (scoreDifference !== 0) return scoreDifference;
      const nameDifference = DISPLAY_NAME_COLLATOR.compare(
        left.participant.displayName,
        right.participant.displayName,
      );
      return nameDifference || left.originalIndex - right.originalIndex;
    });

  let previousBest: number | null = null;
  let previousRank = 0;
  return sorted.map(({ participant }, index) => {
    const rank =
      previousBest === participant.bestStreak ? previousRank : index + 1;
    previousBest = participant.bestStreak;
    previousRank = rank;
    return { ...participant, rank };
  });
}
