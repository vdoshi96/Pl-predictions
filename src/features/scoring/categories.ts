export const CATEGORY_RANK_POINT_CAP = 20;

export type RankedMetricItem<T> = T & { rank: number };

export function scoreCategoryRank(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1) {
    throw new RangeError("A category rank must be a positive integer.");
  }

  return Math.max(0, CATEGORY_RANK_POINT_CAP + 1 - rank);
}

export function rankMetricItems<T extends { id: string; metric: number }>(
  items: readonly T[],
  direction: "ascending" | "descending",
): RankedMetricItem<T>[] {
  const sorted = [...items].sort((left, right) => {
    const metricDifference =
      direction === "descending"
        ? right.metric - left.metric
        : left.metric - right.metric;
    return metricDifference || left.id.localeCompare(right.id);
  });
  let previousMetric: number | undefined;
  let currentRank = 0;

  return sorted.map((item, index) => {
    if (index === 0 || item.metric !== previousMetric) currentRank = index + 1;
    previousMetric = item.metric;
    return { ...item, rank: currentRank };
  });
}

export type TeamPredictionForConsensus = Readonly<{
  predictedPosition: number;
  teamId: string;
}>;

export type TeamExpectationIndex = Readonly<{
  actualPosition: number;
  averagePredictedPosition: number;
  overratedIndex: number;
  teamId: string;
  underdogIndex: number;
}>;

export function calculateTeamExpectationIndexes(
  predictions: readonly (readonly TeamPredictionForConsensus[])[],
  actualTable: readonly { actualPosition: number; teamId: string }[],
): TeamExpectationIndex[] {
  if (predictions.length === 0) return [];

  const positionsByTeamId = new Map<string, number[]>();
  for (const prediction of predictions) {
    for (const item of prediction) {
      const positions = positionsByTeamId.get(item.teamId) ?? [];
      positions.push(item.predictedPosition);
      positionsByTeamId.set(item.teamId, positions);
    }
  }

  return actualTable.map((actual) => {
    const positions = positionsByTeamId.get(actual.teamId) ?? [];
    if (positions.length !== predictions.length) {
      throw new Error(
        "Every consensus prediction must contain each standings club once.",
      );
    }

    const averagePredictedPosition =
      positions.reduce((sum, position) => sum + position, 0) / positions.length;
    const underdogIndex = averagePredictedPosition - actual.actualPosition;

    return {
      actualPosition: actual.actualPosition,
      averagePredictedPosition,
      overratedIndex: -underdogIndex,
      teamId: actual.teamId,
      underdogIndex,
    };
  });
}

export function rankTeamExpectationIndexes(
  indexes: readonly TeamExpectationIndex[],
  category: "overrated" | "underdog",
) {
  return rankMetricItems(
    indexes.map((item) => ({
      ...item,
      id: item.teamId,
      metric:
        category === "underdog" ? item.underdogIndex : item.overratedIndex,
    })),
    "descending",
  );
}
