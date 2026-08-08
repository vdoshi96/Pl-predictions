import { PREMIER_LEAGUE_TEAM_COUNT } from "./season";

export type TeamSeed = {
  assetPath: `/team-marks/${string}.svg`;
  displayName: string;
  externalId: number;
  shortName: string;
  slug: string;
  sortName: string;
};

/**
 * Official 2026/27 Premier League membership, in presentation sort order.
 * External IDs are FotMob's stable team identifiers and are mapping metadata;
 * the deployed application does not call FotMob.
 */
export const PREMIER_LEAGUE_2026_27_TEAMS = [
  {
    assetPath: "/team-marks/arsenal.svg",
    displayName: "Arsenal",
    externalId: 9825,
    shortName: "Arsenal",
    slug: "arsenal",
    sortName: "Arsenal",
  },
  {
    assetPath: "/team-marks/aston-villa.svg",
    displayName: "Aston Villa",
    externalId: 10252,
    shortName: "Aston Villa",
    slug: "aston-villa",
    sortName: "Aston Villa",
  },
  {
    assetPath: "/team-marks/afc-bournemouth.svg",
    displayName: "AFC Bournemouth",
    externalId: 8678,
    shortName: "Bournemouth",
    slug: "afc-bournemouth",
    sortName: "Bournemouth",
  },
  {
    assetPath: "/team-marks/brentford.svg",
    displayName: "Brentford",
    externalId: 9937,
    shortName: "Brentford",
    slug: "brentford",
    sortName: "Brentford",
  },
  {
    assetPath: "/team-marks/brighton-and-hove-albion.svg",
    displayName: "Brighton & Hove Albion",
    externalId: 10204,
    shortName: "Brighton",
    slug: "brighton-and-hove-albion",
    sortName: "Brighton & Hove Albion",
  },
  {
    assetPath: "/team-marks/chelsea.svg",
    displayName: "Chelsea",
    externalId: 8455,
    shortName: "Chelsea",
    slug: "chelsea",
    sortName: "Chelsea",
  },
  {
    assetPath: "/team-marks/coventry-city.svg",
    displayName: "Coventry City",
    externalId: 8669,
    shortName: "Coventry",
    slug: "coventry-city",
    sortName: "Coventry City",
  },
  {
    assetPath: "/team-marks/crystal-palace.svg",
    displayName: "Crystal Palace",
    externalId: 9826,
    shortName: "Crystal Palace",
    slug: "crystal-palace",
    sortName: "Crystal Palace",
  },
  {
    assetPath: "/team-marks/everton.svg",
    displayName: "Everton",
    externalId: 8668,
    shortName: "Everton",
    slug: "everton",
    sortName: "Everton",
  },
  {
    assetPath: "/team-marks/fulham.svg",
    displayName: "Fulham",
    externalId: 9879,
    shortName: "Fulham",
    slug: "fulham",
    sortName: "Fulham",
  },
  {
    assetPath: "/team-marks/hull-city.svg",
    displayName: "Hull City",
    externalId: 8667,
    shortName: "Hull",
    slug: "hull-city",
    sortName: "Hull City",
  },
  {
    assetPath: "/team-marks/ipswich-town.svg",
    displayName: "Ipswich Town",
    externalId: 9902,
    shortName: "Ipswich",
    slug: "ipswich-town",
    sortName: "Ipswich Town",
  },
  {
    assetPath: "/team-marks/leeds-united.svg",
    displayName: "Leeds United",
    externalId: 8463,
    shortName: "Leeds",
    slug: "leeds-united",
    sortName: "Leeds United",
  },
  {
    assetPath: "/team-marks/liverpool.svg",
    displayName: "Liverpool",
    externalId: 8650,
    shortName: "Liverpool",
    slug: "liverpool",
    sortName: "Liverpool",
  },
  {
    assetPath: "/team-marks/manchester-city.svg",
    displayName: "Manchester City",
    externalId: 8456,
    shortName: "Man City",
    slug: "manchester-city",
    sortName: "Manchester City",
  },
  {
    assetPath: "/team-marks/manchester-united.svg",
    displayName: "Manchester United",
    externalId: 10260,
    shortName: "Man United",
    slug: "manchester-united",
    sortName: "Manchester United",
  },
  {
    assetPath: "/team-marks/newcastle-united.svg",
    displayName: "Newcastle United",
    externalId: 10261,
    shortName: "Newcastle",
    slug: "newcastle-united",
    sortName: "Newcastle United",
  },
  {
    assetPath: "/team-marks/nottingham-forest.svg",
    displayName: "Nottingham Forest",
    externalId: 10203,
    shortName: "Nott'm Forest",
    slug: "nottingham-forest",
    sortName: "Nottingham Forest",
  },
  {
    assetPath: "/team-marks/sunderland.svg",
    displayName: "Sunderland",
    externalId: 8472,
    shortName: "Sunderland",
    slug: "sunderland",
    sortName: "Sunderland",
  },
  {
    assetPath: "/team-marks/tottenham-hotspur.svg",
    displayName: "Tottenham Hotspur",
    externalId: 8586,
    shortName: "Tottenham",
    slug: "tottenham-hotspur",
    sortName: "Tottenham Hotspur",
  },
] as const satisfies readonly TeamSeed[];

if (PREMIER_LEAGUE_2026_27_TEAMS.length !== PREMIER_LEAGUE_TEAM_COUNT) {
  throw new Error(
    "The active Premier League team fixture must contain 20 teams.",
  );
}

export const PREMIER_LEAGUE_2026_27_TEAM_SLUGS =
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug);

export const PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG = new Map(
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => [team.slug, team] as const),
);
