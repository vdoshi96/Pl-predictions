import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import canonicalFixtureSnapshot from "@/data/win-streak-fixtures.json";
import {
  PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG,
  PREMIER_LEAGUE_2026_27_TEAM_SLUGS,
} from "@/data/teams";
import {
  OFFICIAL_FIXTURE_LIST_URL,
  createCanonicalWinStreakFixtureSnapshot,
  localLondonKickoffToUtc,
  parseOfficialFixtureArticle,
  runWinStreakFixtureRefresh,
  validateFullSeasonFixtures,
  type ParsedOfficialFixture,
} from "../../scripts/refresh-win-streak-fixtures";

const OPENING_ROUND_INPUT = [
  ["2026-08-21", "20:00", "arsenal", "coventry-city", true],
  ["2026-08-22", "12:30", "hull-city", "manchester-united", true],
  ["2026-08-22", "15:00", "everton", "crystal-palace", false],
  ["2026-08-22", "15:00", "ipswich-town", "sunderland", false],
  ["2026-08-22", "15:00", "nottingham-forest", "leeds-united", false],
  ["2026-08-22", "17:30", "brentford", "tottenham-hotspur", true],
  ["2026-08-23", "14:00", "brighton-and-hove-albion", "aston-villa", true],
  ["2026-08-23", "14:00", "manchester-city", "afc-bournemouth", true],
  ["2026-08-23", "16:30", "newcastle-united", "liverpool", true],
  ["2026-08-24", "20:00", "fulham", "chelsea", true],
] as const satisfies readonly (readonly [
  string,
  string,
  ParsedOfficialFixture["homeTeamSlug"],
  ParsedOfficialFixture["awayTeamSlug"],
  boolean,
])[];

const OPENING_ROUND: readonly ParsedOfficialFixture[] = OPENING_ROUND_INPUT.map(
  (
    [localDate, localTime, homeTeamSlug, awayTeamSlug, explicitTime],
    index,
  ) => ({
    awayTeamSlug,
    explicitTime,
    homeTeamSlug,
    localDate,
    localTime,
    sourceIndex: index,
  }),
);

const canonicalPath = resolve(
  process.cwd(),
  "src/data/win-streak-fixtures.json",
);

function canonicalFixtures() {
  return canonicalFixtureSnapshot.rounds.flatMap((round) => round.fixtures);
}

function fullParsedFixtures(): readonly ParsedOfficialFixture[] {
  return [
    ...OPENING_ROUND,
    ...canonicalFixtures().map((fixture, index): ParsedOfficialFixture => {
      if (
        !PREMIER_LEAGUE_2026_27_TEAM_SLUGS.includes(
          fixture.homeTeamSlug as ParsedOfficialFixture["homeTeamSlug"],
        ) ||
        !PREMIER_LEAGUE_2026_27_TEAM_SLUGS.includes(
          fixture.awayTeamSlug as ParsedOfficialFixture["awayTeamSlug"],
        )
      ) {
        throw new Error("Canonical fixture references an unknown team.");
      }
      return {
        awayTeamSlug:
          fixture.awayTeamSlug as ParsedOfficialFixture["awayTeamSlug"],
        explicitTime: fixture.timeBasis === "explicit",
        homeTeamSlug:
          fixture.homeTeamSlug as ParsedOfficialFixture["homeTeamSlug"],
        localDate: fixture.localDate,
        localTime: fixture.localTime,
        sourceIndex: index + OPENING_ROUND.length,
      };
    }),
  ];
}

function officialDateHeading(localDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  })
    .format(new Date(`${localDate}T12:00:00.000Z`))
    .replace(",", "");
}

function renderOfficialArticle(
  fixtures: readonly ParsedOfficialFixture[],
): string {
  const paragraphs = fixtures.map((fixture) => {
    const home = PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG.get(fixture.homeTeamSlug);
    const away = PREMIER_LEAGUE_2026_27_TEAM_BY_SLUG.get(fixture.awayTeamSlug);
    if (!home || !away) {
      throw new Error("Test fixture references an unknown team.");
    }
    const time = fixture.explicitTime ? `${fixture.localTime} ` : "";
    return `<p><strong>${officialDateHeading(fixture.localDate)}</strong><br />${time}${home.displayName} v ${away.displayName}</p>`;
  });
  return `<article data-article-id="4675097">${paragraphs.join("\n")}</article>`;
}

describe("official Win Streak fixture refresh", () => {
  it("parses official article markup and normalizes the published team alias", () => {
    const html = `
      <article>
        <p><strong>Sunday 25 October 2026</strong><br />
          14:00 GMT Crystal Palace v Newcastle (Sky Sports)*<br />
          Hull City v Brentford
        </p>
      </article>
    `;

    expect(parseOfficialFixtureArticle(html)).toEqual([
      expect.objectContaining({
        awayTeamSlug: "newcastle-united",
        explicitTime: true,
        homeTeamSlug: "crystal-palace",
        localDate: "2026-10-25",
        localTime: "14:00",
      }),
      expect.objectContaining({
        awayTeamSlug: "brentford",
        explicitTime: false,
        homeTeamSlug: "hull-city",
        localDate: "2026-10-25",
        localTime: "15:00",
      }),
    ]);
  });

  it("converts Europe/London local kickoffs across GMT and BST", () => {
    expect(localLondonKickoffToUtc("2026-08-29", "15:00")).toBe(
      "2026-08-29T14:00:00.000Z",
    );
    expect(localLondonKickoffToUtc("2026-12-02", "20:00")).toBe(
      "2026-12-02T20:00:00.000Z",
    );
    expect(localLondonKickoffToUtc("2027-04-10", "15:00")).toBe(
      "2027-04-10T14:00:00.000Z",
    );
    expect(localLondonKickoffToUtc("2027-05-30", "16:00")).toBe(
      "2027-05-30T15:00:00.000Z",
    );
  });

  it("contains 37 complete shared rounds from Matchweek 2", () => {
    expect(canonicalFixtureSnapshot.schemaVersion).toBe(1);
    expect(canonicalFixtureSnapshot.source.fixtureListUrl).toBe(
      OFFICIAL_FIXTURE_LIST_URL,
    );
    expect(canonicalFixtureSnapshot.source.checkedAt).toBe("2026-08-23");
    expect(canonicalFixtureSnapshot.rounds).toHaveLength(37);
    expect(canonicalFixtures()).toHaveLength(370);
    expect(
      canonicalFixtureSnapshot.rounds.map((round) => round.matchweek),
    ).toEqual(Array.from({ length: 37 }, (_, index) => index + 2));

    const expectedTeams = [...PREMIER_LEAGUE_2026_27_TEAM_SLUGS].sort();
    for (const round of canonicalFixtureSnapshot.rounds) {
      expect(round.fixtures).toHaveLength(10);
      expect(
        round.fixtures
          .flatMap((fixture) => [fixture.homeTeamSlug, fixture.awayTeamSlug])
          .sort(),
      ).toEqual(expectedTeams);
    }
  });

  it("has deterministic unique IDs and valid UTC kickoff instants", () => {
    const fixtures = canonicalFixtures();
    const ids = fixtures.map((fixture) => fixture.id);

    expect(new Set(ids).size).toBe(fixtures.length);
    for (const fixture of fixtures) {
      expect(fixture.id).toBe(
        `2026-27-mw${String(fixture.matchweek).padStart(2, "0")}-${fixture.homeTeamSlug}-${fixture.awayTeamSlug}`,
      );
      expect(fixture.kickoffAt).toBe(
        localLondonKickoffToUtc(fixture.localDate, fixture.localTime),
      );
    }
  });

  it("reconciles every full-season pairing in both directions", () => {
    expect(() =>
      validateFullSeasonFixtures(fullParsedFixtures()),
    ).not.toThrow();
  });

  it("preserves the published Matchweek 2 amendments", () => {
    const round = canonicalFixtureSnapshot.rounds[0];
    expect(round?.matchweek).toBe(2);
    expect(
      round?.fixtures.map((fixture) => [
        fixture.localDate,
        fixture.localTime,
        fixture.homeTeamSlug,
        fixture.awayTeamSlug,
      ]),
    ).toEqual([
      ["2026-08-28", "20:00", "crystal-palace", "manchester-city"],
      ["2026-08-29", "12:30", "liverpool", "nottingham-forest"],
      ["2026-08-29", "15:00", "afc-bournemouth", "everton"],
      ["2026-08-29", "15:00", "coventry-city", "hull-city"],
      ["2026-08-29", "17:30", "tottenham-hotspur", "newcastle-united"],
      ["2026-08-30", "14:00", "chelsea", "brighton-and-hove-albion"],
      ["2026-08-30", "14:00", "leeds-united", "brentford"],
      ["2026-08-30", "14:00", "sunderland", "fulham"],
      ["2026-08-30", "16:30", "manchester-united", "ipswich-town"],
      ["2026-08-31", "20:00", "aston-villa", "arsenal"],
    ]);
  });

  it("uses the official 16:00 UK kickoff for every Matchweek 38 fixture", () => {
    const finalRound = canonicalFixtureSnapshot.rounds.at(-1);
    expect(finalRound?.matchweek).toBe(38);
    expect(
      finalRound?.fixtures.every(
        (fixture) =>
          fixture.localTime === "16:00" &&
          fixture.timeBasis === "final-matchweek-default",
      ),
    ).toBe(true);
  });

  it("keeps --check read-only and reports fixture drift", async () => {
    const canonicalText = await readFile(canonicalPath, "utf8");
    const sourceHtml = renderOfficialArticle(fullParsedFixtures());
    const fetchSourceHtml = vi.fn(async () => sourceHtml);
    const writeCanonical = vi.fn(async (serializedSnapshot: string) => {
      void serializedSnapshot;
    });

    await expect(
      runWinStreakFixtureRefresh({
        fetchSourceHtml,
        mode: "check",
        readCanonical: async () => canonicalText,
        writeCanonical,
      }),
    ).resolves.toMatchObject({ changed: false, fixtureCount: 370 });
    expect(fetchSourceHtml).toHaveBeenCalledOnce();
    expect(writeCanonical).not.toHaveBeenCalled();

    const changedSourceHtml = sourceHtml.replace(
      "Friday 28 August 2026",
      "Thursday 27 August 2026",
    );
    await expect(
      runWinStreakFixtureRefresh({
        fetchSourceHtml: async () => changedSourceHtml,
        mode: "check",
        readCanonical: async () => canonicalText,
        writeCanonical,
      }),
    ).rejects.toThrow(/fixture drift detected/u);
    expect(writeCanonical).not.toHaveBeenCalled();
  });

  it("mechanically writes a validated --apply snapshot", async () => {
    const writeCanonical = vi.fn(async (serializedSnapshot: string) => {
      void serializedSnapshot;
    });

    await expect(
      runWinStreakFixtureRefresh({
        checkedAt: "2026-08-23",
        fetchSourceHtml: async () =>
          renderOfficialArticle(fullParsedFixtures()),
        mode: "apply",
        writeCanonical,
      }),
    ).resolves.toMatchObject({
      changed: true,
      fixtureCount: 370,
      matchweekCount: 37,
      sourceCheckedAt: "2026-08-23",
    });

    expect(writeCanonical).toHaveBeenCalledOnce();
    const serialized = writeCanonical.mock.calls[0]?.[0];
    expect(typeof serialized).toBe("string");
    const written = JSON.parse(serialized ?? "{}");
    expect(written.source.checkedAt).toBe("2026-08-23");
    expect(written.rounds).toHaveLength(37);
  });

  it("retains the stored check date when rendering a --check candidate", () => {
    expect(
      createCanonicalWinStreakFixtureSnapshot(
        fullParsedFixtures(),
        "2026-08-23",
      ).source.checkedAt,
    ).toBe("2026-08-23");
  });
});
