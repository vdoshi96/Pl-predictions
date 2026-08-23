import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { ACTIVE_SEASON } from "@/data";
import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data/teams";
import { getDb, type Database } from "@/db/client";
import {
  seasons,
  teams,
  winStreakFixtures,
  winStreakPicks,
  winStreakRounds,
} from "@/db/schema";

export const WIN_STREAK_FIXTURE_SEED_PATH = resolve(
  process.cwd(),
  "src/data/win-streak-fixtures.json",
);

const FIXTURE_SCHEMA_VERSION = 1;
const FIRST_MATCHWEEK = 2;
const FINAL_MATCHWEEK = 38;
const FIXTURES_PER_ROUND = 10;
const ROUND_COUNT = FINAL_MATCHWEEK - FIRST_MATCHWEEK + 1;
const FIXTURE_COUNT = ROUND_COUNT * FIXTURES_PER_ROUND;
const MAX_FIXTURE_FILE_BYTES = 2_000_000;
const FIXTURE_SOURCE = "premier-league-official-fixtures";
const OFFICIAL_FIXTURE_SOURCE_URL =
  "https://www.premierleague.com/en/news/4675097";
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256_PATTERN = /^[\da-f]{64}$/u;

type TeamSlug = (typeof PREMIER_LEAGUE_2026_27_TEAM_SLUGS)[number];

type FixtureHashInput = {
  awayTeamSlug: string;
  homeTeamSlug: string;
  kickoffAt: Date;
  sourceFixtureId: string;
};

export type PreparedWinStreakFixture = FixtureHashInput & {
  awayTeamSlug: TeamSlug;
  homeTeamSlug: TeamSlug;
};

export type PreparedWinStreakRound = {
  fixtureContentHash: string;
  fixtures: readonly PreparedWinStreakFixture[];
  matchweek: number;
  pickDeadline: Date;
};

export type PreparedWinStreakFixtureSeed = {
  rounds: readonly PreparedWinStreakRound[];
  sourceReference: string;
  sourceVerifiedAt: Date;
};

export type WinStreakFixtureSeedResult = {
  fixtureCount: number;
  insertedRoundCount: number;
  roundCount: number;
  seasonId: string;
  unchangedRoundCount: number;
  updatedRoundCount: number;
};

type JsonRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`Win Streak fixture seed failed: ${message}`);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a nonempty string.`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(`${label} must be a whole number.`);
  }
  return value;
}

function parseCanonicalInstant(value: unknown, label: string): Date {
  const source = asString(value, label);
  const parsed = new Date(source);
  if (
    !ISO_INSTANT_PATTERN.test(source) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString() !== source
  ) {
    fail(`${label} must use a canonical UTC ISO instant.`);
  }
  return parsed;
}

function parseCheckedAt(value: unknown): Date {
  const checkedAt = asString(value, "source.checkedAt");
  const parsed = new Date(`${checkedAt}T00:00:00.000Z`);
  if (
    !ISO_DATE_PATTERN.test(checkedAt) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== checkedAt
  ) {
    fail("source.checkedAt must be a calendar date in YYYY-MM-DD form.");
  }
  return parsed;
}

function parseTeamSlug(value: unknown, label: string): TeamSlug {
  const slug = asString(value, label);
  if (!PREMIER_LEAGUE_2026_27_TEAM_SLUGS.includes(slug as TeamSlug)) {
    fail(`${label} references unknown club ${slug}.`);
  }
  return slug as TeamSlug;
}

export function winStreakRoundContentHash(
  fixtures: readonly FixtureHashInput[],
): string {
  const normalized = [...fixtures]
    .sort((left, right) =>
      left.sourceFixtureId.localeCompare(right.sourceFixtureId, "en-GB"),
    )
    .map((fixture) =>
      [
        fixture.sourceFixtureId,
        fixture.homeTeamSlug,
        fixture.awayTeamSlug,
        fixture.kickoffAt.toISOString(),
      ].join("|"),
    )
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

export function prepareWinStreakFixtureSeed(
  input: unknown,
): PreparedWinStreakFixtureSeed {
  const snapshot = asRecord(input, "fixture snapshot");
  if (snapshot.schemaVersion !== FIXTURE_SCHEMA_VERSION) {
    fail(`fixture schema version must be ${FIXTURE_SCHEMA_VERSION}.`);
  }
  if (snapshot.season !== "2026/27") {
    fail("fixture season must be 2026/27.");
  }
  if (snapshot.competition !== "Premier League") {
    fail("fixture competition must be Premier League.");
  }
  if (snapshot.timeZone !== "Europe/London") {
    fail("fixture time zone must be Europe/London.");
  }

  const source = asRecord(snapshot.source, "source");
  const sourceReference = asString(
    source.fixtureListUrl,
    "source.fixtureListUrl",
  );
  if (sourceReference !== OFFICIAL_FIXTURE_SOURCE_URL) {
    fail("fixture source must be the reviewed official Premier League list.");
  }
  if (source.subjectToChange !== true) {
    fail("fixture source must retain the subject-to-change marker.");
  }
  const sourceHash = asString(
    source.normalizedFixtureSha256,
    "source.normalizedFixtureSha256",
  );
  if (!SHA256_PATTERN.test(sourceHash)) {
    fail("source.normalizedFixtureSha256 must be a lowercase SHA-256 hash.");
  }
  const sourceVerifiedAt = parseCheckedAt(source.checkedAt);

  if (
    !Array.isArray(snapshot.rounds) ||
    snapshot.rounds.length !== ROUND_COUNT
  ) {
    fail("expected Matchweeks 2 through 38.");
  }

  const expectedTeamSlugs = new Set<string>(PREMIER_LEAGUE_2026_27_TEAM_SLUGS);
  const sourceFixtureIds = new Set<string>();
  const directedPairings = new Set<string>();
  const rounds: PreparedWinStreakRound[] = [];

  for (let roundIndex = 0; roundIndex < ROUND_COUNT; roundIndex += 1) {
    const expectedMatchweek = roundIndex + FIRST_MATCHWEEK;
    const sourceRound = asRecord(
      snapshot.rounds[roundIndex],
      `round ${expectedMatchweek}`,
    );
    const matchweek = asNumber(
      sourceRound.matchweek,
      `round ${expectedMatchweek}.matchweek`,
    );
    if (matchweek !== expectedMatchweek) {
      fail(`expected Matchweek ${expectedMatchweek}, received ${matchweek}.`);
    }
    if (
      !Array.isArray(sourceRound.fixtures) ||
      sourceRound.fixtures.length !== FIXTURES_PER_ROUND
    ) {
      fail(`Matchweek ${matchweek} must contain exactly ten fixtures.`);
    }

    const roundTeams = new Set<string>();
    const fixtures: PreparedWinStreakFixture[] = sourceRound.fixtures.map(
      (fixtureValue, fixtureIndex) => {
        const label = `Matchweek ${matchweek} fixture ${fixtureIndex + 1}`;
        const fixture = asRecord(fixtureValue, label);
        if (asNumber(fixture.matchweek, `${label}.matchweek`) !== matchweek) {
          fail(`${label} must reference Matchweek ${matchweek}.`);
        }
        const homeTeamSlug = parseTeamSlug(
          fixture.homeTeamSlug,
          `${label}.homeTeamSlug`,
        );
        const awayTeamSlug = parseTeamSlug(
          fixture.awayTeamSlug,
          `${label}.awayTeamSlug`,
        );
        if (homeTeamSlug === awayTeamSlug) {
          fail(`${label} must contain two different clubs.`);
        }
        roundTeams.add(homeTeamSlug);
        roundTeams.add(awayTeamSlug);

        const sourceFixtureId = asString(fixture.id, `${label}.id`);
        const expectedId = `${ACTIVE_SEASON.slug}-mw${String(matchweek).padStart(2, "0")}-${homeTeamSlug}-${awayTeamSlug}`;
        if (sourceFixtureId !== expectedId) {
          fail(`${label} must use canonical ID ${expectedId}.`);
        }
        if (sourceFixtureIds.has(sourceFixtureId)) {
          fail(`duplicate source fixture ID ${sourceFixtureId}.`);
        }
        sourceFixtureIds.add(sourceFixtureId);

        const directedPairing = `${homeTeamSlug}:${awayTeamSlug}`;
        if (directedPairings.has(directedPairing)) {
          fail(`duplicate directed pairing ${directedPairing}.`);
        }
        directedPairings.add(directedPairing);

        return {
          awayTeamSlug,
          homeTeamSlug,
          kickoffAt: parseCanonicalInstant(
            fixture.kickoffAt,
            `${label}.kickoffAt`,
          ),
          sourceFixtureId,
        };
      },
    );

    if (
      roundTeams.size !== expectedTeamSlugs.size ||
      [...expectedTeamSlugs].some((slug) => !roundTeams.has(slug))
    ) {
      fail(`Matchweek ${matchweek} must contain every club exactly once.`);
    }

    const pickDeadline = new Date(
      Math.min(...fixtures.map((fixture) => fixture.kickoffAt.getTime())),
    );
    rounds.push({
      fixtureContentHash: winStreakRoundContentHash(fixtures),
      fixtures,
      matchweek,
      pickDeadline,
    });
  }

  if (
    sourceFixtureIds.size !== FIXTURE_COUNT ||
    directedPairings.size !== FIXTURE_COUNT
  ) {
    fail(`expected ${FIXTURE_COUNT} unique retained fixtures.`);
  }

  return { rounds, sourceReference, sourceVerifiedAt };
}

async function loadPreparedWinStreakFixtureSeed(): Promise<PreparedWinStreakFixtureSeed> {
  const serialized = await readFile(WIN_STREAK_FIXTURE_SEED_PATH, "utf8");
  if (Buffer.byteLength(serialized, "utf8") > MAX_FIXTURE_FILE_BYTES) {
    fail("src/data/win-streak-fixtures.json exceeds the 2 MB limit.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail("src/data/win-streak-fixtures.json is not valid JSON.");
  }
  return prepareWinStreakFixtureSeed(parsed);
}

function teamIdFor(
  teamIdBySlug: ReadonlyMap<string, string>,
  slug: TeamSlug,
): string {
  const teamId = teamIdBySlug.get(slug);
  if (!teamId) {
    fail(`active season is missing club ${slug}.`);
  }
  return teamId;
}

function batchItems(
  items: readonly BatchItem<"pg">[],
): readonly [BatchItem<"pg">, ...BatchItem<"pg">[]] {
  const [first, ...rest] = items;
  if (!first) fail("internal seed batch is empty.");
  return [first, ...rest];
}

export async function seedWinStreakFixtures(
  db: Database = getDb(),
  preparedInput?: PreparedWinStreakFixtureSeed,
): Promise<WinStreakFixtureSeedResult> {
  const prepared = preparedInput ?? (await loadPreparedWinStreakFixtureSeed());

  const [season] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.slug, ACTIVE_SEASON.slug))
    .limit(1);
  if (!season) {
    fail("the active season is missing; run the primary database seed first.");
  }

  const seededTeams = await db
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(eq(teams.seasonId, season.id))
    .orderBy(asc(teams.slug));
  const expectedTeamSlugs = new Set<string>(PREMIER_LEAGUE_2026_27_TEAM_SLUGS);
  if (
    seededTeams.length !== expectedTeamSlugs.size ||
    seededTeams.some((team) => !expectedTeamSlugs.has(team.slug))
  ) {
    fail("the active season must contain exactly the verified 20 clubs.");
  }
  const teamIdBySlug = new Map(
    seededTeams.map((team) => [team.slug, team.id] as const),
  );
  const teamSlugById = new Map(
    seededTeams.map((team) => [team.id, team.slug] as const),
  );

  const existingRounds = await db
    .select()
    .from(winStreakRounds)
    .where(eq(winStreakRounds.seasonId, season.id));
  const existingRoundIds = existingRounds.map((round) => round.id);
  const existingFixtures =
    existingRoundIds.length === 0
      ? []
      : await db
          .select()
          .from(winStreakFixtures)
          .where(inArray(winStreakFixtures.roundId, existingRoundIds));
  const pickCounts =
    existingRoundIds.length === 0
      ? []
      : await db
          .select({ roundId: winStreakPicks.roundId, value: count() })
          .from(winStreakPicks)
          .where(inArray(winStreakPicks.roundId, existingRoundIds))
          .groupBy(winStreakPicks.roundId);

  const existingRoundByMatchweek = new Map(
    existingRounds.map((round) => [round.matchweek, round] as const),
  );
  const existingFixturesByRound = new Map<string, typeof existingFixtures>();
  for (const fixture of existingFixtures) {
    const roundFixtures = existingFixturesByRound.get(fixture.roundId) ?? [];
    roundFixtures.push(fixture);
    existingFixturesByRound.set(fixture.roundId, roundFixtures);
  }
  const pickCountByRound = new Map(
    pickCounts.map((row) => [row.roundId, row.value] as const),
  );

  let insertedRoundCount = 0;
  let updatedRoundCount = 0;
  let unchangedRoundCount = 0;

  for (const targetRound of prepared.rounds) {
    const existingRound = existingRoundByMatchweek.get(targetRound.matchweek);
    if (!existingRound) {
      const roundId = randomUUID();
      await db.batch(
        batchItems([
          db.insert(winStreakRounds).values({
            fixtureContentHash: targetRound.fixtureContentHash,
            fixtureSource: FIXTURE_SOURCE,
            fixtureSourceReference: prepared.sourceReference,
            fixtureVerifiedAt: prepared.sourceVerifiedAt,
            id: roundId,
            matchweek: targetRound.matchweek,
            pickDeadline: targetRound.pickDeadline,
            seasonId: season.id,
          }),
          db.insert(winStreakFixtures).values(
            targetRound.fixtures.map((fixture) => ({
              awayTeamId: teamIdFor(teamIdBySlug, fixture.awayTeamSlug),
              homeTeamId: teamIdFor(teamIdBySlug, fixture.homeTeamSlug),
              kickoffAt: fixture.kickoffAt,
              roundId,
              seasonId: season.id,
              sourceFixtureId: fixture.sourceFixtureId,
            })),
          ),
        ]),
      );
      insertedRoundCount += 1;
      continue;
    }

    const roundFixtures = existingFixturesByRound.get(existingRound.id) ?? [];
    if (roundFixtures.length !== FIXTURES_PER_ROUND) {
      fail(
        `stored Matchweek ${targetRound.matchweek} has ${roundFixtures.length} fixtures instead of ten.`,
      );
    }
    const existingFixtureBySourceId = new Map(
      roundFixtures.map(
        (fixture) => [fixture.sourceFixtureId, fixture] as const,
      ),
    );
    for (const targetFixture of targetRound.fixtures) {
      const existingFixture = existingFixtureBySourceId.get(
        targetFixture.sourceFixtureId,
      );
      if (!existingFixture) {
        fail(
          `stored Matchweek ${targetRound.matchweek} does not match the reviewed fixture pairings.`,
        );
      }
      if (
        teamSlugById.get(existingFixture.homeTeamId) !==
          targetFixture.homeTeamSlug ||
        teamSlugById.get(existingFixture.awayTeamId) !==
          targetFixture.awayTeamSlug
      ) {
        fail(
          `stored fixture ${targetFixture.sourceFixtureId} has different clubs from the reviewed snapshot.`,
        );
      }
    }
    if (existingFixtureBySourceId.size !== targetRound.fixtures.length) {
      fail(
        `stored Matchweek ${targetRound.matchweek} contains an unexpected fixture.`,
      );
    }

    const scheduleChanged = targetRound.fixtures.some((targetFixture) => {
      const existingFixture = existingFixtureBySourceId.get(
        targetFixture.sourceFixtureId,
      );
      return (
        !existingFixture ||
        existingFixture.kickoffAt.getTime() !==
          targetFixture.kickoffAt.getTime()
      );
    });
    const provenanceChanged =
      existingRound.fixtureContentHash !== targetRound.fixtureContentHash ||
      existingRound.fixtureSource !== FIXTURE_SOURCE ||
      existingRound.fixtureSourceReference !== prepared.sourceReference;
    const deadlineChanged =
      existingRound.pickDeadline.getTime() !==
      targetRound.pickDeadline.getTime();

    if (!scheduleChanged && !provenanceChanged && !deadlineChanged) {
      unchangedRoundCount += 1;
      continue;
    }

    if (existingRound.resolvedAt) {
      fail(
        `stored Matchweek ${targetRound.matchweek} is resolved and cannot accept fixture drift.`,
      );
    }
    if ((pickCountByRound.get(existingRound.id) ?? 0) > 0) {
      fail(
        `stored Matchweek ${targetRound.matchweek} has picks and cannot accept fixture drift.`,
      );
    }
    if (Date.now() >= existingRound.pickDeadline.getTime()) {
      fail(
        `stored Matchweek ${targetRound.matchweek} has reached its deadline and cannot accept fixture drift.`,
      );
    }
    if (Date.now() >= targetRound.pickDeadline.getTime()) {
      fail(
        `reviewed Matchweek ${targetRound.matchweek} deadline is not in the future.`,
      );
    }

    const updatedAt = new Date();
    await db.batch(
      batchItems([
        db
          .update(winStreakRounds)
          .set({
            fixtureContentHash: targetRound.fixtureContentHash,
            fixtureSource: FIXTURE_SOURCE,
            fixtureSourceReference: prepared.sourceReference,
            fixtureVerifiedAt: prepared.sourceVerifiedAt,
            pickDeadline: targetRound.pickDeadline,
            updatedAt,
          })
          .where(eq(winStreakRounds.id, existingRound.id)),
        ...targetRound.fixtures.map((targetFixture) => {
          const existingFixture = existingFixtureBySourceId.get(
            targetFixture.sourceFixtureId,
          );
          if (!existingFixture) {
            fail(
              `stored Matchweek ${targetRound.matchweek} is missing ${targetFixture.sourceFixtureId}.`,
            );
          }
          return db
            .update(winStreakFixtures)
            .set({ kickoffAt: targetFixture.kickoffAt, updatedAt })
            .where(
              and(
                eq(winStreakFixtures.id, existingFixture.id),
                eq(winStreakFixtures.roundId, existingRound.id),
              ),
            );
        }),
      ]),
    );
    updatedRoundCount += 1;
  }

  const [roundTotal] = await db
    .select({ value: count() })
    .from(winStreakRounds)
    .where(eq(winStreakRounds.seasonId, season.id));
  const [fixtureTotal] = await db
    .select({ value: count() })
    .from(winStreakFixtures)
    .where(eq(winStreakFixtures.seasonId, season.id));
  if (
    roundTotal?.value !== ROUND_COUNT ||
    fixtureTotal?.value !== FIXTURE_COUNT
  ) {
    fail(
      `post-seed verification expected ${ROUND_COUNT} rounds and ${FIXTURE_COUNT} fixtures.`,
    );
  }

  return {
    fixtureCount: FIXTURE_COUNT,
    insertedRoundCount,
    roundCount: ROUND_COUNT,
    seasonId: season.id,
    unchangedRoundCount,
    updatedRoundCount,
  };
}

async function main(): Promise<void> {
  const result = await seedWinStreakFixtures();
  process.stdout.write(
    `Seeded Win Streak: ${result.roundCount} rounds and ${result.fixtureCount} fixtures (${result.insertedRoundCount} inserted, ${result.updatedRoundCount} updated, ${result.unchangedRoundCount} unchanged).\n`,
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown Win Streak seed error.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
