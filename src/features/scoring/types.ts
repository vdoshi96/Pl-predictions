export type ScorePoints = 0 | 1 | 3 | 5;
export type ScoreTier = "correct-half" | "exact" | "miss" | "within-three";

export type ScoringPredictionItem = {
  predictedPosition: number;
  teamId: string;
};

export type ScoringStandingsItem = {
  actualPosition: number;
  playedGames?: number | null;
  teamId: string;
};

export type ScoredClub = ScoringPredictionItem & {
  actualPosition: number;
  difference: number;
  points: ScorePoints;
  tier: ScoreTier;
};

export type ScoreSummary = {
  correctHalfCount: number;
  exactCount: number;
  items: ScoredClub[];
  total: number;
  withinThreeCount: number;
  zeroCount: number;
};

export type ScoringState =
  { status: "not-started" } | { status: "scored"; summary: ScoreSummary };

export type RankableLeaderboardEntry = {
  participantName: string;
  totalScore: number;
};

export type RankedLeaderboardEntry<T> = T & { rank: number };
