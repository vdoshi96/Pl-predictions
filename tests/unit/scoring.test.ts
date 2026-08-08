import { describe, expect, it } from "vitest";

import {
  assignSharedRanks,
  isStandingsScoringActive,
  scoreClub,
  scorePrediction,
  scorePredictionIfActive,
} from "@/features/scoring";

const prediction = Array.from({ length: 20 }, (_, index) => ({
  predictedPosition: index + 1,
  teamId: `team-${index + 1}`,
}));
const exactStandings = prediction.map((item) => ({
  actualPosition: item.predictedPosition,
  playedGames: 1,
  teamId: item.teamId,
}));

describe("scoreClub", () => {
  it.each([
    [1, 1, 5],
    [3, 1, 3],
    [9, 1, 1],
    [11, 10, 3],
    [14, 10, 0],
    [11, 20, 1],
    [8, 11, 3],
    [7, 11, 0],
  ])("scores predicted %i and actual %i as %i", (predicted, actual, points) => {
    expect(scoreClub(predicted, actual)).toBe(points);
  });

  it("keeps tiers mutually exclusive", () => {
    expect(scoreClub(1, 1)).toBe(5);
    expect(scoreClub(11, 10)).toBe(3);
  });
});

describe("prediction score summary", () => {
  it("awards exactly 100 points for an exact table", () => {
    expect(scorePrediction(prediction, exactStandings)).toMatchObject({
      correctHalfCount: 0,
      exactCount: 20,
      total: 100,
      withinThreeCount: 0,
      zeroCount: 0,
    });
  });

  it("does not score an explicit zero-match preseason table", () => {
    const preseason = exactStandings.map((item) => ({
      ...item,
      playedGames: 0,
    }));
    expect(isStandingsScoringActive(preseason)).toBe(false);
    expect(scorePredictionIfActive(prediction, preseason)).toEqual({
      status: "not-started",
    });
  });

  it("supports manual standings with omitted played-game values", () => {
    const manual = exactStandings.map(({ actualPosition, teamId }) => ({
      actualPosition,
      teamId,
    }));
    expect(isStandingsScoringActive(manual)).toBe(true);
    expect(scorePredictionIfActive(prediction, manual).status).toBe("scored");
  });
});

describe("shared leaderboard ranks", () => {
  it("uses competition ranks and alphabetizes tied names", () => {
    expect(
      assignSharedRanks([
        { participantName: "Zoe", totalScore: 80 },
        { participantName: "Ada", totalScore: 90 },
        { participantName: "Ben", totalScore: 90 },
        { participantName: "Cal", totalScore: 70 },
      ]),
    ).toEqual([
      { participantName: "Ada", rank: 1, totalScore: 90 },
      { participantName: "Ben", rank: 1, totalScore: 90 },
      { participantName: "Zoe", rank: 3, totalScore: 80 },
      { participantName: "Cal", rank: 4, totalScore: 70 },
    ]);
  });
});
