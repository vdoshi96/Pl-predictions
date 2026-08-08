import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { and, eq, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { getDb, type Database } from "@/db/client";
import {
  seasons,
  standingsImportRunItems,
  standingsImportRuns,
  standingsItems,
  standingsSnapshots,
  teams,
} from "@/db/schema";
import {
  canonicalStandingsImportEnvelopeSchema,
  createCanonicalStandingsSnapshotSchema,
  findStandingsFutureTimestampViolation,
  STANDINGS_FUTURE_TIMESTAMP_ERROR_CODE,
} from "@/features/standings/validation";
import type {
  CanonicalStandingsFailure,
  CanonicalStandingsSnapshot,
} from "@/features/standings/types";

type ImportResult =
  | { runId: string; status: "duplicate"; snapshotId: string }
  | { runId: string; status: "failed" }
  | { runId: string; status: "succeeded"; snapshotId: string };

/**
 * Compare-and-swap guard for the single season row shared with admin
 * finalization. PostgreSQL rechecks this predicate after any concurrent row
 * updater commits, so whichever transition claims the row first wins.
 */
export function standingsActivationGuard({
  capturedAt,
  expectedActiveSnapshotId,
  expectedFinalSnapshotId = null,
  seasonId,
}: {
  capturedAt: Date;
  expectedActiveSnapshotId: string | null;
  expectedFinalSnapshotId?: string | null;
  seasonId: string;
}): SQL {
  return and(
    eq(seasons.id, seasonId),
    expectedFinalSnapshotId
      ? eq(seasons.finalSnapshotId, expectedFinalSnapshotId)
      : isNull(seasons.finalSnapshotId),
    expectedActiveSnapshotId
      ? eq(seasons.activeSnapshotId, expectedActiveSnapshotId)
      : isNull(seasons.activeSnapshotId),
    or(
      isNull(seasons.standingsAcceptedThrough),
      lt(seasons.standingsAcceptedThrough, capturedAt),
    ),
  )!;
}

function canonicalSnapshotJson(snapshot: CanonicalStandingsSnapshot): string {
  // Capture/provenance metadata and source finality claims are deliberately
  // excluded. Only standings facts define duplicate snapshot content.
  return JSON.stringify({
    matchweek: snapshot.matchweek,
    seasonSlug: snapshot.seasonSlug,
    standings: [...snapshot.standings]
      .sort((left, right) => left.actualPosition - right.actualPosition)
      .map((item) => ({
        actualPosition: item.actualPosition,
        leaguePoints: item.leaguePoints,
        playedGames: item.playedGames,
        teamSlug: item.teamSlug,
      })),
    version: snapshot.version,
  });
}

export function snapshotContentHash(
  snapshot: CanonicalStandingsSnapshot,
): string {
  return createHash("sha256")
    .update(canonicalSnapshotJson(snapshot), "utf8")
    .digest("hex");
}

function snapshotIdFromHash(contentHash: string): string {
  const characters = contentHash.slice(0, 32).split("");
  characters[12] = "5";
  characters[16] = (
    (Number.parseInt(characters[16] ?? "0", 16) & 0x3) |
    0x8
  ).toString(16);
  const hex = characters.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function recordFailedSourceRun(
  db: Database,
  seasonId: string,
  failure: CanonicalStandingsFailure,
): Promise<string> {
  const runId = randomUUID();
  const completedAt = new Date();

  await db.insert(standingsImportRuns).values({
    capturedAt: new Date(failure.observedAt),
    completedAt,
    errorCode: failure.code,
    errorMessage: failure.message,
    id: runId,
    seasonId,
    source: failure.source,
    status: "failed",
  });

  return runId;
}

async function recordNonSuccessfulSnapshotRun(
  db: Database,
  values: {
    capturedAt: Date;
    contentHash: string;
    errorCode?: string;
    errorMessage?: string;
    seasonId: string;
    snapshotId?: string;
    source: string;
    status: "duplicate" | "rejected";
  },
): Promise<string> {
  const runId = randomUUID();

  await db.insert(standingsImportRuns).values({
    capturedAt: values.capturedAt,
    completedAt: new Date(),
    contentHash: values.contentHash,
    errorCode: values.errorCode,
    errorMessage: values.errorMessage,
    id: runId,
    itemCount: 20,
    seasonId: values.seasonId,
    snapshotId: values.snapshotId,
    source: values.source,
    status: values.status,
  });

  return runId;
}

function isSameTimestamp(left: Date | null, right: Date): boolean {
  return left?.getTime() === right.getTime();
}

async function finishActivationAttempt(
  db: Database,
  values: {
    activationRows: Array<{ id: string }>;
    capturedAt: Date;
    runId: string;
    seasonId: string;
    snapshotId: string;
    successStatus: "duplicate" | "succeeded";
  },
): Promise<ImportResult> {
  if (values.activationRows.length > 0) {
    await db
      .update(standingsImportRuns)
      .set({
        completedAt: new Date(),
        snapshotId: values.snapshotId,
        status: values.successStatus,
      })
      .where(eq(standingsImportRuns.id, values.runId));

    return {
      runId: values.runId,
      snapshotId: values.snapshotId,
      status: values.successStatus,
    };
  }

  const [currentSeason] = await db
    .select({
      activeSnapshotId: seasons.activeSnapshotId,
      finalSnapshotId: seasons.finalSnapshotId,
      standingsAcceptedThrough: seasons.standingsAcceptedThrough,
    })
    .from(seasons)
    .where(eq(seasons.id, values.seasonId))
    .limit(1);

  if (
    currentSeason?.activeSnapshotId === values.snapshotId &&
    currentSeason.standingsAcceptedThrough !== null &&
    currentSeason.standingsAcceptedThrough >= values.capturedAt
  ) {
    await db
      .update(standingsImportRuns)
      .set({
        completedAt: new Date(),
        snapshotId: values.snapshotId,
        status: "duplicate",
      })
      .where(eq(standingsImportRuns.id, values.runId));

    return {
      runId: values.runId,
      snapshotId: values.snapshotId,
      status: "duplicate",
    };
  }

  await db
    .update(standingsImportRuns)
    .set({
      completedAt: new Date(),
      errorCode: currentSeason?.finalSnapshotId
        ? "season_finalized"
        : "activation_conflict",
      errorMessage: currentSeason?.finalSnapshotId
        ? "The season was finalized before this snapshot could be activated."
        : "The active standings changed before this snapshot could be activated.",
      status: "rejected",
    })
    .where(eq(standingsImportRuns.id, values.runId));

  // A complete, validated content row may remain as immutable history. Keeping
  // it avoids a delete/reactivate race with a concurrent identical observation.
  throw new Error(
    `Standings import ${values.runId} was rejected because the season state changed.`,
  );
}

export async function importCanonicalStandings(
  input: unknown,
  db: Database = getDb(),
): Promise<ImportResult> {
  const envelope = canonicalStandingsImportEnvelopeSchema.parse(input);

  const [season] = await db
    .select({
      activeSnapshotId: seasons.activeSnapshotId,
      databaseNow: sql`current_timestamp`.mapWith(
        standingsSnapshots.capturedAt,
      ),
      finalSnapshotId: seasons.finalSnapshotId,
      id: seasons.id,
      standingsAcceptedThrough: seasons.standingsAcceptedThrough,
    })
    .from(seasons)
    .where(eq(seasons.slug, envelope.seasonSlug))
    .limit(1);

  if (!season) {
    throw new Error(`Unknown season: ${envelope.seasonSlug}.`);
  }

  if (envelope.kind === "failure") {
    const runId = await recordFailedSourceRun(db, season.id, envelope);
    return { runId, status: "failed" };
  }

  const seasonTeams = await db
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(eq(teams.seasonId, season.id));
  const snapshot = createCanonicalStandingsSnapshotSchema(
    seasonTeams.map((team) => team.slug),
  ).parse(envelope);
  const contentHash = snapshotContentHash(snapshot);
  const capturedAt = new Date(snapshot.capturedAt);
  const futureTimestampViolation = findStandingsFutureTimestampViolation(
    snapshot,
    season.databaseNow,
  );

  if (futureTimestampViolation) {
    const runId = await recordNonSuccessfulSnapshotRun(db, {
      capturedAt,
      contentHash,
      errorCode: STANDINGS_FUTURE_TIMESTAMP_ERROR_CODE,
      errorMessage: `${futureTimestampViolation.field} exceeds the permitted five-minute future clock skew.`,
      seasonId: season.id,
      source: snapshot.source,
      status: "rejected",
    });
    throw new Error(
      `Standings import ${runId} was rejected because a timestamp is implausibly far in the future.`,
    );
  }

  const teamBySlug = new Map(
    seasonTeams.map((team) => [team.slug, team] as const),
  );
  const buildRunItems = (runId: string) =>
    [...snapshot.standings]
      .sort((left, right) => left.actualPosition - right.actualPosition)
      .map((item, index) => {
        const team = teamBySlug.get(item.teamSlug);
        if (!team) {
          throw new Error(`Unknown team after validation: ${item.teamSlug}.`);
        }

        return db.insert(standingsImportRunItems).values({
          actualPosition: item.actualPosition,
          leaguePoints: item.leaguePoints,
          ordinal: index + 1,
          playedGames: item.playedGames,
          runId,
          teamId: team.id,
          teamKey: item.teamSlug,
        });
      });

  const [existingSnapshot] = await db
    .select({ id: standingsSnapshots.id })
    .from(standingsSnapshots)
    .where(
      and(
        eq(standingsSnapshots.seasonId, season.id),
        eq(standingsSnapshots.contentHash, contentHash),
      ),
    )
    .limit(1);

  const isCurrentSnapshot = existingSnapshot?.id === season.activeSnapshotId;
  const isCurrentFinalSnapshot =
    isCurrentSnapshot && existingSnapshot?.id === season.finalSnapshotId;
  const acceptedThrough = season.standingsAcceptedThrough;
  const capturedTime = capturedAt.getTime();
  const acceptedTime = acceptedThrough?.getTime();

  if (
    acceptedTime !== undefined &&
    (capturedTime < acceptedTime ||
      (capturedTime === acceptedTime && !isCurrentSnapshot))
  ) {
    const runId = await recordNonSuccessfulSnapshotRun(db, {
      capturedAt,
      contentHash,
      errorCode: "stale_snapshot",
      errorMessage:
        "The snapshot capture time is older than the latest accepted standings observation.",
      seasonId: season.id,
      source: snapshot.source,
      status: "rejected",
    });
    throw new Error(`Standings import ${runId} was rejected as stale.`);
  }

  if (isCurrentSnapshot && isSameTimestamp(acceptedThrough, capturedAt)) {
    const runId = await recordNonSuccessfulSnapshotRun(db, {
      capturedAt,
      contentHash,
      seasonId: season.id,
      snapshotId: existingSnapshot.id,
      source: snapshot.source,
      status: "duplicate",
    });
    return { runId, snapshotId: existingSnapshot.id, status: "duplicate" };
  }

  if (season.finalSnapshotId && !isCurrentFinalSnapshot) {
    const runId = await recordNonSuccessfulSnapshotRun(db, {
      capturedAt,
      contentHash,
      errorCode: "season_finalized",
      errorMessage: "A final snapshot is already active for this season.",
      seasonId: season.id,
      source: snapshot.source,
      status: "rejected",
    });
    throw new Error(
      `Standings import ${runId} was rejected because the season is final.`,
    );
  }

  if (existingSnapshot) {
    const runId = randomUUID();
    const insertRun = db.insert(standingsImportRuns).values({
      capturedAt,
      contentHash,
      id: runId,
      itemCount: snapshot.standings.length,
      seasonId: season.id,
      source: snapshot.source,
      status: "received",
    });
    const acceptObservation = db
      .update(seasons)
      .set({
        activeSnapshotId: existingSnapshot.id,
        standingsAcceptedThrough: capturedAt,
        updatedAt: new Date(),
      })
      .where(
        standingsActivationGuard({
          capturedAt,
          expectedActiveSnapshotId: season.activeSnapshotId,
          expectedFinalSnapshotId: isCurrentFinalSnapshot
            ? existingSnapshot.id
            : null,
          seasonId: season.id,
        }),
      )
      .returning({ id: seasons.id });
    const batchResults = await db.batch([
      insertRun,
      ...buildRunItems(runId),
      acceptObservation,
    ] as unknown as readonly [BatchItem<"pg">, ...BatchItem<"pg">[]]);
    const activationRows = batchResults.at(-1) as unknown as Array<{
      id: string;
    }>;

    return finishActivationAttempt(db, {
      activationRows,
      capturedAt,
      runId,
      seasonId: season.id,
      snapshotId: existingSnapshot.id,
      successStatus: isCurrentSnapshot ? "duplicate" : "succeeded",
    });
  }

  const runId = randomUUID();
  const snapshotId = snapshotIdFromHash(contentHash);

  const insertRun = db.insert(standingsImportRuns).values({
    capturedAt,
    contentHash,
    id: runId,
    itemCount: snapshot.standings.length,
    seasonId: season.id,
    source: snapshot.source,
    status: "received",
  });
  const insertSnapshot = db
    .insert(standingsSnapshots)
    .values({
      capturedAt,
      contentHash,
      id: snapshotId,
      // Source completion flags are only candidates. An administrator must
      // explicitly confirm final status after inspecting a 38-game table.
      isFinal: false,
      matchweek: snapshot.matchweek,
      seasonId: season.id,
      source: snapshot.source,
      sourceReference: snapshot.sourceReference,
      sourceUpdatedAt: snapshot.sourceUpdatedAt
        ? new Date(snapshot.sourceUpdatedAt)
        : null,
    })
    .onConflictDoNothing({
      target: [standingsSnapshots.seasonId, standingsSnapshots.contentHash],
    })
    .returning({ id: standingsSnapshots.id });
  const insertStandingsItems = snapshot.standings.map((item) => {
    const team = teamBySlug.get(item.teamSlug);
    if (!team) {
      throw new Error(`Unknown team after validation: ${item.teamSlug}.`);
    }

    return db
      .insert(standingsItems)
      .values({
        actualPosition: item.actualPosition,
        leaguePoints: item.leaguePoints,
        playedGames: item.playedGames,
        snapshotId,
        teamId: team.id,
      })
      .onConflictDoNothing();
  });
  const insertRunItems = buildRunItems(runId);
  const activateSnapshot = db
    .update(seasons)
    .set({
      activeSnapshotId: snapshotId,
      standingsAcceptedThrough: capturedAt,
      updatedAt: new Date(),
    })
    .where(
      standingsActivationGuard({
        capturedAt,
        expectedActiveSnapshotId: season.activeSnapshotId,
        seasonId: season.id,
      }),
    )
    .returning({ id: seasons.id });

  const statements: BatchItem<"pg">[] = [
    insertRun,
    insertSnapshot,
    ...insertStandingsItems,
    ...insertRunItems,
    activateSnapshot,
  ];
  const batchResults = await db.batch(
    statements as unknown as readonly [BatchItem<"pg">, ...BatchItem<"pg">[]],
  );

  const activationRows = batchResults.at(-1) as unknown as Array<{
    id: string;
  }>;

  return finishActivationAttempt(db, {
    activationRows,
    capturedAt,
    runId,
    seasonId: season.id,
    snapshotId,
    successStatus: "succeeded",
  });
}

async function readInput(path: string | undefined): Promise<string> {
  if (path) return readFile(path, "utf8");

  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main(): Promise<void> {
  const rawInput = await readInput(process.argv[2]);
  const parsed: unknown = JSON.parse(rawInput);
  const result = await importCanonicalStandings(parsed);
  process.stdout.write(`Standings import ${result.status}: ${result.runId}.\n`);
  if (result.status === "failed") process.exitCode = 1;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown standings import error";
    process.stderr.write(`Standings import failed: ${message}\n`);
    process.exitCode = 1;
  });
}
