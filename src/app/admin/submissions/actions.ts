"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db/client";
import { adminAuditLogs, predictions } from "@/db/schema";
import { getAdminAuditMetadata, requireAdminMutation } from "@/features/admin";
import { getActiveSeasonView } from "@/features/seasons/queries";

export async function deleteSubmission(formData: FormData) {
  await requireAdminMutation();
  const id = z.string().uuid().safeParse(formData.get("predictionId"));
  if (!id.success) redirect("/admin/submissions?error=invalid");

  const { season } = await getActiveSeasonView();
  const audit = await getAdminAuditMetadata();
  const db = getDb();
  await db.batch([
    db
      .delete(predictions)
      .where(
        and(eq(predictions.id, id.data), eq(predictions.seasonId, season.id)),
      ),
    db.insert(adminAuditLogs).values({
      seasonId: season.id,
      actor: "admin",
      action: "prediction.deleted",
      targetType: "prediction",
      targetId: id.data,
      requestId: audit.requestId,
      metadata: {},
    }),
  ]);

  revalidatePath("/leaderboard");
  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
  redirect("/admin/submissions?deleted=1");
}
