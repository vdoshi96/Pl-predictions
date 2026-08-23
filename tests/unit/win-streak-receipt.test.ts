import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nextHeadersMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => nextHeadersMocks);

import {
  hashWinStreakReceiptToken,
  readWinStreakReceipt,
  receiptMatchesHash,
  setWinStreakReceiptCookie,
} from "@/features/win-streak/receipt";

const PROFILE_ID = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "a".repeat(43);

let cookieStore: {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  cookieStore = { get: vi.fn(), set: vi.fn() };
  nextHeadersMocks.cookies.mockReset().mockResolvedValue(cookieStore);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Win Streak receipt cookie", () => {
  it("uses a strict HttpOnly cookie scoped to the game", async () => {
    await setWinStreakReceiptCookie(PROFILE_ID, TOKEN);

    expect(cookieStore.set).toHaveBeenCalledWith(
      "pl_win_streak_receipt",
      `${PROFILE_ID}.${TOKEN}`,
      expect.objectContaining({
        httpOnly: true,
        path: "/win-streak",
        sameSite: "strict",
        secure: false,
      }),
    );
  });

  it("parses only bounded UUID and token receipts", async () => {
    cookieStore.get.mockReturnValue({ value: `${PROFILE_ID}.${TOKEN}` });
    await expect(readWinStreakReceipt()).resolves.toEqual({
      profileId: PROFILE_ID,
      token: TOKEN,
    });

    for (const value of [
      "missing-separator",
      `not-a-uuid.${TOKEN}`,
      `${PROFILE_ID}.short`,
      `${PROFILE_ID}.${"x".repeat(200)}`,
    ]) {
      cookieStore.get.mockReturnValue({ value });
      await expect(readWinStreakReceipt()).resolves.toBeNull();
    }
  });

  it("compares the candidate hash without leaking partial matches", () => {
    const expected = hashWinStreakReceiptToken(TOKEN);
    expect(receiptMatchesHash(TOKEN, expected)).toBe(true);
    expect(receiptMatchesHash("b".repeat(43), expected)).toBe(false);
    expect(receiptMatchesHash(TOKEN, "not-a-hash")).toBe(false);
  });

  it("marks the receipt Secure in production except for the local E2E harness", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await setWinStreakReceiptCookie(PROFILE_ID, TOKEN);
    expect(cookieStore.set.mock.calls[0]?.[2]).toMatchObject({ secure: true });

    vi.stubEnv("LOCAL_HTTP_E2E", "1");
    await setWinStreakReceiptCookie(PROFILE_ID, TOKEN);
    expect(cookieStore.set.mock.calls[1]?.[2]).toMatchObject({ secure: false });
  });
});
