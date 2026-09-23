import type { WinStreakTeamSlug } from "./fixtures";
import type { WinStreakHistoryView } from "./view-model";

export function usedClubReason(
  history: readonly WinStreakHistoryView[],
  teamSlug: WinStreakTeamSlug,
): string {
  const latestWin = history
    .filter((entry) => entry.outcome === "win" && entry.teamSlug === teamSlug)
    .sort((left, right) => right.matchweek - left.matchweek)[0];
  return latestWin
    ? `Won in MW${latestWin.matchweek} · unlocks when your streak resets`
    : "Used in this streak";
}
