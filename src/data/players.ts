import playerFixture from "./players-2026-27.json";
import type { PREMIER_LEAGUE_2026_27_TEAMS } from "./teams";

export const PREMIER_LEAGUE_2026_27_PLAYER_COUNT = 582;
export const PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT = 582;

export type PlayerTeamSlug =
  (typeof PREMIER_LEAGUE_2026_27_TEAMS)[number]["slug"];

export type PlayerSeed = {
  assetPath: `/player-faces/${string}.png` | null;
  displayName: string;
  externalId: number;
  firstName: string;
  lastName: string | null;
  slug: string;
  sortName: string;
  teamSlug: PlayerTeamSlug;
};

export const PREMIER_LEAGUE_2026_27_PLAYERS =
  playerFixture as readonly PlayerSeed[];

if (
  PREMIER_LEAGUE_2026_27_PLAYERS.length !== PREMIER_LEAGUE_2026_27_PLAYER_COUNT
) {
  throw new Error(
    `The active Premier League player fixture must contain ${PREMIER_LEAGUE_2026_27_PLAYER_COUNT} players.`,
  );
}
