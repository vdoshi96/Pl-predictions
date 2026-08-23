import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSeasonContext: vi.fn(),
  getAdminAuditMetadata: vi.fn(),
  getDb: vi.fn(),
  requireAdminMutation: vi.fn(),
  resolveRound: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/features/admin", () => ({
  getAdminAuditMetadata: mocks.getAdminAuditMetadata,
  requireAdminMutation: mocks.requireAdminMutation,
}));
vi.mock("@/features/seasons/queries", () => ({
  getActiveSeasonContext: mocks.getActiveSeasonContext,
}));
vi.mock("@/features/win-streak/results", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/win-streak/results")>()),
  resolveWinStreakRoundAtomically: mocks.resolveRound,
}));

import { resolveWinStreakRoundAction } from "@/app/admin/win-streak/actions";

const fixtureIds = Array.from(
  { length: 10 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

function resultFormData() {
  const formData = new FormData();
  formData.set("roundId", "00000000-0000-4000-8000-000000000011");
  formData.set("sourceReference", "https://www.premierleague.com/results");
  formData.set("capturedAt", "2026-08-31T21:00:00.000Z");
  for (const fixtureId of fixtureIds) {
    formData.set(`result:${fixtureId}`, "home_win");
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReturnValue({ kind: "database" });
  mocks.getActiveSeasonContext.mockResolvedValue({
    databaseNow: new Date("2026-08-31T22:00:00.000Z"),
    season: { id: "00000000-0000-4000-8000-000000000012" },
  });
  mocks.getAdminAuditMetadata.mockResolvedValue({ requestId: "iad1::test" });
  mocks.resolveRound.mockResolvedValue({ applied: true, matchweek: 2 });
});

describe("Win Streak result action", () => {
  it("authenticates first, resolves once, and revalidates every affected route", async () => {
    await expect(
      resolveWinStreakRoundAction({ message: "", ok: false }, resultFormData()),
    ).resolves.toEqual({
      message: "Matchweek 2 results are locked.",
      ok: true,
    });

    expect(mocks.requireAdminMutation).toHaveBeenCalledOnce();
    expect(mocks.resolveRound).toHaveBeenCalledWith(
      { kind: "database" },
      expect.objectContaining({
        results: expect.arrayContaining([
          { fixtureId: fixtureIds[0], result: "home_win" },
        ]),
        seasonId: "00000000-0000-4000-8000-000000000012",
      }),
    );
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/admin"],
      ["/admin/win-streak"],
      ["/win-streak"],
    ]);
  });

  it("fails closed for an incomplete set before writing", async () => {
    const formData = resultFormData();
    formData.delete(`result:${fixtureIds[0]}`);

    await expect(
      resolveWinStreakRoundAction({ message: "", ok: false }, formData),
    ).resolves.toEqual({
      message: "Enter one result for each of the ten fixtures.",
      ok: false,
    });
    expect(mocks.requireAdminMutation).toHaveBeenCalledOnce();
    expect(mocks.resolveRound).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a stale or concurrent result attempt without revalidation", async () => {
    mocks.resolveRound.mockResolvedValue({ applied: false, matchweek: null });

    await expect(
      resolveWinStreakRoundAction({ message: "", ok: false }, resultFormData()),
    ).resolves.toEqual({
      message:
        "The round changed or is not ready. Review the current results and try again.",
      ok: false,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
