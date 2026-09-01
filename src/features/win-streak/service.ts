import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db/client";
import { normalizedParticipantNameKey } from "@/features/predictions/normalization";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { PublicError } from "@/shared/errors";

import {
  insertWinStreakPickAtomically,
  insertWinStreakProfileAtomically,
} from "./atomic";
import {
  createWinStreakReceiptToken,
  hashWinStreakReceiptToken,
  readWinStreakReceipt,
} from "./receipt";
import {
  createWinStreakProfileInputSchema,
  winStreakPickInputSchema,
} from "./validation";
import type { WinStreakTeamSlug } from "./fixtures";

type DatabaseErrorFact = {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
};

function databaseErrorFact(
  error: unknown,
  seen = new Set<object>(),
): DatabaseErrorFact | null {
  if (typeof error !== "object" || error === null || seen.has(error)) {
    return null;
  }
  seen.add(error);
  const fact = error as DatabaseErrorFact;
  if (typeof fact.code === "string" || typeof fact.constraint === "string") {
    return fact;
  }
  return databaseErrorFact(fact.cause, seen);
}

function pickDatabaseError(error: unknown): PublicError | null {
  const fact = databaseErrorFact(error);
  const constraint =
    typeof fact?.constraint === "string" ? fact.constraint : "";
  if (
    fact?.code === "23505" ||
    constraint === "win_streak_picks_profile_round_unique"
  ) {
    return new PublicError(
      "CONFLICT",
      "You already locked a pick for this matchweek.",
    );
  }
  if (
    constraint === "win_streak_picks_deadline_check" ||
    constraint === "win_streak_picks_current_round_check"
  ) {
    return new PublicError(
      "SUBMISSIONS_CLOSED",
      "The Win Streak pick deadline has passed for this matchweek.",
    );
  }
  if (constraint === "win_streak_picks_club_reuse_check") {
    return new PublicError(
      "CONFLICT",
      "That club has already won during your current streak. Choose another club.",
    );
  }
  return null;
}

export type CreatedWinStreakProfile = {
  displayName: string;
  profileId: string;
  receiptToken: string;
};

export async function createWinStreakProfile(
  input: unknown,
): Promise<CreatedWinStreakProfile> {
  const parsed = createWinStreakProfileInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new PublicError(
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ??
        "Check your display name and try again.",
    );
  }
  if (parsed.data.website.trim() !== "") {
    throw new PublicError(
      "BAD_REQUEST",
      "We could not create that profile. Refresh and try again.",
    );
  }

  const { season } = await getActiveSeasonContext();
  const profileId = randomUUID();
  const receiptToken = createWinStreakReceiptToken();
  try {
    const profile = await insertWinStreakProfileAtomically(getDb(), {
      id: profileId,
      normalizedParticipantName: normalizedParticipantNameKey(
        parsed.data.displayName,
      ),
      participantName: parsed.data.displayName,
      receiptTokenHash: hashWinStreakReceiptToken(receiptToken),
      seasonId: season.id,
    });
    if (!profile) {
      throw new PublicError(
        "SUBMISSIONS_CLOSED",
        "Win Streak cannot accept another profile right now.",
      );
    }
    return {
      displayName: profile.displayName,
      profileId: profile.profileId,
      receiptToken,
    };
  } catch (error) {
    if (error instanceof PublicError) throw error;
    const fact = databaseErrorFact(error);
    if (fact?.code === "23505") {
      throw new PublicError(
        "CONFLICT",
        "We could not continue with that Win Streak profile. Try again.",
      );
    }
    throw error;
  }
}

export async function submitWinStreakPick(input: unknown): Promise<{
  teamSlug: WinStreakTeamSlug;
}> {
  const parsed = winStreakPickInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new PublicError(
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Choose an available club.",
    );
  }
  const receipt = await readWinStreakReceipt();
  if (!receipt) {
    throw new PublicError(
      "UNAUTHORIZED",
      "This browser does not have a Win Streak profile.",
    );
  }

  try {
    const inserted = await insertWinStreakPickAtomically(getDb(), {
      id: randomUUID(),
      profileId: receipt.profileId,
      receiptTokenHash: hashWinStreakReceiptToken(receipt.token),
      teamSlug: parsed.data.teamSlug,
    });
    if (!inserted) {
      throw new PublicError(
        "CONFLICT",
        "That pick is no longer available. Refresh and try again.",
      );
    }
  } catch (error) {
    if (error instanceof PublicError) throw error;
    const mapped = pickDatabaseError(error);
    if (mapped) throw mapped;
    throw error;
  }

  return { teamSlug: parsed.data.teamSlug };
}
