"use server";

import type {
  PredictionSubmissionPayload,
  PredictionSubmissionResult,
} from "@/features/predictions/prediction-form";
import { setReceiptCookie } from "@/features/predictions/receipt";
import { createPrediction } from "@/features/predictions/service";
import { safeErrorMessage } from "@/shared/errors";

export async function submitPrediction(
  payload: PredictionSubmissionPayload,
): Promise<PredictionSubmissionResult> {
  try {
    const created = await createPrediction(payload);
    await setReceiptCookie(created.id, created.receiptToken);

    return {
      ok: true,
      entryId: created.id,
      message:
        "Your final table is safely stored. Only you can view it before predictions are revealed.",
    };
  } catch (error) {
    return { ok: false, message: safeErrorMessage(error) };
  }
}
