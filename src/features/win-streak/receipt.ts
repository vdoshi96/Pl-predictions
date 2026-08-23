import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { isLocalHttpE2EEnvironment } from "@/shared/runtime-environment";

const WIN_STREAK_RECEIPT_COOKIE = "pl_win_streak_receipt";
const RECEIPT_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
const receiptValueSchema = z
  .string()
  .max(100)
  .transform((value) => {
    const separator = value.indexOf(".");
    return {
      profileId: value.slice(0, separator),
      separator,
      token: value.slice(separator + 1),
    };
  })
  .refine(
    ({ profileId, separator, token }) =>
      separator > 0 &&
      z.uuid().safeParse(profileId).success &&
      /^[A-Za-z0-9_-]{43}$/u.test(token),
  )
  .transform(({ profileId, token }) => ({ profileId, token }));

function shouldUseSecureCookies() {
  return (
    process.env.NODE_ENV === "production" &&
    !isLocalHttpE2EEnvironment(process.env)
  );
}

export function createWinStreakReceiptToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashWinStreakReceiptToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function receiptMatchesHash(
  token: string,
  expectedTokenHash: string,
): boolean {
  if (!/^[a-f\d]{64}$/u.test(expectedTokenHash)) return false;
  const actual = Buffer.from(hashWinStreakReceiptToken(token), "hex");
  const expected = Buffer.from(expectedTokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function setWinStreakReceiptCookie(
  profileId: string,
  token: string,
): Promise<void> {
  const store = await cookies();
  store.set(WIN_STREAK_RECEIPT_COOKIE, `${profileId}.${token}`, {
    httpOnly: true,
    maxAge: RECEIPT_MAX_AGE_SECONDS,
    path: "/win-streak",
    sameSite: "strict",
    secure: shouldUseSecureCookies(),
  });
}

export async function readWinStreakReceipt(): Promise<{
  profileId: string;
  token: string;
} | null> {
  const value = (await cookies()).get(WIN_STREAK_RECEIPT_COOKIE)?.value;
  if (!value) return null;
  const parsed = receiptValueSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
