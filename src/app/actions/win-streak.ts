"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireSameOrigin } from "@/features/admin";
import { reserveSecurityAttempt } from "@/features/security/rate-limit";
import { getWinStreakTeam } from "@/features/win-streak/fixtures";
import { setWinStreakReceiptCookie } from "@/features/win-streak/receipt";
import {
  createWinStreakProfile,
  submitWinStreakPick,
} from "@/features/win-streak/service";
import type { WinStreakActionResult } from "@/features/win-streak/view-model";
import { PublicError, safeErrorMessage } from "@/shared/errors";

async function reserveAttempt(
  scope: "win_streak_create" | "win_streak_pick",
): Promise<void> {
  const result = await reserveSecurityAttempt({
    blockSeconds: 15 * 60,
    limit: scope === "win_streak_create" ? 8 : 60,
    requestHeaders: await headers(),
    scope,
    windowSeconds: 15 * 60,
  });
  if (!result.allowed) {
    throw new PublicError(
      "FORBIDDEN",
      "Too many Win Streak attempts. Wait a few minutes and try again.",
    );
  }
}

export async function createWinStreakProfileAction(
  input: unknown,
): Promise<WinStreakActionResult> {
  try {
    await requireSameOrigin();
    await reserveAttempt("win_streak_create");
    const created = await createWinStreakProfile(input);
    await setWinStreakReceiptCookie(created.profileId, created.receiptToken);
    revalidatePath("/win-streak");
    return {
      message: `${created.displayName} is ready for Win Streak.`,
      ok: true,
    };
  } catch (error) {
    return { message: safeErrorMessage(error), ok: false };
  }
}

export async function submitWinStreakPickAction(
  input: unknown,
): Promise<WinStreakActionResult> {
  try {
    await requireSameOrigin();
    await reserveAttempt("win_streak_pick");
    const picked = await submitWinStreakPick(input);
    const team = getWinStreakTeam(picked.teamSlug);
    revalidatePath("/win-streak");
    return {
      message: `Pick locked: ${team.displayName}. It is now visible on the leaderboard.`,
      ok: true,
    };
  } catch (error) {
    return { message: safeErrorMessage(error), ok: false };
  }
}
