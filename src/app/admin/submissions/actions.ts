"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db/client";
import { getAdminAuditMetadata, requireAdminMutation } from "@/features/admin";
import { getActiveSeasonView } from "@/features/seasons/queries";

export async function deleteSubmission(formData: FormData) {
  await requireAdminMutation();
  const id = z.string().uuid().safeParse(formData.get("predictionId"));
  if (!id.success) redirect("/admin/submissions?error=invalid");

  const { season } = await getActiveSeasonView();
  const audit = await getAdminAuditMetadata();
  const db = getDb();
  const result = await db.execute<{ deleted: boolean }>(sql`
    with deleted_prediction as (
      delete from "predictions"
      where "id" = ${id.data}::uuid
        and "season_id" = ${season.id}::uuid
      returning "id"
    ),
    inserted_audit as (
      insert into "admin_audit_logs" (
        "season_id",
        "actor",
        "action",
        "target_type",
        "target_id",
        "request_id",
        "metadata"
      )
      select
        ${season.id}::uuid,
        'admin',
        'prediction.deleted',
        'prediction',
        deleted_prediction."id"::text,
        ${audit.requestId},
        jsonb_build_object()
      from deleted_prediction
      returning "id"
    )
    select exists (select 1 from inserted_audit) as "deleted"
  `);
  if (!result.rows[0]?.deleted) {
    redirect("/admin/submissions?error=missing");
  }

  revalidatePath("/leaderboard");
  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
  redirect("/admin/submissions?deleted=1");
}
