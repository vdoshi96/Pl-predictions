import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    competitionCode: varchar("competition_code", { length: 16 }).notNull(),
    startYear: integer("start_year").notNull(),
    openingKickoff: timestamp("opening_kickoff", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    submissionDeadline: timestamp("submission_deadline", {
      mode: "date",
      withTimezone: true,
    }),
    submissionsLocked: boolean("submissions_locked").default(false).notNull(),
    revealPredictions: boolean("reveal_predictions").default(false).notNull(),
    activeSnapshotId: uuid("active_snapshot_id").references(
      (): AnyPgColumn => standingsSnapshots.id,
      { onDelete: "set null" },
    ),
    finalSnapshotId: uuid("final_snapshot_id").references(
      (): AnyPgColumn => standingsSnapshots.id,
      { onDelete: "set null" },
    ),
    standingsAcceptedThrough: timestamp("standings_accepted_through", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seasons_slug_unique").on(table.slug),
    check(
      "seasons_start_year_check",
      sql`${table.startYear} between 1992 and 2200`,
    ),
    check(
      "seasons_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    externalId: integer("external_id"),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    shortName: varchar("short_name", { length: 40 }).notNull(),
    sortName: varchar("sort_name", { length: 80 }).notNull(),
    crestUrl: text("crest_url"),
    assetPath: text("asset_path").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("teams_season_slug_unique").on(table.seasonId, table.slug),
    uniqueIndex("teams_season_external_id_unique").on(
      table.seasonId,
      table.externalId,
    ),
    index("teams_season_sort_name_idx").on(table.seasonId, table.sortName),
    check(
      "teams_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "teams_external_id_check",
      sql`${table.externalId} is null or ${table.externalId} > 0`,
    ),
    check("teams_asset_path_check", sql`${table.assetPath} like '/%'`),
  ],
);

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    participantName: varchar("participant_name", { length: 40 }).notNull(),
    normalizedParticipantName: varchar("normalized_participant_name", {
      length: 40,
    }).notNull(),
    receiptTokenHash: varchar("receipt_token_hash", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("predictions_season_normalized_name_unique").on(
      table.seasonId,
      table.normalizedParticipantName,
    ),
    uniqueIndex("predictions_receipt_token_hash_unique").on(
      table.receiptTokenHash,
    ),
    index("predictions_season_created_at_idx").on(
      table.seasonId,
      table.createdAt,
    ),
    check(
      "predictions_participant_name_length_check",
      sql`char_length(${table.participantName}) between 2 and 40`,
    ),
    check(
      "predictions_normalized_name_length_check",
      sql`char_length(${table.normalizedParticipantName}) between 2 and 40`,
    ),
    check(
      "predictions_receipt_hash_check",
      sql`${table.receiptTokenHash} is null or char_length(${table.receiptTokenHash}) = 64`,
    ),
  ],
);

export const predictionItems = pgTable(
  "prediction_items",
  {
    predictionId: uuid("prediction_id")
      .notNull()
      .references(() => predictions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    predictedPosition: smallint("predicted_position").notNull(),
  },
  (table) => [
    primaryKey({
      name: "prediction_items_prediction_team_pk",
      columns: [table.predictionId, table.teamId],
    }),
    uniqueIndex("prediction_items_prediction_position_unique").on(
      table.predictionId,
      table.predictedPosition,
    ),
    index("prediction_items_team_id_idx").on(table.teamId),
    check(
      "prediction_items_position_check",
      sql`${table.predictedPosition} between 1 and 20`,
    ),
  ],
);

export const standingsSnapshots = pgTable(
  "standings_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 64 }).notNull(),
    sourceReference: text("source_reference"),
    capturedAt: timestamp("captured_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", {
      mode: "date",
      withTimezone: true,
    }),
    matchweek: smallint("matchweek"),
    isFinal: boolean("is_final").default(false).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("standings_snapshots_season_content_hash_unique").on(
      table.seasonId,
      table.contentHash,
    ),
    index("standings_snapshots_season_captured_at_idx").on(
      table.seasonId,
      table.capturedAt,
    ),
    index("standings_snapshots_season_final_idx").on(
      table.seasonId,
      table.isFinal,
    ),
    check(
      "standings_snapshots_matchweek_check",
      sql`${table.matchweek} is null or ${table.matchweek} between 1 and 38`,
    ),
    check(
      "standings_snapshots_content_hash_check",
      sql`char_length(${table.contentHash}) = 64`,
    ),
  ],
);

export const standingsItems = pgTable(
  "standings_items",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => standingsSnapshots.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    actualPosition: smallint("actual_position").notNull(),
    playedGames: smallint("played_games"),
    leaguePoints: smallint("league_points"),
  },
  (table) => [
    primaryKey({
      name: "standings_items_snapshot_team_pk",
      columns: [table.snapshotId, table.teamId],
    }),
    uniqueIndex("standings_items_snapshot_position_unique").on(
      table.snapshotId,
      table.actualPosition,
    ),
    index("standings_items_team_id_idx").on(table.teamId),
    check(
      "standings_items_position_check",
      sql`${table.actualPosition} between 1 and 20`,
    ),
    check(
      "standings_items_played_games_check",
      sql`${table.playedGames} is null or ${table.playedGames} between 0 and 38`,
    ),
    check(
      "standings_items_league_points_check",
      sql`${table.leaguePoints} is null or ${table.leaguePoints} between -100 and 114`,
    ),
  ],
);

export const standingsImportRuns = pgTable(
  "standings_import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    capturedAt: timestamp("captured_at", {
      mode: "date",
      withTimezone: true,
    }),
    contentHash: varchar("content_hash", { length: 64 }),
    snapshotId: uuid("snapshot_id").references(() => standingsSnapshots.id, {
      onDelete: "set null",
    }),
    itemCount: smallint("item_count").default(0).notNull(),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    index("standings_import_runs_season_created_at_idx").on(
      table.seasonId,
      table.createdAt,
    ),
    index("standings_import_runs_status_idx").on(table.status),
    index("standings_import_runs_snapshot_id_idx").on(table.snapshotId),
    check(
      "standings_import_runs_status_check",
      sql`${table.status} in ('received', 'succeeded', 'rejected', 'duplicate', 'failed')`,
    ),
    check(
      "standings_import_runs_item_count_check",
      sql`${table.itemCount} between 0 and 20`,
    ),
    check(
      "standings_import_runs_content_hash_check",
      sql`${table.contentHash} is null or char_length(${table.contentHash}) = 64`,
    ),
  ],
);

export const standingsImportRunItems = pgTable(
  "standings_import_run_items",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => standingsImportRuns.id, { onDelete: "cascade" }),
    ordinal: smallint("ordinal").notNull(),
    teamKey: varchar("team_key", { length: 64 }).notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    actualPosition: smallint("actual_position").notNull(),
    playedGames: smallint("played_games"),
    leaguePoints: smallint("league_points"),
  },
  (table) => [
    primaryKey({
      name: "standings_import_run_items_run_ordinal_pk",
      columns: [table.runId, table.ordinal],
    }),
    uniqueIndex("standings_import_run_items_run_team_unique").on(
      table.runId,
      table.teamKey,
    ),
    uniqueIndex("standings_import_run_items_run_position_unique").on(
      table.runId,
      table.actualPosition,
    ),
    index("standings_import_run_items_team_id_idx").on(table.teamId),
    check(
      "standings_import_run_items_ordinal_check",
      sql`${table.ordinal} between 1 and 20`,
    ),
    check(
      "standings_import_run_items_position_check",
      sql`${table.actualPosition} between 1 and 20`,
    ),
    check(
      "standings_import_run_items_played_games_check",
      sql`${table.playedGames} is null or ${table.playedGames} between 0 and 38`,
    ),
    check(
      "standings_import_run_items_league_points_check",
      sql`${table.leaguePoints} is null or ${table.leaguePoints} between -100 and 114`,
    ),
  ],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => seasons.id, {
      onDelete: "set null",
    }),
    actor: varchar("actor", { length: 64 }).notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: varchar("target_id", { length: 128 }),
    requestId: varchar("request_id", { length: 128 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("admin_audit_logs_season_created_at_idx").on(
      table.seasonId,
      table.createdAt,
    ),
    index("admin_audit_logs_action_created_at_idx").on(
      table.action,
      table.createdAt,
    ),
    index("admin_audit_logs_request_id_idx").on(table.requestId),
  ],
);

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;
export type PredictionItem = typeof predictionItems.$inferSelect;
export type NewPredictionItem = typeof predictionItems.$inferInsert;
export type StandingsSnapshot = typeof standingsSnapshots.$inferSelect;
export type NewStandingsSnapshot = typeof standingsSnapshots.$inferInsert;
export type StandingsItem = typeof standingsItems.$inferSelect;
export type NewStandingsItem = typeof standingsItems.$inferInsert;
export type StandingsImportRun = typeof standingsImportRuns.$inferSelect;
export type NewStandingsImportRun = typeof standingsImportRuns.$inferInsert;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
