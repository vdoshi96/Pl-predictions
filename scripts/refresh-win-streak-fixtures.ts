import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "../src/data/teams";

export const OFFICIAL_FIXTURE_LIST_URL =
  "https://www.premierleague.com/en/news/4675097";
export const OFFICIAL_FINAL_MATCHWEEK_TIMING_URL =
  "https://www.premierleague.com/en/news/4675508/premier-league-fixture-schedule-released-for-season-202627";
export const WIN_STREAK_FIXTURE_PATH = resolve(
  process.cwd(),
  "src/data/win-streak-fixtures.json",
);

const SCHEMA_VERSION = 1;
const SEASON = "2026/27";
const TIME_ZONE = "Europe/London";
const FULL_SEASON_FIXTURE_COUNT = 380;
const FIRST_RETAINED_MATCHWEEK = 2;
const FINAL_MATCHWEEK = 38;
const FIXTURES_PER_MATCHWEEK = 10;

const KICKOFF_DEFAULTS = {
  finalMatchweekLocal: "16:00",
  midweekLocal: "20:00",
  weekendAndBankHolidayLocal: "15:00",
} as const;

type TeamSlug = (typeof PREMIER_LEAGUE_2026_27_TEAMS)[number]["slug"];
type FixtureTimeBasis =
  | "explicit"
  | "final-matchweek-default"
  | "midweek-default"
  | "weekend-default";

export type ParsedOfficialFixture = {
  awayTeamSlug: TeamSlug;
  explicitTime: boolean;
  homeTeamSlug: TeamSlug;
  localDate: string;
  localTime: string;
  sourceIndex: number;
};

export type CanonicalWinStreakFixture = {
  awayTeamSlug: TeamSlug;
  homeTeamSlug: TeamSlug;
  id: string;
  kickoffAt: string;
  localDate: string;
  localTime: string;
  matchweek: number;
  timeBasis: FixtureTimeBasis;
};

export type CanonicalWinStreakFixtureSnapshot = {
  competition: "Premier League";
  kickoffDefaults: typeof KICKOFF_DEFAULTS;
  rounds: readonly {
    fixtures: readonly CanonicalWinStreakFixture[];
    matchweek: number;
  }[];
  schemaVersion: typeof SCHEMA_VERSION;
  season: typeof SEASON;
  source: {
    checkedAt: string;
    finalMatchweekTimingUrl: typeof OFFICIAL_FINAL_MATCHWEEK_TIMING_URL;
    fixtureListUrl: typeof OFFICIAL_FIXTURE_LIST_URL;
    normalizedFixtureSha256: string;
    subjectToChange: true;
  };
  timeZone: typeof TIME_ZONE;
};

type RefreshMode = "apply" | "check";

type RefreshDependencies = {
  checkedAt?: string;
  fetchSourceHtml?: () => Promise<string>;
  mode: RefreshMode;
  readCanonical?: () => Promise<string>;
  writeCanonical?: (serializedSnapshot: string) => Promise<void>;
};

type RefreshResult = {
  changed: boolean;
  fixtureCount: number;
  matchweekCount: number;
  sourceCheckedAt: string;
};

const TEAM_SLUG_BY_OFFICIAL_NAME = new Map<string, TeamSlug>(
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => [team.displayName, team.slug]),
);

// The official article abbreviates Newcastle United once. Normalize that
// published alias before validating the complete season schedule.
TEAM_SLUG_BY_OFFICIAL_NAME.set("Newcastle", "newcastle-united");

const TEAM_SLUG_SET = new Set<TeamSlug>(
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug),
);

const MONTH_NUMBER_BY_NAME = new Map<string, number>([
  ["January", 1],
  ["February", 2],
  ["March", 3],
  ["April", 4],
  ["May", 5],
  ["June", 6],
  ["July", 7],
  ["August", 8],
  ["September", 9],
  ["October", 10],
  ["November", 11],
  ["December", 12],
] as const);

const DATE_HEADING_PATTERN =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)(?: (\d{4}))?$/u;
const EXPLICIT_TIME_PATTERN = /^(\d{2}:\d{2})(?: (?:BST|GMT))?\s+/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

function fail(message: string): never {
  throw new Error(`Win Streak fixture refresh failed: ${message}`);
}

function decodeHtmlText(value: string): string {
  const namedEntities: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/gu, (_, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replace(/&#x([\da-f]+);/giu, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replace(
      /&([a-z]+);/giu,
      (entity, name: string) =>
        namedEntities[name.toLocaleLowerCase("en-GB")] ?? entity,
    )
    .replace(/\u00a0/gu, " ");
}

function articleParagraphLines(html: string): readonly string[][] {
  const article =
    html.match(
      /<article\b[^>]*data-article-id=["']4675097["'][^>]*>([\s\S]*?)<\/article>/iu,
    )?.[1] ?? html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/iu)?.[1];

  if (!article) {
    fail("the official response does not contain the fixture article.");
  }

  return [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)].map((match) =>
    decodeHtmlText(
      (match[1] ?? "")
        .replace(/<br\s*\/?\s*>/giu, "\n")
        .replace(/<[^>]+>/gu, ""),
    )
      .split("\n")
      .map((line) => line.trim().replace(/\s+/gu, " "))
      .filter(Boolean),
  );
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isMidweekDate(localDate: string): boolean {
  const weekday = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return weekday >= 2 && weekday <= 4;
}

function parseFixtureLine(
  sourceLine: string,
  localDate: string,
  sourceIndex: number,
): ParsedOfficialFixture | null {
  let line = sourceLine;
  const explicitTimeMatch = line.match(EXPLICIT_TIME_PATTERN);
  const explicitTime = explicitTimeMatch?.[1] ?? null;
  if (explicitTimeMatch) {
    line = line.slice(explicitTimeMatch[0].length);
  }

  line = line
    .replace(/\s+\([^)]*\)\**$/u, "")
    .replace(/\**$/u, "")
    .trim();

  const separatorIndex = line.indexOf(" v ");
  if (separatorIndex < 0) {
    return null;
  }

  const homeName = line.slice(0, separatorIndex);
  const awayName = line.slice(separatorIndex + 3);
  const homeTeamSlug = TEAM_SLUG_BY_OFFICIAL_NAME.get(homeName);
  const awayTeamSlug = TEAM_SLUG_BY_OFFICIAL_NAME.get(awayName);
  if (!homeTeamSlug || !awayTeamSlug) {
    return null;
  }

  const localTime =
    explicitTime ??
    (isMidweekDate(localDate)
      ? KICKOFF_DEFAULTS.midweekLocal
      : KICKOFF_DEFAULTS.weekendAndBankHolidayLocal);

  return {
    awayTeamSlug,
    explicitTime: explicitTime !== null,
    homeTeamSlug,
    localDate,
    localTime,
    sourceIndex,
  };
}

export function parseOfficialFixtureArticle(
  html: string,
): readonly ParsedOfficialFixture[] {
  const fixtures: ParsedOfficialFixture[] = [];
  let activeDate: string | null = null;
  let activeYear = 2026;

  for (const lines of articleParagraphLines(html)) {
    for (const line of lines) {
      const dateMatch = line.match(DATE_HEADING_PATTERN);
      if (dateMatch) {
        const [, , dayValue, monthName, yearValue] = dateMatch;
        const month = monthName
          ? MONTH_NUMBER_BY_NAME.get(monthName)
          : undefined;
        if (!dayValue || !month) {
          fail(`cannot parse official date heading ${line}.`);
        }
        if (yearValue) {
          activeYear = Number(yearValue);
        }
        activeDate = toIsoDate(activeYear, month, Number(dayValue));
        continue;
      }

      if (!activeDate) {
        continue;
      }
      const fixture = parseFixtureLine(line, activeDate, fixtures.length);
      if (fixture) {
        fixtures.push(fixture);
      }
    }
  }

  return fixtures;
}

function localDateTimePartsAtUtc(utcMilliseconds: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(utcMilliseconds));
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    month: Number(values.get("month")),
    second: Number(values.get("second")),
    year: Number(values.get("year")),
  };
}

export function localLondonKickoffToUtc(
  localDate: string,
  localTime: string,
): string {
  if (
    !ISO_DATE_PATTERN.test(localDate) ||
    !LOCAL_TIME_PATTERN.test(localTime)
  ) {
    fail(`invalid UK local kickoff ${localDate} ${localTime}.`);
  }

  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    fail(`invalid UK local kickoff ${localDate} ${localTime}.`);
  }

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = localDateTimePartsAtUtc(localAsUtc);
  const firstOffset =
    Date.UTC(
      firstPass.year,
      firstPass.month - 1,
      firstPass.day,
      firstPass.hour,
      firstPass.minute,
      firstPass.second,
    ) - localAsUtc;
  const resolved = localAsUtc - firstOffset;
  const resolvedParts = localDateTimePartsAtUtc(resolved);

  if (
    resolvedParts.year !== year ||
    resolvedParts.month !== month ||
    resolvedParts.day !== day ||
    resolvedParts.hour !== hour ||
    resolvedParts.minute !== minute
  ) {
    fail(`cannot resolve Europe/London kickoff ${localDate} ${localTime}.`);
  }

  return new Date(resolved).toISOString();
}

export function validateFullSeasonFixtures(
  fixtures: readonly ParsedOfficialFixture[],
): void {
  if (fixtures.length !== FULL_SEASON_FIXTURE_COUNT) {
    fail(
      `expected ${FULL_SEASON_FIXTURE_COUNT} official fixtures, received ${fixtures.length}.`,
    );
  }

  const directedPairings = new Set<string>();
  const unorderedPairings = new Map<
    string,
    { firstHome: TeamSlug; firstAway: TeamSlug; count: number }
  >();

  for (let roundIndex = 0; roundIndex < FINAL_MATCHWEEK; roundIndex += 1) {
    const roundFixtures = fixtures.slice(
      roundIndex * FIXTURES_PER_MATCHWEEK,
      (roundIndex + 1) * FIXTURES_PER_MATCHWEEK,
    );
    const roundTeams = new Set<TeamSlug>();

    for (const fixture of roundFixtures) {
      if (
        !TEAM_SLUG_SET.has(fixture.homeTeamSlug) ||
        !TEAM_SLUG_SET.has(fixture.awayTeamSlug)
      ) {
        fail(`fixture ${fixture.sourceIndex + 1} references an unknown team.`);
      }
      if (fixture.homeTeamSlug === fixture.awayTeamSlug) {
        fail(`fixture ${fixture.sourceIndex + 1} repeats the same team.`);
      }
      if (
        roundTeams.has(fixture.homeTeamSlug) ||
        roundTeams.has(fixture.awayTeamSlug)
      ) {
        fail(`Matchweek ${roundIndex + 1} repeats a team.`);
      }
      roundTeams.add(fixture.homeTeamSlug);
      roundTeams.add(fixture.awayTeamSlug);

      const directedKey = `${fixture.homeTeamSlug}:${fixture.awayTeamSlug}`;
      if (directedPairings.has(directedKey)) {
        fail(`duplicate directed pairing ${directedKey}.`);
      }
      directedPairings.add(directedKey);

      const sortedPair = [fixture.homeTeamSlug, fixture.awayTeamSlug].sort();
      const unorderedKey = sortedPair.join(":");
      const existingPair = unorderedPairings.get(unorderedKey);
      if (!existingPair) {
        unorderedPairings.set(unorderedKey, {
          count: 1,
          firstAway: fixture.awayTeamSlug,
          firstHome: fixture.homeTeamSlug,
        });
      } else {
        existingPair.count += 1;
        if (
          existingPair.firstHome !== fixture.awayTeamSlug ||
          existingPair.firstAway !== fixture.homeTeamSlug
        ) {
          fail(`pairing ${unorderedKey} does not reverse home and away teams.`);
        }
      }
    }

    if (roundTeams.size !== PREMIER_LEAGUE_2026_27_TEAMS.length) {
      fail(`Matchweek ${roundIndex + 1} does not contain all 20 teams.`);
    }
  }

  const expectedPairingCount =
    (PREMIER_LEAGUE_2026_27_TEAMS.length *
      (PREMIER_LEAGUE_2026_27_TEAMS.length - 1)) /
    2;
  if (unorderedPairings.size !== expectedPairingCount) {
    fail(
      `expected ${expectedPairingCount} team pairings, received ${unorderedPairings.size}.`,
    );
  }
  for (const [pairing, value] of unorderedPairings) {
    if (value.count !== 2) {
      fail(`pairing ${pairing} appears ${value.count} times instead of twice.`);
    }
  }
}

function fixtureTimeBasis(
  fixture: ParsedOfficialFixture,
  matchweek: number,
): FixtureTimeBasis {
  if (fixture.explicitTime) {
    return "explicit";
  }
  if (matchweek === FINAL_MATCHWEEK) {
    return "final-matchweek-default";
  }
  return isMidweekDate(fixture.localDate)
    ? "midweek-default"
    : "weekend-default";
}

function canonicalFixture(
  fixture: ParsedOfficialFixture,
  matchweek: number,
): CanonicalWinStreakFixture {
  const timeBasis = fixtureTimeBasis(fixture, matchweek);
  const localTime =
    timeBasis === "final-matchweek-default"
      ? KICKOFF_DEFAULTS.finalMatchweekLocal
      : fixture.localTime;

  return {
    awayTeamSlug: fixture.awayTeamSlug,
    homeTeamSlug: fixture.homeTeamSlug,
    id: `2026-27-mw${String(matchweek).padStart(2, "0")}-${fixture.homeTeamSlug}-${fixture.awayTeamSlug}`,
    kickoffAt: localLondonKickoffToUtc(fixture.localDate, localTime),
    localDate: fixture.localDate,
    localTime,
    matchweek,
    timeBasis,
  };
}

function normalizedFixtureFingerprint(
  fixtures: readonly ParsedOfficialFixture[],
): string {
  const normalized = fixtures.map((fixture, index) => {
    const matchweek = Math.floor(index / FIXTURES_PER_MATCHWEEK) + 1;
    const canonical = canonicalFixture(fixture, matchweek);
    return [
      canonical.matchweek,
      canonical.localDate,
      canonical.localTime,
      canonical.homeTeamSlug,
      canonical.awayTeamSlug,
      canonical.timeBasis,
    ].join("|");
  });

  return createHash("sha256").update(normalized.join("\n")).digest("hex");
}

function validateCheckedAt(checkedAt: string): void {
  if (!ISO_DATE_PATTERN.test(checkedAt)) {
    fail(`source check date ${checkedAt} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${checkedAt}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== checkedAt
  ) {
    fail(`source check date ${checkedAt} is not a calendar date.`);
  }
}

export function createCanonicalWinStreakFixtureSnapshot(
  fixtures: readonly ParsedOfficialFixture[],
  checkedAt: string,
): CanonicalWinStreakFixtureSnapshot {
  validateCheckedAt(checkedAt);
  validateFullSeasonFixtures(fixtures);

  const rounds = Array.from(
    { length: FINAL_MATCHWEEK - FIRST_RETAINED_MATCHWEEK + 1 },
    (_, index) => {
      const matchweek = index + FIRST_RETAINED_MATCHWEEK;
      const sourceStart = (matchweek - 1) * FIXTURES_PER_MATCHWEEK;
      return {
        fixtures: fixtures
          .slice(sourceStart, sourceStart + FIXTURES_PER_MATCHWEEK)
          .map((fixture) => canonicalFixture(fixture, matchweek)),
        matchweek,
      };
    },
  );

  return {
    competition: "Premier League",
    kickoffDefaults: KICKOFF_DEFAULTS,
    rounds,
    schemaVersion: SCHEMA_VERSION,
    season: SEASON,
    source: {
      checkedAt,
      finalMatchweekTimingUrl: OFFICIAL_FINAL_MATCHWEEK_TIMING_URL,
      fixtureListUrl: OFFICIAL_FIXTURE_LIST_URL,
      normalizedFixtureSha256: normalizedFixtureFingerprint(fixtures),
      subjectToChange: true,
    },
    timeZone: TIME_ZONE,
  };
}

function serializeSnapshot(
  snapshot: CanonicalWinStreakFixtureSnapshot,
): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

function readCheckedAt(serializedSnapshot: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedSnapshot);
  } catch {
    fail("the tracked canonical fixture snapshot is not valid JSON.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("source" in parsed) ||
    typeof parsed.source !== "object" ||
    parsed.source === null ||
    !("checkedAt" in parsed.source) ||
    typeof parsed.source.checkedAt !== "string"
  ) {
    fail("the tracked canonical fixture snapshot has no source check date.");
  }
  validateCheckedAt(parsed.source.checkedAt);
  return parsed.source.checkedAt;
}

async function fetchOfficialFixtureHtml(): Promise<string> {
  const response = await fetch(OFFICIAL_FIXTURE_LIST_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Dranx owner-run fixture verifier/1.0",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    fail(`official fixture request returned HTTP ${response.status}.`);
  }
  const html = await response.text();
  if (html.length > 2_000_000) {
    fail(`official fixture response exceeds the 2 MB limit.`);
  }
  return html;
}

export async function runWinStreakFixtureRefresh({
  checkedAt,
  fetchSourceHtml = fetchOfficialFixtureHtml,
  mode,
  readCanonical = () => readFile(WIN_STREAK_FIXTURE_PATH, "utf8"),
  writeCanonical = (serializedSnapshot) =>
    writeFile(WIN_STREAK_FIXTURE_PATH, serializedSnapshot, "utf8"),
}: RefreshDependencies): Promise<RefreshResult> {
  const sourceHtml = await fetchSourceHtml();
  const fixtures = parseOfficialFixtureArticle(sourceHtml);

  if (mode === "check") {
    const currentSnapshot = await readCanonical();
    const retainedCheckedAt = readCheckedAt(currentSnapshot);
    const candidate = serializeSnapshot(
      createCanonicalWinStreakFixtureSnapshot(fixtures, retainedCheckedAt),
    );
    if (candidate !== currentSnapshot) {
      fail(
        "fixture drift detected in src/data/win-streak-fixtures.json. Review the official changes, then run fixtures:apply with an explicit check date.",
      );
    }
    return {
      changed: false,
      fixtureCount: FULL_SEASON_FIXTURE_COUNT - FIXTURES_PER_MATCHWEEK,
      matchweekCount: FINAL_MATCHWEEK - FIRST_RETAINED_MATCHWEEK + 1,
      sourceCheckedAt: retainedCheckedAt,
    };
  }

  const appliedCheckedAt = checkedAt ?? new Date().toISOString().slice(0, 10);
  const snapshot = createCanonicalWinStreakFixtureSnapshot(
    fixtures,
    appliedCheckedAt,
  );
  await writeCanonical(serializeSnapshot(snapshot));
  return {
    changed: true,
    fixtureCount: FULL_SEASON_FIXTURE_COUNT - FIXTURES_PER_MATCHWEEK,
    matchweekCount: FINAL_MATCHWEEK - FIRST_RETAINED_MATCHWEEK + 1,
    sourceCheckedAt: appliedCheckedAt,
  };
}

function parseCliArguments(args: readonly string[]): {
  checkedAt?: string;
  mode: RefreshMode;
} {
  const check = args.includes("--check");
  const apply = args.includes("--apply");
  if (check === apply) {
    fail("pass exactly one of --check or --apply.");
  }
  const checkedAtArgument = args.find((argument) =>
    argument.startsWith("--checked-at="),
  );
  const checkedAt = checkedAtArgument?.slice("--checked-at=".length);
  const supported = new Set([
    "--apply",
    "--check",
    ...(checkedAtArgument ? [checkedAtArgument] : []),
  ]);
  const unknownArgument = args.find((argument) => !supported.has(argument));
  if (unknownArgument) {
    fail(`unknown argument ${unknownArgument}.`);
  }
  if (check && checkedAt) {
    fail("--checked-at is available only with --apply.");
  }
  return { checkedAt, mode: check ? "check" : "apply" };
}

async function main(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
  const result = await runWinStreakFixtureRefresh(options);
  const action = options.mode === "check" ? "verified" : "wrote";
  console.log(
    `Win Streak fixtures ${action}: ${result.fixtureCount} fixtures across ${result.matchweekCount} matchweeks; official source checked ${result.sourceCheckedAt}.`,
  );
}

const executedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (executedPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
