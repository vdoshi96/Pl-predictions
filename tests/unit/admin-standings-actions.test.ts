import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  finalizeSnapshotAtomically: vi.fn(),
  getAdminAuditMetadata: vi.fn(),
  getActiveSeasonView: vi.fn(),
  getDb: vi.fn(),
  redirect: vi.fn(),
  requireAdminMutation: vi.fn(),
  revalidatePath: vi.fn(),
  undoFinalSnapshotAtomically: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({ kind: "where" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/db/schema", () => ({
  adminAuditLogs: { name: "adminAuditLogs" },
  seasons: {
    activeSnapshotId: "activeSnapshotId",
    finalSnapshotId: "finalSnapshotId",
    id: "seasonId",
  },
  standingsItems: {
    playedGames: "playedGames",
    snapshotId: "snapshotId",
  },
  standingsSnapshots: { id: "snapshotId", isFinal: "isFinal" },
}));
vi.mock("@/features/admin", () => ({
  getAdminAuditMetadata: mocks.getAdminAuditMetadata,
  isFinalStandingsCandidate: (items: Array<{ playedGames: number | null }>) =>
    items.length === 20 && items.every((item) => item.playedGames === 38),
  requireAdminMutation: mocks.requireAdminMutation,
}));
vi.mock("@/features/seasons/queries", () => ({
  getActiveSeasonView: mocks.getActiveSeasonView,
}));
vi.mock("@/features/standings/finalization", () => ({
  finalizeSnapshotAtomically: mocks.finalizeSnapshotAtomically,
  undoFinalSnapshotAtomically: mocks.undoFinalSnapshotAtomically,
}));
vi.mock("../../scripts/import-standings", () => ({
  importCanonicalStandings: vi.fn(),
}));

import {
  finalizeActiveSnapshot,
  undoFinalSnapshot,
} from "../../src/app/admin/standings/actions";

function databaseWithCandidate(
  candidateItems: Array<{ playedGames: number | null }>,
) {
  const updateStatement = { kind: "update" };
  const insertStatement = { kind: "insert" };

  return {
    batch: mocks.batch,
    insert: vi.fn(() => ({ values: vi.fn(() => insertStatement) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(candidateItems),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => updateStatement) })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveSeasonView.mockResolvedValue({
    season: {
      activeSnapshotId: "00000000-0000-4000-8000-000000000001",
      finalSnapshotId: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000002",
    },
  });
  mocks.getAdminAuditMetadata.mockResolvedValue({ requestId: "iad1::test" });
  mocks.finalizeSnapshotAtomically.mockResolvedValue(true);
  mocks.undoFinalSnapshotAtomically.mockResolvedValue(true);
  mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`redirect:${destination}`);
  });
});

describe("finalizeActiveSnapshot", () => {
  it("rejects a direct finalization request for an incomplete table", async () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      playedGames: index === 0 ? 37 : 38,
    }));
    mocks.getDb.mockReturnValue(databaseWithCandidate(items));

    await expect(finalizeActiveSnapshot()).rejects.toThrow(
      "redirect:/admin/standings?error=incomplete",
    );

    expect(mocks.requireAdminMutation).toHaveBeenCalledOnce();
    expect(mocks.getAdminAuditMetadata).not.toHaveBeenCalled();
    expect(mocks.finalizeSnapshotAtomically).not.toHaveBeenCalled();
  });

  it("finalizes only after all 20 clubs have 38 played games", async () => {
    const items = Array.from({ length: 20 }, () => ({ playedGames: 38 }));
    mocks.getDb.mockReturnValue(databaseWithCandidate(items));

    await expect(finalizeActiveSnapshot()).resolves.toBeUndefined();

    expect(mocks.requireAdminMutation).toHaveBeenCalledOnce();
    expect(mocks.getAdminAuditMetadata).toHaveBeenCalledOnce();
    expect(mocks.finalizeSnapshotAtomically).toHaveBeenCalledWith(
      expect.anything(),
      {
        requestId: "iad1::test",
        seasonId: "00000000-0000-4000-8000-000000000002",
        snapshotId: "00000000-0000-4000-8000-000000000001",
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/leaderboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/standings");
  });

  it("does not finalize the stale snapshot when an import wins the race", async () => {
    const items = Array.from({ length: 20 }, () => ({ playedGames: 38 }));
    mocks.getDb.mockReturnValue(databaseWithCandidate(items));
    mocks.finalizeSnapshotAtomically.mockResolvedValue(false);

    await expect(finalizeActiveSnapshot()).rejects.toThrow(
      "redirect:/admin/standings?error=changed",
    );

    expect(mocks.finalizeSnapshotAtomically).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("undoFinalSnapshot", () => {
  it("undoes only the exact final pointer observed by the action", async () => {
    const db = databaseWithCandidate([]);
    mocks.getDb.mockReturnValue(db);

    await expect(undoFinalSnapshot()).resolves.toBeUndefined();

    expect(mocks.undoFinalSnapshotAtomically).toHaveBeenCalledWith(db, {
      requestId: "iad1::test",
      seasonId: "00000000-0000-4000-8000-000000000002",
      snapshotId: "00000000-0000-4000-8000-000000000001",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/leaderboard");
  });

  it("does not clear a newer final pointer after losing the race", async () => {
    mocks.getDb.mockReturnValue(databaseWithCandidate([]));
    mocks.undoFinalSnapshotAtomically.mockResolvedValue(false);

    await expect(undoFinalSnapshot()).rejects.toThrow(
      "redirect:/admin/standings?error=undo-changed",
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
