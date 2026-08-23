import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSeasonContext: vi.fn(),
  getDb: vi.fn(),
  insertPick: vi.fn(),
  insertProfile: vi.fn(),
  readReceipt: vi.fn(),
}));

vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/features/seasons/queries", () => ({
  getActiveSeasonContext: mocks.getActiveSeasonContext,
}));
vi.mock("@/features/win-streak/atomic", () => ({
  insertWinStreakPickAtomically: mocks.insertPick,
  insertWinStreakProfileAtomically: mocks.insertProfile,
}));
vi.mock("@/features/win-streak/receipt", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/win-streak/receipt")>();
  return { ...original, readWinStreakReceipt: mocks.readReceipt };
});

import {
  createWinStreakProfile,
  submitWinStreakPick,
} from "@/features/win-streak/service";

const seasonId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReturnValue({});
  mocks.getActiveSeasonContext.mockResolvedValue({
    databaseNow: new Date("2026-08-23T12:00:00.000Z"),
    season: { id: seasonId },
  });
  mocks.insertProfile.mockResolvedValue(true);
  mocks.insertPick.mockResolvedValue(true);
  mocks.readReceipt.mockResolvedValue({
    profileId: "00000000-0000-4000-8000-000000000002",
    token: "a".repeat(43),
  });
});

describe("Win Streak public service", () => {
  it("creates a normalized profile with a hashed receipt", async () => {
    const created = await createWinStreakProfile({
      displayName: "  Ada   LOVELACE  ",
      website: "",
    });

    expect(created).toMatchObject({ displayName: "Ada LOVELACE" });
    expect(created.profileId).toMatch(
      /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u,
    );
    expect(created.receiptToken).toHaveLength(43);
    expect(mocks.insertProfile).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        normalizedParticipantName: "ada lovelace",
        participantName: "Ada LOVELACE",
        receiptTokenHash: expect.stringMatching(/^[\da-f]{64}$/u),
        seasonId,
      }),
    );
  });

  it("rejects malformed and bot input before database access", async () => {
    await expect(
      createWinStreakProfile({ displayName: "a", website: "" }),
    ).rejects.toThrow();
    await expect(
      createWinStreakProfile({ displayName: "Ada", website: "filled" }),
    ).rejects.toThrow("Refresh and try again");
    expect(mocks.getActiveSeasonContext).not.toHaveBeenCalled();
  });

  it("returns a name conflict without leaking database errors", async () => {
    mocks.insertProfile.mockRejectedValue({ code: "23505" });
    await expect(
      createWinStreakProfile({ displayName: "Ada", website: "" }),
    ).rejects.toThrow("already in use");
  });

  it("fails closed when the current round or bounded profile pool is unavailable", async () => {
    mocks.insertProfile.mockResolvedValue(false);
    await expect(
      createWinStreakProfile({ displayName: "Ada", website: "" }),
    ).rejects.toThrow("cannot accept another profile right now");
  });

  it("requires a valid browser receipt before a pick", async () => {
    mocks.readReceipt.mockResolvedValue(null);
    await expect(submitWinStreakPick({ teamSlug: "arsenal" })).rejects.toThrow(
      "does not have a Win Streak profile",
    );
    expect(mocks.insertPick).not.toHaveBeenCalled();
  });

  it("locks a canonical club with the hashed receipt", async () => {
    await expect(
      submitWinStreakPick({ teamSlug: "arsenal" }),
    ).resolves.toMatchObject({ teamSlug: "arsenal" });
    expect(mocks.insertPick).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        profileId: "00000000-0000-4000-8000-000000000002",
        receiptTokenHash: expect.stringMatching(/^[\da-f]{64}$/u),
        teamSlug: "arsenal",
      }),
    );
  });

  it("maps immutable, deadline, and used-club constraints to safe messages", async () => {
    mocks.insertPick.mockRejectedValueOnce({
      cause: { constraint: "win_streak_picks_profile_round_unique" },
    });
    await expect(submitWinStreakPick({ teamSlug: "arsenal" })).rejects.toThrow(
      "already locked",
    );

    mocks.insertPick.mockRejectedValueOnce({
      constraint: "win_streak_picks_deadline_check",
    });
    await expect(submitWinStreakPick({ teamSlug: "arsenal" })).rejects.toThrow(
      "deadline has passed",
    );

    mocks.insertPick.mockRejectedValueOnce({
      constraint: "win_streak_picks_club_reuse_check",
    });
    await expect(submitWinStreakPick({ teamSlug: "arsenal" })).rejects.toThrow(
      "already won during your current streak",
    );
  });
});
