import {
  PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG,
  PREMIER_LEAGUE_2026_27_TEAMS,
  type TeamSeed,
} from "@/data/teams";

export type WinStreakTeamSlug =
  (typeof PREMIER_LEAGUE_2026_27_TEAMS)[number]["slug"];

export type WinStreakRoundId = "mw20" | "mw21" | "mw22" | "mw23";
export type WinStreakFixtureId = `${WinStreakRoundId}-${string}`;

export type WinStreakWorkshopFixture = {
  readonly awayTeamSlug: WinStreakTeamSlug;
  readonly homeTeamSlug: WinStreakTeamSlug;
  readonly id: WinStreakFixtureId;
};

export type WinStreakWorkshopRound = {
  readonly dateIso: `${number}-${number}-${number}`;
  readonly fixtures: readonly WinStreakWorkshopFixture[];
  readonly id: WinStreakRoundId;
  readonly matchweek: 20 | 21 | 22 | 23;
};

export const WIN_STREAK_WORKSHOP_SOURCE = {
  fixtureListUrl:
    "https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/",
  lastFanStandingUrl:
    "https://www.premierleague.com/en/news/4685390/premier-league-last-fan-standing-202627",
  verifiedOn: "2026-08-23",
} as const;

export const WIN_STREAK_WORKSHOP_ROUNDS = [
  {
    dateIso: "2027-01-06",
    fixtures: [
      {
        awayTeamSlug: "brentford",
        homeTeamSlug: "arsenal",
        id: "mw20-arsenal-brentford",
      },
      {
        awayTeamSlug: "afc-bournemouth",
        homeTeamSlug: "brighton-and-hove-albion",
        id: "mw20-brighton-and-hove-albion-afc-bournemouth",
      },
      {
        awayTeamSlug: "chelsea",
        homeTeamSlug: "crystal-palace",
        id: "mw20-crystal-palace-chelsea",
      },
      {
        awayTeamSlug: "aston-villa",
        homeTeamSlug: "everton",
        id: "mw20-everton-aston-villa",
      },
      {
        awayTeamSlug: "tottenham-hotspur",
        homeTeamSlug: "fulham",
        id: "mw20-fulham-tottenham-hotspur",
      },
      {
        awayTeamSlug: "coventry-city",
        homeTeamSlug: "ipswich-town",
        id: "mw20-ipswich-town-coventry-city",
      },
      {
        awayTeamSlug: "manchester-city",
        homeTeamSlug: "leeds-united",
        id: "mw20-leeds-united-manchester-city",
      },
      {
        awayTeamSlug: "newcastle-united",
        homeTeamSlug: "manchester-united",
        id: "mw20-manchester-united-newcastle-united",
      },
      {
        awayTeamSlug: "hull-city",
        homeTeamSlug: "nottingham-forest",
        id: "mw20-nottingham-forest-hull-city",
      },
      {
        awayTeamSlug: "liverpool",
        homeTeamSlug: "sunderland",
        id: "mw20-sunderland-liverpool",
      },
    ],
    id: "mw20",
    matchweek: 20,
  },
  {
    dateIso: "2027-01-16",
    fixtures: [
      {
        awayTeamSlug: "ipswich-town",
        homeTeamSlug: "afc-bournemouth",
        id: "mw21-afc-bournemouth-ipswich-town",
      },
      {
        awayTeamSlug: "manchester-united",
        homeTeamSlug: "aston-villa",
        id: "mw21-aston-villa-manchester-united",
      },
      {
        awayTeamSlug: "brighton-and-hove-albion",
        homeTeamSlug: "brentford",
        id: "mw21-brentford-brighton-and-hove-albion",
      },
      {
        awayTeamSlug: "sunderland",
        homeTeamSlug: "chelsea",
        id: "mw21-chelsea-sunderland",
      },
      {
        awayTeamSlug: "everton",
        homeTeamSlug: "coventry-city",
        id: "mw21-coventry-city-everton",
      },
      {
        awayTeamSlug: "arsenal",
        homeTeamSlug: "hull-city",
        id: "mw21-hull-city-arsenal",
      },
      {
        awayTeamSlug: "crystal-palace",
        homeTeamSlug: "liverpool",
        id: "mw21-liverpool-crystal-palace",
      },
      {
        awayTeamSlug: "nottingham-forest",
        homeTeamSlug: "manchester-city",
        id: "mw21-manchester-city-nottingham-forest",
      },
      {
        awayTeamSlug: "fulham",
        homeTeamSlug: "newcastle-united",
        id: "mw21-newcastle-united-fulham",
      },
      {
        awayTeamSlug: "leeds-united",
        homeTeamSlug: "tottenham-hotspur",
        id: "mw21-tottenham-hotspur-leeds-united",
      },
    ],
    id: "mw21",
    matchweek: 21,
  },
  {
    dateIso: "2027-01-23",
    fixtures: [
      {
        awayTeamSlug: "newcastle-united",
        homeTeamSlug: "arsenal",
        id: "mw22-arsenal-newcastle-united",
      },
      {
        awayTeamSlug: "manchester-city",
        homeTeamSlug: "brighton-and-hove-albion",
        id: "mw22-brighton-and-hove-albion-manchester-city",
      },
      {
        awayTeamSlug: "tottenham-hotspur",
        homeTeamSlug: "crystal-palace",
        id: "mw22-crystal-palace-tottenham-hotspur",
      },
      {
        awayTeamSlug: "brentford",
        homeTeamSlug: "everton",
        id: "mw22-everton-brentford",
      },
      {
        awayTeamSlug: "aston-villa",
        homeTeamSlug: "fulham",
        id: "mw22-fulham-aston-villa",
      },
      {
        awayTeamSlug: "hull-city",
        homeTeamSlug: "ipswich-town",
        id: "mw22-ipswich-town-hull-city",
      },
      {
        awayTeamSlug: "chelsea",
        homeTeamSlug: "leeds-united",
        id: "mw22-leeds-united-chelsea",
      },
      {
        awayTeamSlug: "liverpool",
        homeTeamSlug: "manchester-united",
        id: "mw22-manchester-united-liverpool",
      },
      {
        awayTeamSlug: "afc-bournemouth",
        homeTeamSlug: "nottingham-forest",
        id: "mw22-nottingham-forest-afc-bournemouth",
      },
      {
        awayTeamSlug: "coventry-city",
        homeTeamSlug: "sunderland",
        id: "mw22-sunderland-coventry-city",
      },
    ],
    id: "mw22",
    matchweek: 22,
  },
  {
    dateIso: "2027-01-30",
    fixtures: [
      {
        awayTeamSlug: "fulham",
        homeTeamSlug: "afc-bournemouth",
        id: "mw23-afc-bournemouth-fulham",
      },
      {
        awayTeamSlug: "ipswich-town",
        homeTeamSlug: "aston-villa",
        id: "mw23-aston-villa-ipswich-town",
      },
      {
        awayTeamSlug: "manchester-united",
        homeTeamSlug: "brentford",
        id: "mw23-brentford-manchester-united",
      },
      {
        awayTeamSlug: "nottingham-forest",
        homeTeamSlug: "chelsea",
        id: "mw23-chelsea-nottingham-forest",
      },
      {
        awayTeamSlug: "leeds-united",
        homeTeamSlug: "coventry-city",
        id: "mw23-coventry-city-leeds-united",
      },
      {
        awayTeamSlug: "crystal-palace",
        homeTeamSlug: "hull-city",
        id: "mw23-hull-city-crystal-palace",
      },
      {
        awayTeamSlug: "everton",
        homeTeamSlug: "liverpool",
        id: "mw23-liverpool-everton",
      },
      {
        awayTeamSlug: "arsenal",
        homeTeamSlug: "manchester-city",
        id: "mw23-manchester-city-arsenal",
      },
      {
        awayTeamSlug: "brighton-and-hove-albion",
        homeTeamSlug: "newcastle-united",
        id: "mw23-newcastle-united-brighton-and-hove-albion",
      },
      {
        awayTeamSlug: "sunderland",
        homeTeamSlug: "tottenham-hotspur",
        id: "mw23-tottenham-hotspur-sunderland",
      },
    ],
    id: "mw23",
    matchweek: 23,
  },
] as const satisfies readonly WinStreakWorkshopRound[];

export const WIN_STREAK_WORKSHOP_ROUND_IDS = WIN_STREAK_WORKSHOP_ROUNDS.map(
  (round) => round.id,
);

const ROUND_BY_ID = new Map<WinStreakRoundId, WinStreakWorkshopRound>(
  WIN_STREAK_WORKSHOP_ROUNDS.map((round) => [round.id, round]),
);

const FIXTURE_BY_ID = new Map<string, WinStreakWorkshopFixture>(
  WIN_STREAK_WORKSHOP_ROUNDS.flatMap((round) =>
    round.fixtures.map((fixture) => [fixture.id, fixture] as const),
  ),
);

export function getWinStreakRound(
  roundId: WinStreakRoundId,
): WinStreakWorkshopRound {
  return ROUND_BY_ID.get(roundId)!;
}

export function getWinStreakFixture(
  roundId: WinStreakRoundId,
  fixtureId: string,
): WinStreakWorkshopFixture | null {
  const fixture = FIXTURE_BY_ID.get(fixtureId);
  return fixture && fixture.id.startsWith(`${roundId}-`) ? fixture : null;
}

export function getWinStreakFixtureForTeam(
  roundId: WinStreakRoundId,
  teamSlug: WinStreakTeamSlug,
): WinStreakWorkshopFixture {
  return getWinStreakRound(roundId).fixtures.find(
    (fixture) =>
      fixture.homeTeamSlug === teamSlug || fixture.awayTeamSlug === teamSlug,
  )!;
}

export function getWinStreakTeam(teamSlug: WinStreakTeamSlug): TeamSeed {
  return PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG.get(teamSlug)!;
}
