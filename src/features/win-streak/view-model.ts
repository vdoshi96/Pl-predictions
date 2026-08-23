import type { WinStreakTeamSlug } from "./fixtures";

export type WinStreakPublicPick = {
  isHome: boolean;
  matchweek: number;
  opponentTeamSlug: WinStreakTeamSlug;
  teamSlug: WinStreakTeamSlug;
};

export type WinStreakLeaderboardRow = {
  bestStreak: number;
  currentPick: WinStreakPublicPick | null;
  currentStreak: number;
  displayName: string;
  isViewer: boolean;
  rank: number;
};

export type WinStreakFixtureView = {
  awayTeamSlug: WinStreakTeamSlug;
  homeTeamSlug: WinStreakTeamSlug;
  kickoffAt: string;
};

export type WinStreakActiveRoundView = {
  deadlineAt: string;
  fixtures: readonly WinStreakFixtureView[];
  matchweek: number;
  pickOpen: boolean;
};

export type WinStreakHistoryView = {
  isHome: boolean | null;
  matchweek: number;
  opponentTeamSlug: WinStreakTeamSlug | null;
  outcome: "pending" | "win" | "draw" | "loss" | "missed" | "void";
  teamSlug: WinStreakTeamSlug | null;
};

export type WinStreakViewerView = {
  bestStreak: number;
  currentPick: WinStreakPublicPick | null;
  currentStreak: number;
  displayName: string;
  history: readonly WinStreakHistoryView[];
  usedWinningTeamSlugs: readonly WinStreakTeamSlug[];
};

export type WinStreakActionResult = {
  message: string;
  ok: boolean;
};
