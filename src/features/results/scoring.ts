import type { PredictionCategory } from "@/features/predictions/categories";
import { scoreCategoryRank } from "@/features/scoring/categories";

export type ResolvedSpotlightResult = Readonly<{
  accuracyPoints: number;
  metricLabel: string;
  resultRank: number;
  resultStatus: "outside-range" | "ranked";
}>;

export function formatSpotlightMetric(
  category: PredictionCategory,
  metricValue: number,
): string {
  switch (category) {
    case "top_scorer":
      return `${metricValue} ${metricValue === 1 ? "goal" : "goals"}`;
    case "top_assister":
      return `${metricValue} ${metricValue === 1 ? "assist" : "assists"}`;
    case "most_clean_sheets":
      return `${metricValue} clean ${metricValue === 1 ? "sheet" : "sheets"}`;
    case "underdog_player":
    case "overrated_player":
      return `Rating ${metricValue.toFixed(3)}`;
    default:
      return "";
  }
}

export function resolveSpotlightResult({
  activeBracketCount,
  category,
  coveredThroughRank,
  metricValue,
  outcomeRank,
}: {
  activeBracketCount: number;
  category: PredictionCategory;
  coveredThroughRank: number;
  metricValue?: number;
  outcomeRank?: number;
}): ResolvedSpotlightResult | null {
  if (outcomeRank !== undefined && metricValue !== undefined) {
    return {
      accuracyPoints: scoreCategoryRank(outcomeRank, activeBracketCount),
      metricLabel: formatSpotlightMetric(category, metricValue),
      resultRank: outcomeRank,
      resultStatus: "ranked",
    };
  }

  if (coveredThroughRank < activeBracketCount) return null;

  return {
    accuracyPoints: 0,
    metricLabel:
      category === "overrated_player"
        ? `Outside lowest ${coveredThroughRank}`
        : `Outside top ${coveredThroughRank}`,
    resultRank: coveredThroughRank + 1,
    resultStatus: "outside-range",
  };
}
