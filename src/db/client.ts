import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let database: Database | undefined;

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return databaseUrl;
}

/**
 * Lazily creates one Neon HTTP client per runtime instance. Importing a module
 * that references the database does not connect or require DATABASE_URL.
 */
export function getDb(): Database {
  database ??= drizzle(neon(requireDatabaseUrl()), { schema });
  return database;
}

export function resetDbForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The database client can only be reset in tests.");
  }

  database = undefined;
}
