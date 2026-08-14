import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createResultOnlyPlayerAtomically: vi.fn(),
  createStandaloneResultOnlyPlayerAtomically: vi.fn(),
  getActiveSeasonContext: vi.fn(),
  getAdminAuditMetadata: vi.fn(),
  getDb: vi.fn(),
  requireAdminMutation: vi.fn(),
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
vi.mock("@/features/results", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/results")>()),
  createResultOnlyPlayerAtomically: mocks.createResultOnlyPlayerAtomically,
  createStandaloneResultOnlyPlayerAtomically:
    mocks.createStandaloneResultOnlyPlayerAtomically,
}));

import {
  createSpotlightResultOnlyPlayer,
  createStandaloneSpotlightResultOnlyPlayer,
} from "../../src/app/admin/results/actions";

function databaseWithPlayers(displayNames: readonly string[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi
          .fn()
          .mockResolvedValue(
            displayNames.map((displayName) => ({ displayName })),
          ),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveSeasonContext.mockResolvedValue({
    season: { id: "00000000-0000-4000-8000-000000000001" },
  });
  mocks.getDb.mockReturnValue(databaseWithPlayers(["Bukayo Saka"]));
});

describe("admin spotlight result-only player actions", () => {
  it("rejects standalone and Other aliases that duplicate a canonical player", async () => {
    await expect(
      createStandaloneSpotlightResultOnlyPlayer({
        displayName: "  BUKAYO   SAKA ",
      }),
    ).resolves.toEqual({
      message:
        "Bukayo Saka already exists in this season. Reuse that canonical player instead of creating a duplicate result-only subject.",
      ok: false,
    });
    await expect(
      createSpotlightResultOnlyPlayer({ customPlayerName: "bukayo saka" }),
    ).resolves.toEqual({
      message:
        "Bukayo Saka already exists in this season. Reuse that canonical player instead of creating a duplicate result-only subject.",
      ok: false,
    });

    expect(mocks.requireAdminMutation).toHaveBeenCalledTimes(2);
    expect(mocks.getAdminAuditMetadata).not.toHaveBeenCalled();
    expect(mocks.createResultOnlyPlayerAtomically).not.toHaveBeenCalled();
    expect(
      mocks.createStandaloneResultOnlyPlayerAtomically,
    ).not.toHaveBeenCalled();
  });
});
