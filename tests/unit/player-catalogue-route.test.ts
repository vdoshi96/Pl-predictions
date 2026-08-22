import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSeasonContext: vi.fn(),
  getActiveSeasonPlayers: vi.fn(),
}));

vi.mock("@/features/seasons/queries", () => mocks);

import { GET, dynamic } from "@/app/api/player-catalogue/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveSeasonContext.mockResolvedValue({
    season: { id: "season-id", slug: "2026-27" },
  });
  mocks.getActiveSeasonPlayers.mockResolvedValue([
    {
      assetPath: "/player-faces/example.png",
      displayName: "Example Player",
      firstName: "Example",
      id: "player-id",
      lastName: "Player",
    },
  ]);
});

describe("GET /api/player-catalogue", () => {
  it("returns the active season's minimal catalogue with shared revalidation caching", async () => {
    const response = await GET();

    expect(dynamic).toBe("force-dynamic");
    expect(mocks.getActiveSeasonPlayers).toHaveBeenCalledWith("season-id");
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    await expect(response.json()).resolves.toEqual({
      players: [
        {
          assetPath: "/player-faces/example.png",
          displayName: "Example Player",
          firstName: "Example",
          id: "player-id",
          lastName: "Player",
        },
      ],
      seasonSlug: "2026-27",
    });
  });
});
