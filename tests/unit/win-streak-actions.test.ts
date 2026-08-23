import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  headers: vi.fn(),
  pick: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  requireSameOrigin: vi.fn(),
  setReceipt: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/admin", () => ({
  requireSameOrigin: mocks.requireSameOrigin,
}));
vi.mock("@/features/security/rate-limit", () => ({
  reserveSecurityAttempt: mocks.rateLimit,
}));
vi.mock("@/features/win-streak/receipt", () => ({
  setWinStreakReceiptCookie: mocks.setReceipt,
}));
vi.mock("@/features/win-streak/service", () => ({
  createWinStreakProfile: mocks.createProfile,
  submitWinStreakPick: mocks.pick,
}));

import {
  createWinStreakProfileAction,
  submitWinStreakPickAction,
} from "@/app/actions/win-streak";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ origin: "https://test" }));
  mocks.rateLimit.mockResolvedValue({ allowed: true, keyHash: "a".repeat(64) });
  mocks.createProfile.mockResolvedValue({
    displayName: "Ada",
    profileId: "00000000-0000-4000-8000-000000000001",
    receiptToken: "r".repeat(43),
  });
  mocks.pick.mockResolvedValue({ teamSlug: "arsenal" });
});

describe("Win Streak server actions", () => {
  it("protects profile creation, rate limits it, and sets the receipt after success", async () => {
    await expect(
      createWinStreakProfileAction({ displayName: "Ada", website: "" }),
    ).resolves.toEqual({
      message: "Ada is ready for Win Streak.",
      ok: true,
    });

    expect(mocks.requireSameOrigin).toHaveBeenCalledOnce();
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "win_streak_create" }),
    );
    expect(mocks.setReceipt).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "r".repeat(43),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/win-streak");
  });

  it("fails closed before creation when the rate limit is exhausted", async () => {
    mocks.rateLimit.mockResolvedValue({
      allowed: false,
      keyHash: "a".repeat(64),
    });
    await expect(
      createWinStreakProfileAction({ displayName: "Ada", website: "" }),
    ).resolves.toMatchObject({ ok: false });
    expect(mocks.createProfile).not.toHaveBeenCalled();
    expect(mocks.setReceipt).not.toHaveBeenCalled();
  });

  it("protects and revalidates an immutable pick", async () => {
    await expect(
      submitWinStreakPickAction({ teamSlug: "arsenal" }),
    ).resolves.toEqual({
      message: "Pick locked: Arsenal. It is now visible on the leaderboard.",
      ok: true,
    });
    expect(mocks.requireSameOrigin).toHaveBeenCalledOnce();
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "win_streak_pick" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/win-streak");
  });
});
