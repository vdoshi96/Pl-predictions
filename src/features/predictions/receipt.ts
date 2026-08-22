import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { isLocalHttpE2EEnvironment } from "@/shared/runtime-environment";

const RECEIPT_COOKIE = "pl_prediction_receipt";
const RECEIPT_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

function shouldUseSecureCookies() {
  return (
    process.env.NODE_ENV === "production" &&
    !isLocalHttpE2EEnvironment(process.env)
  );
}

export function createReceiptToken() {
  return randomBytes(32).toString("base64url");
}

export function hashReceiptToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function setReceiptCookie(predictionId: string, token: string) {
  const store = await cookies();
  store.set(RECEIPT_COOKIE, `${predictionId}.${token}`, {
    httpOnly: true,
    maxAge: RECEIPT_MAX_AGE_SECONDS,
    path: "/entries",
    sameSite: "strict",
    secure: shouldUseSecureCookies(),
  });
}

export async function hasPredictionReceipt(
  predictionId: string,
  expectedTokenHash: string,
) {
  const value = (await cookies()).get(RECEIPT_COOKIE)?.value;
  if (!value) return false;

  const separator = value.indexOf(".");
  if (separator === -1) return false;

  const cookiePredictionId = value.slice(0, separator);
  const token = value.slice(separator + 1);
  if (cookiePredictionId !== predictionId || !token) return false;

  const actual = Buffer.from(hashReceiptToken(token), "hex");
  const expected = Buffer.from(expectedTokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
