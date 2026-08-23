import canonicalFixtureSnapshot from "@/data/win-streak-fixtures.json";
import {
  PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG,
  PREMIER_LEAGUE_2026_27_TEAMS,
  type TeamSeed,
} from "@/data/teams";

export type WinStreakTeamSlug =
  (typeof PREMIER_LEAGUE_2026_27_TEAMS)[number]["slug"];

export const WIN_STREAK_MATCHWEEKS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
] as const;

export type WinStreakMatchweek = (typeof WIN_STREAK_MATCHWEEKS)[number];
export type WinStreakRoundId = `mw${WinStreakMatchweek}`;
export type WinStreakFixtureId = `2026-27-mw${string}-${string}`;
export type WinStreakFixtureTimeBasis =
  | "explicit"
  | "final-matchweek-default"
  | "midweek-default"
  | "weekend-default";

export type WinStreakFixture = {
  readonly awayTeamSlug: WinStreakTeamSlug;
  readonly homeTeamSlug: WinStreakTeamSlug;
  readonly id: WinStreakFixtureId;
  readonly kickoffAt: string;
  readonly localDate: string;
  readonly localTime: string;
  readonly matchweek: WinStreakMatchweek;
  readonly timeBasis: WinStreakFixtureTimeBasis;
};

export type WinStreakRound = {
  readonly dateIso: string;
  readonly endsAt: string;
  readonly fixtures: readonly WinStreakFixture[];
  readonly id: WinStreakRoundId;
  readonly matchweek: WinStreakMatchweek;
  readonly startsAt: string;
};

export type WinStreakSourceMetadata = {
  readonly checkedAt: string;
  readonly finalMatchweekTimingUrl: string;
  readonly fixtureListUrl: string;
  readonly normalizedFixtureSha256: string;
  readonly subjectToChange: true;
  readonly timeZone: "Europe/London";
};

const TEAM_SLUG_SET = new Set<string>(
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug),
);
const MATCHWEEK_SET = new Set<number>(WIN_STREAK_MATCHWEEKS);
const TIME_BASIS_SET = new Set<string>([
  "explicit",
  "final-matchweek-default",
  "midweek-default",
  "weekend-default",
]);

function fixtureDataError(message: string): never {
  throw new Error(`Invalid canonical Win Streak fixtures: ${message}`);
}

export function isWinStreakTeamSlug(value: string): value is WinStreakTeamSlug {
  return TEAM_SLUG_SET.has(value);
}

export function isWinStreakMatchweek(
  value: number,
): value is WinStreakMatchweek {
  return MATCHWEEK_SET.has(value);
}

function adaptFixture(
  rawFixture: (typeof canonicalFixtureSnapshot.rounds)[number]["fixtures"][number],
  matchweek: WinStreakMatchweek,
): WinStreakFixture {
  if (
    rawFixture.matchweek !== matchweek ||
    !isWinStreakTeamSlug(rawFixture.homeTeamSlug) ||
    !isWinStreakTeamSlug(rawFixture.awayTeamSlug) ||
    rawFixture.homeTeamSlug === rawFixture.awayTeamSlug ||
    !TIME_BASIS_SET.has(rawFixture.timeBasis)
  ) {
    fixtureDataError(`Matchweek ${matchweek} contains an invalid fixture.`);
  }

  const expectedId =
    `2026-27-mw${String(matchweek).padStart(2, "0")}-${rawFixture.homeTeamSlug}-${rawFixture.awayTeamSlug}` as WinStreakFixtureId;
  if (rawFixture.id !== expectedId) {
    fixtureDataError(`fixture ${rawFixture.id} has a noncanonical ID.`);
  }
  const kickoff = new Date(rawFixture.kickoffAt);
  if (
    Number.isNaN(kickoff.valueOf()) ||
    kickoff.toISOString() !== rawFixture.kickoffAt
  ) {
    fixtureDataError(`fixture ${rawFixture.id} has an invalid kickoff.`);
  }

  return {
    awayTeamSlug: rawFixture.awayTeamSlug,
    homeTeamSlug: rawFixture.homeTeamSlug,
    id: expectedId,
    kickoffAt: rawFixture.kickoffAt,
    localDate: rawFixture.localDate,
    localTime: rawFixture.localTime,
    matchweek,
    timeBasis: rawFixture.timeBasis as WinStreakFixtureTimeBasis,
  };
}

function adaptRound(
  rawRound: (typeof canonicalFixtureSnapshot.rounds)[number],
): WinStreakRound {
  const { matchweek } = rawRound;
  if (!isWinStreakMatchweek(matchweek)) {
    fixtureDataError(`unsupported Matchweek ${matchweek}.`);
  }
  const fixtures = rawRound.fixtures.map((fixture) =>
    adaptFixture(fixture, matchweek),
  );
  if (fixtures.length !== 10) {
    fixtureDataError(`Matchweek ${matchweek} must contain 10 fixtures.`);
  }
  const teamSlugs = new Set(
    fixtures.flatMap((fixture) => [fixture.homeTeamSlug, fixture.awayTeamSlug]),
  );
  if (teamSlugs.size !== PREMIER_LEAGUE_2026_27_TEAMS.length) {
    fixtureDataError(`Matchweek ${matchweek} must contain every club once.`);
  }

  const kickoffInstants = fixtures.map((fixture) => fixture.kickoffAt).sort();
  const localDates = fixtures.map((fixture) => fixture.localDate).sort();
  const startsAt = kickoffInstants[0];
  const endsAt = kickoffInstants.at(-1);
  const dateIso = localDates[0];
  if (!startsAt || !endsAt || !dateIso) {
    fixtureDataError(`Matchweek ${matchweek} has no fixtures.`);
  }

  return {
    dateIso,
    endsAt,
    fixtures,
    id: `mw${matchweek}`,
    matchweek,
    startsAt,
  };
}

export const WIN_STREAK_SOURCE: WinStreakSourceMetadata = {
  checkedAt: canonicalFixtureSnapshot.source.checkedAt,
  finalMatchweekTimingUrl:
    canonicalFixtureSnapshot.source.finalMatchweekTimingUrl,
  fixtureListUrl: canonicalFixtureSnapshot.source.fixtureListUrl,
  normalizedFixtureSha256:
    canonicalFixtureSnapshot.source.normalizedFixtureSha256,
  subjectToChange: true,
  timeZone: "Europe/London",
};

export const WIN_STREAK_ROUNDS = canonicalFixtureSnapshot.rounds.map(
  adaptRound,
) as readonly WinStreakRound[];

if (WIN_STREAK_ROUNDS.length !== WIN_STREAK_MATCHWEEKS.length) {
  fixtureDataError(
    `expected ${WIN_STREAK_MATCHWEEKS.length} rounds, received ${WIN_STREAK_ROUNDS.length}.`,
  );
}

const ROUND_BY_MATCHWEEK = new Map<WinStreakMatchweek, WinStreakRound>(
  WIN_STREAK_ROUNDS.map((round) => [round.matchweek, round]),
);
const ROUND_BY_ID = new Map<WinStreakRoundId, WinStreakRound>(
  WIN_STREAK_ROUNDS.map((round) => [round.id, round]),
);
const FIXTURE_BY_ID = new Map<WinStreakFixtureId, WinStreakFixture>(
  WIN_STREAK_ROUNDS.flatMap((round) =>
    round.fixtures.map((fixture) => [fixture.id, fixture] as const),
  ),
);

export function getWinStreakRoundByMatchweek(
  matchweek: WinStreakMatchweek,
): WinStreakRound | null {
  return ROUND_BY_MATCHWEEK.get(matchweek) ?? null;
}

export function getWinStreakRound(roundId: WinStreakRoundId): WinStreakRound {
  const round = ROUND_BY_ID.get(roundId);
  if (!round) {
    throw new Error(`Unknown Win Streak round ${roundId}.`);
  }
  return round;
}

export function getWinStreakFixtureById(
  fixtureId: WinStreakFixtureId | string,
): WinStreakFixture | null {
  return FIXTURE_BY_ID.get(fixtureId as WinStreakFixtureId) ?? null;
}

export function getWinStreakFixture(
  roundId: WinStreakRoundId,
  fixtureId: WinStreakFixtureId | string,
): WinStreakFixture | null {
  const fixture = getWinStreakFixtureById(fixtureId);
  return fixture?.matchweek === getWinStreakRound(roundId).matchweek
    ? fixture
    : null;
}

export function getWinStreakFixtureForTeam(
  round: WinStreakMatchweek | WinStreakRoundId,
  teamSlug: WinStreakTeamSlug,
): WinStreakFixture {
  const resolvedRound =
    typeof round === "number"
      ? getWinStreakRoundByMatchweek(round)
      : getWinStreakRound(round);
  const fixture = resolvedRound?.fixtures.find(
    (candidate) =>
      candidate.homeTeamSlug === teamSlug ||
      candidate.awayTeamSlug === teamSlug,
  );
  if (!fixture) {
    throw new Error(`No Win Streak fixture found for ${teamSlug} in ${round}.`);
  }
  return fixture;
}

export function getWinStreakTeam(teamSlug: WinStreakTeamSlug): TeamSeed {
  const team = PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG.get(teamSlug);
  if (!team) {
    throw new Error(`Unknown Win Streak team ${teamSlug}.`);
  }
  return team;
}

// Keep the localhost workshop adapter available until its browser-local state
// is removed. Its four rounds now derive from the same canonical schedule.
export type WinStreakWorkshopFixture = WinStreakFixture;
export type WinStreakWorkshopRound = WinStreakRound;
export const WIN_STREAK_WORKSHOP_ROUNDS = WIN_STREAK_ROUNDS.filter(
  (round) => round.matchweek >= 20 && round.matchweek <= 23,
);
export const WIN_STREAK_WORKSHOP_ROUND_IDS = WIN_STREAK_WORKSHOP_ROUNDS.map(
  (round) => round.id,
);
export const WIN_STREAK_WORKSHOP_SOURCE = {
  fixtureListUrl:
    "https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/",
  lastFanStandingUrl:
    "https://www.premierleague.com/en/news/4685390/premier-league-last-fan-standing-202627",
  verifiedOn: WIN_STREAK_SOURCE.checkedAt,
} as const;
