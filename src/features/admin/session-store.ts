import "server-only";

import { and, eq, gt, lte } from "drizzle-orm";

import { getDb } from "@/db/client";
import { adminSessions } from "@/db/schema";

export async function registerAdminSession(
  id: string,
  expiresAt: Date,
): Promise<void> {
  const db = getDb();
  await db
    .delete(adminSessions)
    .where(lte(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({ expiresAt, id });
}

export async function isAdminSessionActive(
  id: string,
  now = new Date(),
): Promise<boolean> {
  const [session] = await getDb()
    .select({ id: adminSessions.id })
    .from(adminSessions)
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, now)))
    .limit(1);
  return Boolean(session);
}

export async function revokeAdminSession(id: string): Promise<void> {
  await getDb().delete(adminSessions).where(eq(adminSessions.id, id));
}
