import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { PublicError } from "@/shared/errors";

export const WIN_STREAK_RESULTS = [
  "home_win",
  "draw",
  "away_win",
  "void",
] as const;

export type WinStreakFixtureResult = (typeof WIN_STREAK_RESULTS)[number];

export type WinStreakResultFact = Readonly<{
  fixtureId: string;
  result: WinStreakFixtureResult;
}>;

export type ValidatedWinStreakResultSubmission = Readonly<{
  capturedAt: Date;
  results: readonly WinStreakResultFact[];
  roundId: string;
  sourceReference: string;
}>;

export type ResolveWinStreakRoundInput = ValidatedWinStreakResultSubmission &
  Readonly<{
    auditId?: string;
    requestId: string | null;
    seasonId: string;
  }>;

type ResolveWinStreakRoundRow = {
  applied: boolean;
  matchweek: number | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const LOCAL_UTC_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u;
const ISO_UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_SOURCE_REFERENCE_LENGTH = 2_048;
const FIXTURE_COUNT = 10;

function requiredString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function requiredUuid(value: unknown, message: string): string {
  const candidate = requiredString(value);
  if (!candidate || !UUID_PATTERN.test(candidate)) {
    throw new PublicError("BAD_REQUEST", message);
  }
  return candidate.toLowerCase();
}

function requiredResult(value: unknown): WinStreakFixtureResult {
  if (
    value !== "home_win" &&
    value !== "draw" &&
    value !== "away_win" &&
    value !== "void"
  ) {
    throw new PublicError(
      "BAD_REQUEST",
      "Choose Home win, Draw, Away win, or Void for every fixture.",
    );
  }
  return value;
}

function requiredSourceReference(value: unknown): string {
  const candidate = requiredString(value);
  if (!candidate || candidate.length > MAX_SOURCE_REFERENCE_LENGTH) {
    throw new PublicError("BAD_REQUEST", "Enter an HTTPS source URL.");
  }

  let source: URL;
  try {
    source = new URL(candidate);
  } catch {
    throw new PublicError("BAD_REQUEST", "Enter an HTTPS source URL.");
  }
  if (
    source.protocol !== "https:" ||
    source.username ||
    source.password ||
    source.hash
  ) {
    throw new PublicError("BAD_REQUEST", "Enter an HTTPS source URL.");
  }
  return source.toString();
}

function requiredCapturedAt(value: unknown, now: Date): Date {
  const source = value instanceof Date ? value.toISOString() : value;
  if (typeof source !== "string" || !ISO_UTC_INSTANT_PATTERN.test(source)) {
    throw new PublicError(
      "BAD_REQUEST",
      "Enter a valid captured-at time in UTC.",
    );
  }
  const candidate = new Date(source);
  if (Number.isNaN(candidate.valueOf())) {
    throw new PublicError(
      "BAD_REQUEST",
      "Enter a valid captured-at time in UTC.",
    );
  }
  if (candidate.getTime() > now.getTime()) {
    throw new PublicError(
      "BAD_REQUEST",
      "Captured at cannot be in the future.",
    );
  }
  return candidate;
}

export function parseWinStreakResultSubmission(
  input: unknown,
  now: Date,
): ValidatedWinStreakResultSubmission {
  if (
    typeof input !== "object" ||
    input === null ||
    !Number.isFinite(now.valueOf())
  ) {
    throw new PublicError("BAD_REQUEST", "Review every result and try again.");
  }
  const candidate = input as Record<string, unknown>;
  if (!Array.isArray(candidate.results) || candidate.results.length !== 10) {
    throw new PublicError(
      "BAD_REQUEST",
      "Enter one result for each of the ten fixtures.",
    );
  }

  const results = candidate.results.map((row): WinStreakResultFact => {
    if (typeof row !== "object" || row === null) {
      throw new PublicError(
        "BAD_REQUEST",
        "Choose a valid result for every fixture.",
      );
    }
    const resultRow = row as Record<string, unknown>;
    return {
      fixtureId: requiredUuid(
        resultRow.fixtureId,
        "A fixture result is unavailable.",
      ),
      result: requiredResult(resultRow.result),
    };
  });
  if (
    new Set(results.map((result) => result.fixtureId)).size !== FIXTURE_COUNT
  ) {
    throw new PublicError(
      "BAD_REQUEST",
      "Each fixture can have only one result.",
    );
  }

  return Object.freeze({
    capturedAt: requiredCapturedAt(candidate.capturedAt, now),
    results: Object.freeze(results),
    roundId: requiredUuid(candidate.roundId, "That round is unavailable."),
    sourceReference: requiredSourceReference(candidate.sourceReference),
  });
}

function capturedAtFromForm(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return value;
  const candidate = value.trim();
  return LOCAL_UTC_DATE_TIME_PATTERN.test(candidate)
    ? `${candidate}${candidate.length === 16 ? ":00" : ""}.000Z`
    : candidate;
}

export function winStreakResultSubmissionFromFormData(
  formData: FormData,
  now: Date,
): ValidatedWinStreakResultSubmission {
  const results: Array<{ fixtureId: string; result: FormDataEntryValue }> = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("result:")) {
      results.push({ fixtureId: key.slice("result:".length), result: value });
    }
  }
  return parseWinStreakResultSubmission(
    {
      capturedAt: capturedAtFromForm(formData.get("capturedAt")),
      results,
      roundId: formData.get("roundId"),
      sourceReference: formData.get("sourceReference"),
    },
    now,
  );
}

export function winStreakResultContentHash(
  results: readonly WinStreakResultFact[],
): string {
  const normalized = [...results]
    .sort((left, right) => left.fixtureId.localeCompare(right.fixtureId))
    .map((result) => `${result.fixtureId}|${result.result}`)
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

export function allWinStreakFixtureKickoffsHavePassed(
  kickoffAts: readonly Date[],
  now: Date,
): boolean {
  return (
    kickoffAts.length === FIXTURE_COUNT &&
    Number.isFinite(now.valueOf()) &&
    kickoffAts.every(
      (kickoffAt) =>
        Number.isFinite(kickoffAt.valueOf()) &&
        kickoffAt.getTime() <= now.getTime(),
    )
  );
}

export function buildResolveWinStreakRoundQuery({
  auditId = randomUUID(),
  capturedAt,
  requestId,
  results,
  roundId,
  seasonId,
  sourceReference,
}: ResolveWinStreakRoundInput): SQL {
  const serializedResults = JSON.stringify(
    results.map(({ fixtureId, result }) => ({
      fixture_id: fixtureId,
      result,
    })),
  );
  const contentHash = winStreakResultContentHash(results);

  return sql`
    with "input_results" as materialized (
      select "fixture_id", "result"
      from jsonb_to_recordset(${serializedResults}::jsonb) as input(
        "fixture_id" uuid,
        "result" text
      )
    ), "locked_round" as materialized (
      select
        round."id",
        round."season_id",
        round."matchweek",
        round."pick_deadline"
      from "win_streak_rounds" as round
      where round."id" = ${roundId}::uuid
        and round."season_id" = ${seasonId}::uuid
        and round."resolved_at" is null
      for update
    ), "checked_round" as materialized (
      select locked_round.*, clock_timestamp() as "checked_at"
      from "locked_round"
    ), "eligible_round" as materialized (
      select checked_round.*
      from "checked_round"
      where checked_round."pick_deadline" <= checked_round."checked_at"
        and ${capturedAt.toISOString()}::timestamptz <= checked_round."checked_at"
        and not exists (
          select 1
          from "win_streak_rounds" as prior_round
          where prior_round."season_id" = checked_round."season_id"
            and prior_round."matchweek" < checked_round."matchweek"
            and prior_round."resolved_at" is null
        )
        and (select count(*) from "input_results") = 10
        and (
          select count(*)
          from "win_streak_fixtures" as fixture
          where fixture."round_id" = checked_round."id"
            and fixture."result" is null
        ) = 10
        and not exists (
          select 1
          from "win_streak_fixtures" as unstarted_fixture
          where unstarted_fixture."round_id" = checked_round."id"
            and unstarted_fixture."kickoff_at" > checked_round."checked_at"
        )
        and not exists (
          select 1
          from "input_results" as input
          where input."result" not in ('home_win', 'draw', 'away_win', 'void')
            or not exists (
              select 1
              from "win_streak_fixtures" as fixture
              where fixture."id" = input."fixture_id"
                and fixture."round_id" = checked_round."id"
                and fixture."result" is null
            )
        )
        and not exists (
          select 1
          from "win_streak_fixtures" as fixture
          where fixture."round_id" = checked_round."id"
            and not exists (
              select 1
              from "input_results" as input
              where input."fixture_id" = fixture."id"
            )
        )
    ), "updated_fixtures" as (
      update "win_streak_fixtures" as fixture
      set
        "result" = input."result",
        "updated_at" = eligible_round."checked_at"
      from "input_results" as input, "eligible_round"
      where fixture."id" = input."fixture_id"
        and fixture."round_id" = eligible_round."id"
        and fixture."result" is null
      returning fixture."id", fixture."result"
    ), "resolved_round" as (
      update "win_streak_rounds" as round
      set
        "result_source" = 'owner-reviewed-source',
        "result_source_reference" = ${sourceReference},
        "result_captured_at" = ${capturedAt.toISOString()}::timestamptz,
        "result_content_hash" = ${contentHash},
        "resolved_at" = eligible_round."checked_at",
        "updated_at" = eligible_round."checked_at"
      from "eligible_round"
      where round."id" = eligible_round."id"
        and round."resolved_at" is null
        and (select count(*) from "updated_fixtures") = 10
      returning round."id", round."season_id", round."matchweek"
    ), "recorded_audit" as (
      insert into "admin_audit_logs" (
        "id", "season_id", "actor", "action", "target_type", "target_id",
        "request_id", "metadata", "created_at"
      )
      select
        ${auditId}::uuid,
        resolved_round."season_id",
        'admin',
        'win_streak.round_resolved',
        'win_streak_round',
        resolved_round."id"::text,
        ${requestId}::text,
        jsonb_build_object(
          'matchweek', resolved_round."matchweek",
          'fixtureCount', 10,
          'voidCount', (
            select count(*) from "updated_fixtures" where "result" = 'void'
          ),
          'sourceReference', ${sourceReference}::text,
          'capturedAt', ${capturedAt.toISOString()}::text
        ),
        (select "checked_at" from "eligible_round")
      from "resolved_round"
      returning "id"
    )
    select
      (
        (select count(*) from "updated_fixtures") = 10
        and exists (select 1 from "resolved_round")
        and exists (select 1 from "recorded_audit")
      ) as "applied",
      (select "matchweek" from "resolved_round" limit 1) as "matchweek"
  `;
}

export async function resolveWinStreakRoundAtomically(
  db: Database,
  input: ResolveWinStreakRoundInput,
): Promise<{ applied: boolean; matchweek: number | null }> {
  const result = await db.execute<ResolveWinStreakRoundRow>(
    buildResolveWinStreakRoundQuery(input),
  );
  const row = result.rows[0];
  return {
    applied: row?.applied === true,
    matchweek:
      typeof row?.matchweek === "number"
        ? row.matchweek
        : row?.matchweek
          ? Number(row.matchweek)
          : null,
  };
}
