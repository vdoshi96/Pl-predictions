"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { adminAuditLogs, seasons } from "@/db/schema";
import { getAdminAuditMetadata, requireAdminMutation } from "@/features/admin";
import { getActiveSeasonView } from "@/features/seasons/queries";

const settingsSchema = z.object({
  submissionDeadline: z
    .string()
    .trim()
    .regex(/^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/u)
    .max(16),
  submissionsLocked: z.boolean(),
  revealPredictions: z.boolean(),
});

function parseUtcDeadline(value: string) {
  if (!value) return null;
  const normalized = `${value}:00.000Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new Error("Invalid deadline");
  }
  return parsed;
}

export async function updateSeasonSettings(formData: FormData) {
  await requireAdminMutation();
  const { season } = await getActiveSeasonView();
  const parsed = settingsSchema.safeParse({
    submissionDeadline: formData.get("submissionDeadline") ?? "",
    submissionsLocked: formData.get("submissionsLocked") === "on",
    revealPredictions: formData.get("revealPredictions") === "on",
  });

  if (!parsed.success) redirect("/admin/settings?error=invalid");

  let deadline: Date | null;
  try {
    deadline = parseUtcDeadline(parsed.data.submissionDeadline);
  } catch {
    redirect("/admin/settings?error=deadline");
  }

  const audit = await getAdminAuditMetadata();
  const now = new Date();
  const db = getDb();
  const requestedDeadlinePassed = deadline
    ? sql<boolean>`${deadline} <= current_timestamp`
    : sql<boolean>`false`;
  const irreversibleClosure = sql<boolean>`(
    ${seasons.revealPredictions}
    or ${seasons.submissionsLocked}
    or (
      ${seasons.submissionDeadline} is not null
      and ${seasons.submissionDeadline} <= current_timestamp
    )
    or ${parsed.data.revealPredictions}
    or ${parsed.data.submissionsLocked}
    or ${requestedDeadlinePassed}
  )`;
  await db.batch([
    db
      .update(seasons)
      .set({
        revealPredictions: irreversibleClosure,
        submissionDeadline: deadline,
        submissionsLocked: irreversibleClosure,
        updatedAt: now,
      })
      .where(eq(seasons.id, season.id)),
    db.insert(adminAuditLogs).values({
      seasonId: season.id,
      actor: "admin",
      action: "season.settings.updated",
      targetType: "season",
      targetId: season.id,
      requestId: audit.requestId,
      metadata: {
        fairnessRule: "reveal-is-irreversible",
        requestedDeadline: deadline?.toISOString() ?? null,
        requestedRevealPredictions: parsed.data.revealPredictions,
        requestedSubmissionsLocked: parsed.data.submissionsLocked,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
