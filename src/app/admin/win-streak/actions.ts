"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { getAdminAuditMetadata, requireAdminMutation } from "@/features/admin";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import {
  resolveWinStreakRoundAtomically,
  winStreakResultSubmissionFromFormData,
} from "@/features/win-streak/results";
import { PublicError, safeErrorMessage } from "@/shared/errors";

import type { WinStreakResultActionState } from "./action-state";

export async function resolveWinStreakRoundAction(
  _previousState: WinStreakResultActionState,
  formData: FormData,
): Promise<WinStreakResultActionState> {
  try {
    await requireAdminMutation();
    const { databaseNow, season } = await getActiveSeasonContext();
    const submission = winStreakResultSubmissionFromFormData(
      formData,
      databaseNow,
    );
    const audit = await getAdminAuditMetadata();
    const resolved = await resolveWinStreakRoundAtomically(getDb(), {
      ...submission,
      requestId: audit.requestId,
      seasonId: season.id,
    });
    if (!resolved.applied || resolved.matchweek === null) {
      throw new PublicError(
        "CONFLICT",
        "The round changed or is not ready. Review the current results and try again.",
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/win-streak");
    revalidatePath("/win-streak");
    return {
      message: `Matchweek ${resolved.matchweek} results are locked.`,
      ok: true,
    };
  } catch (error) {
    return { message: safeErrorMessage(error), ok: false };
  }
}
