import type { ScorePoints, ScoreTier } from "@/features/scoring";

export const SCORE_TIER_LABELS: Record<ScoreTier, string> = {
  "correct-half": "Correct half",
  exact: "Exact",
  miss: "No points",
  "within-three": "Within 3",
};

export function ScorePill({
  points,
  tier,
}: {
  points: ScorePoints;
  tier: ScoreTier;
}) {
  return (
    <span className="score-pill" data-tier={tier}>
      {points} · {SCORE_TIER_LABELS[tier]}
    </span>
  );
}
