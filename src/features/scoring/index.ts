import { PREMIER_LEAGUE_TEAM_COUNT } from "@/data";

import type {
  RankableLeaderboardEntry,
  RankedLeaderboardEntry,
  ScoredClub,
  ScorePoints,
  ScoreSummary,
  ScoreTier,
  ScoringPredictionItem,
  ScoringStandingsItem,
  ScoringState,
} from "./types";

export * from "./types";

function assertLeaguePosition(position: number, label: string): void {
  if (
    !Number.isInteger(position) ||
    position < 1 ||
    position > PREMIER_LEAGUE_TEAM_COUNT
  ) {
    throw new RangeError(`${label} must be an integer from 1 through 20.`);
  }
}

export function scoreClub(
  predictedPosition: number,
  actualPosition: number,
): ScorePoints {
  assertLeaguePosition(predictedPosition, "Predicted position");
  assertLeaguePosition(actualPosition, "Actual position");

  if (predictedPosition === actualPosition) return 5;

  if (Math.abs(predictedPosition - actualPosition) <= 3) return 3;

  const predictedTopHalf = predictedPosition <= 10;
  const actualTopHalf = actualPosition <= 10;

  return predictedTopHalf === actualTopHalf ? 1 : 0;
}

export function scoreTier(points: ScorePoints): ScoreTier {
  switch (points) {
    case 5:
      return "exact";
    case 3:
      return "within-three";
    case 1:
      return "correct-half";
    case 0:
      return "miss";
  }
}

function assertCompleteUniqueTeams(
  items: readonly { teamId: string }[],
  label: string,
): void {
  if (items.length !== PREMIER_LEAGUE_TEAM_COUNT) {
    throw new Error(`${label} must contain exactly 20 teams.`);
  }

  if (new Set(items.map((item) => item.teamId)).size !== items.length) {
    throw new Error(`${label} must contain each team exactly once.`);
  }
}

export function scorePrediction(
  prediction: readonly ScoringPredictionItem[],
  standings: readonly ScoringStandingsItem[],
): ScoreSummary {
  assertCompleteUniqueTeams(prediction, "Prediction");
  assertCompleteUniqueTeams(standings, "Standings");

  const actualPositionByTeamId = new Map(
    standings.map((item) => [item.teamId, item.actualPosition] as const),
  );

  const items: ScoredClub[] = prediction.map((item) => {
    const actualPosition = actualPositionByTeamId.get(item.teamId);
    if (actualPosition === undefined) {
      throw new Error("Prediction and standings team sets do not match.");
    }

    const points = scoreClub(item.predictedPosition, actualPosition);

    return {
      ...item,
      actualPosition,
      difference: Math.abs(item.predictedPosition - actualPosition),
      points,
      tier: scoreTier(points),
    };
  });

  return items.reduce<ScoreSummary>(
    (summary, item) => {
      summary.total += item.points;

      switch (item.tier) {
        case "exact":
          summary.exactCount += 1;
          break;
        case "within-three":
          summary.withinThreeCount += 1;
          break;
        case "correct-half":
          summary.correctHalfCount += 1;
          break;
        case "miss":
          summary.zeroCount += 1;
          break;
      }

      return summary;
    },
    {
      correctHalfCount: 0,
      exactCount: 0,
      items,
      total: 0,
      withinThreeCount: 0,
      zeroCount: 0,
    },
  );
}

/**
 * An explicitly all-zero played table is preseason and must not be scored.
 * Null played-game values remain scoreable for the manual-entry fallback.
 */
export function isStandingsScoringActive(
  standings: readonly ScoringStandingsItem[],
): boolean {
  return (
    standings.length === PREMIER_LEAGUE_TEAM_COUNT &&
    !standings.every((item) => item.playedGames === 0)
  );
}

export function scorePredictionIfActive(
  prediction: readonly ScoringPredictionItem[],
  standings: readonly ScoringStandingsItem[],
  scoringWindowOpen: boolean,
): ScoringState {
  if (!scoringWindowOpen || !isStandingsScoringActive(standings)) {
    return { status: "not-started" };
  }

  return { status: "scored", summary: scorePrediction(prediction, standings) };
}

const leaderboardNameCollator = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});

/** Competition ranking: totals 90, 90, 80 receive ranks 1, 1, 3. */
export function assignSharedRanks<T extends RankableLeaderboardEntry>(
  entries: readonly T[],
): RankedLeaderboardEntry<T>[] {
  const sorted = [...entries].sort((left, right) => {
    const scoreDifference = right.totalScore - left.totalScore;
    if (scoreDifference !== 0) return scoreDifference;

    const normalizedLeftName = left.participantName.normalize("NFKC");
    const normalizedRightName = right.participantName.normalize("NFKC");
    const collated = leaderboardNameCollator.compare(
      normalizedLeftName,
      normalizedRightName,
    );
    if (collated !== 0) return collated;

    return normalizedLeftName < normalizedRightName
      ? -1
      : normalizedLeftName > normalizedRightName
        ? 1
        : 0;
  });

  let currentRank = 0;
  let previousScore: number | undefined;

  return sorted.map((entry, index) => {
    if (index === 0 || entry.totalScore !== previousScore) {
      currentRank = index + 1;
    }
    previousScore = entry.totalScore;

    return { ...entry, rank: currentRank };
  });
}
