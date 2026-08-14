"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { getAdminAuditMetadata, requireAdminMutation } from "@/features/admin";
import {
  closeSeasonPermanentlyAtomically,
  parseSeasonClosureIntent,
} from "@/features/seasons/closure";
import { getActiveSeasonContext } from "@/features/seasons/queries";

export type CloseSeasonActionState = Readonly<{
  changed: boolean;
  message: string;
  ok: boolean;
}>;

function revalidateSeasonViews() {
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/spotlight");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
}

/**
 * Permanently closes submissions and reveals predictions in one compare-and-
 * swap statement. The audit exists only when this request wins the transition.
 */
export async function closeSeasonPermanently(
  _previousState: CloseSeasonActionState,
  formData: FormData,
): Promise<CloseSeasonActionState> {
  await requireAdminMutation();
  const intent = parseSeasonClosureIntent({
    confirmationPhrase: formData.get("confirmationPhrase"),
    intent: formData.get("intent"),
  });

  if (!intent) {
    return {
      changed: false,
      message: "Type the exact confirmation phrase before continuing.",
      ok: false,
    };
  }

  const { season } = await getActiveSeasonContext();
  const audit = await getAdminAuditMetadata();
  const changed = await closeSeasonPermanentlyAtomically(getDb(), {
    intent,
    requestId: audit.requestId,
    seasonId: season.id,
  });

  if (!changed) {
    return {
      changed: false,
      message:
        "Submissions are already permanently closed. No change or audit was recorded.",
      ok: true,
    };
  }

  revalidateSeasonViews();
  return {
    changed: true,
    message:
      intent === "lock"
        ? "Submissions are permanently locked and predictions are now public."
        : "Predictions are public and submissions are permanently closed.",
    ok: true,
  };
}
