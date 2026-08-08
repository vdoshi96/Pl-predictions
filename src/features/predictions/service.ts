import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getDb } from "@/db/client";
import { PublicError } from "@/shared/errors";
import { getSeasonAccess } from "@/shared/policy";

import { getActiveSeasonView } from "../seasons/queries";
import { insertPredictionAtomically } from "./atomic-insert";
import { normalizedParticipantNameKey } from "./normalization";
import { createReceiptToken, hashReceiptToken } from "./receipt";
import {
  createPredictionItemsSchema,
  participantNameSchema,
} from "./validation";

function inputSchema(activeTeamIds: readonly string[]) {
  return z
    .object({
      honeypot: z.string().max(200).default(""),
      items: createPredictionItemsSchema(activeTeamIds),
      participantName: participantNameSchema,
    })
    .strict();
}

function hasDatabaseErrorCode(
  error: unknown,
  code: string,
  seen = new Set<object>(),
): boolean {
  if (typeof error !== "object" || error === null || seen.has(error)) {
    return false;
  }

  seen.add(error);
  if ("code" in error && error.code === code) return true;

  return "cause" in error
    ? hasDatabaseErrorCode(error.cause, code, seen)
    : false;
}

export type CreatedPrediction = {
  id: string;
  participantName: string;
  receiptToken: string;
};

export async function createPrediction(
  input: unknown,
  now = new Date(),
): Promise<CreatedPrediction> {
  const { season, teams } = await getActiveSeasonView();
  const access = getSeasonAccess(
    {
      revealPredictions: season.revealPredictions,
      submissionDeadline: season.submissionDeadline,
      submissionsLocked: season.submissionsLocked,
    },
    now,
  );

  if (!access.submissionsOpen) {
    throw new PublicError(
      "SUBMISSIONS_CLOSED",
      "Predictions are closed for this season.",
    );
  }

  const parsed = inputSchema(teams.map((team) => team.id)).safeParse(input);
  if (!parsed.success) {
    throw new PublicError(
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Check your prediction and try again.",
    );
  }

  if (parsed.data.honeypot.trim() !== "") {
    throw new PublicError(
      "BAD_REQUEST",
      "We could not accept this prediction. Refresh and try again.",
    );
  }

  const predictionId = randomUUID();
  const receiptToken = createReceiptToken();
  const normalizedName = normalizedParticipantNameKey(
    parsed.data.participantName,
  );
  const db = getDb();

  try {
    const inserted = await insertPredictionAtomically(db, {
      id: predictionId,
      items: parsed.data.items,
      normalizedParticipantName: normalizedName,
      participantName: parsed.data.participantName,
      receiptTokenHash: hashReceiptToken(receiptToken),
      seasonId: season.id,
    });

    if (!inserted) {
      throw new PublicError(
        "SUBMISSIONS_CLOSED",
        "Predictions are closed for this season.",
      );
    }
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) {
      throw new PublicError(
        "CONFLICT",
        "That display name has already submitted a prediction this season.",
      );
    }

    throw error;
  }

  return {
    id: predictionId,
    participantName: parsed.data.participantName,
    receiptToken,
  };
}
