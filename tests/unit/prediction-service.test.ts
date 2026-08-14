import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSeasonContext: vi.fn(),
  getActiveSeasonPlayerIds: vi.fn(),
  getDb: vi.fn(),
  getSeasonTeams: vi.fn(),
  insertPredictionAtomically: vi.fn(),
}));

vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/features/seasons/queries", () => ({
  getActiveSeasonContext: mocks.getActiveSeasonContext,
  getActiveSeasonPlayerIds: mocks.getActiveSeasonPlayerIds,
  getSeasonTeams: mocks.getSeasonTeams,
}));
vi.mock("@/features/predictions/atomic-insert", () => ({
  insertPredictionAtomically: mocks.insertPredictionAtomically,
}));

import { createPrediction } from "@/features/predictions/service";

const seasonId = "00000000-0000-4000-8000-000000000001";
const teamIds = Array.from(
  { length: 20 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
);
const playerIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
] as const;

const validInput = {
  categoryPicks: [
    { category: "top_scorer", playerId: playerIds[0] },
    { category: "top_assister", playerId: playerIds[1] },
    { category: "most_clean_sheets", teamId: teamIds[0] },
    { category: "underdog_team", teamId: teamIds[1] },
    { category: "overrated_team", teamId: teamIds[2] },
    { category: "underdog_player", playerId: playerIds[0] },
    { category: "overrated_player", customPlayerName: "New Player" },
  ],
  honeypot: "",
  items: teamIds.map((teamId, index) => ({
    predictedPosition: index + 1,
    teamId,
  })),
  participantName: "Targeted Validator",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveSeasonContext.mockResolvedValue({
    databaseNow: new Date("2026-08-14T12:00:00.000Z"),
    season: {
      id: seasonId,
      openingKickoff: new Date("2026-08-21T19:00:00.000Z"),
      revealPredictions: false,
      submissionDeadline: null,
      submissionsLocked: false,
    },
  });
  mocks.getSeasonTeams.mockResolvedValue(teamIds.map((id) => ({ id })));
  mocks.getActiveSeasonPlayerIds.mockResolvedValue([...playerIds]);
  mocks.getDb.mockReturnValue({});
  mocks.insertPredictionAtomically.mockResolvedValue(true);
});

describe("createPrediction targeted catalogue validation", () => {
  it("looks up only player IDs referenced by the submitted spotlight picks", async () => {
    await expect(createPrediction(validInput)).resolves.toMatchObject({
      participantName: "Targeted Validator",
    });

    expect(mocks.getActiveSeasonPlayerIds).toHaveBeenCalledWith(seasonId, [
      playerIds[0],
      playerIds[1],
      playerIds[0],
    ]);
    expect(mocks.getSeasonTeams).toHaveBeenCalledWith(seasonId);
    expect(mocks.insertPredictionAtomically).toHaveBeenCalledOnce();
  });

  it("rejects malformed input before querying teams or players", async () => {
    await expect(
      createPrediction({ participantName: "No rows" }),
    ).rejects.toThrow();

    expect(mocks.getSeasonTeams).not.toHaveBeenCalled();
    expect(mocks.getActiveSeasonPlayerIds).not.toHaveBeenCalled();
  });

  it("rejects a referenced player that is not active for the season", async () => {
    mocks.getActiveSeasonPlayerIds.mockResolvedValue([playerIds[0]]);

    await expect(createPrediction(validInput)).rejects.toThrow(
      "Choose an available player or use Other player.",
    );
    expect(mocks.insertPredictionAtomically).not.toHaveBeenCalled();
  });
});
