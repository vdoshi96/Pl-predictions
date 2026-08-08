import { PREMIER_LEAGUE_MATCH_COUNT, PREMIER_LEAGUE_TEAM_COUNT } from "@/data";

type PlayedGamesRecord = Readonly<{
  playedGames: number | null;
}>;

export function isFinalStandingsCandidate(
  items: readonly PlayedGamesRecord[],
): boolean {
  return (
    items.length === PREMIER_LEAGUE_TEAM_COUNT &&
    items.every((item) => item.playedGames === PREMIER_LEAGUE_MATCH_COUNT)
  );
}
