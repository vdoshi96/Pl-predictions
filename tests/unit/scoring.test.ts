import { describe, expect, it } from "vitest";

import {
  assignSharedRanks,
  calculateTeamExpectationIndexes,
  isStandingsScoringActive,
  rankMetricItems,
  rankTeamExpectationIndexes,
  scoreCategoryRank,
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
    expect(scorePredictionIfActive(prediction, preseason, true)).toEqual({
      status: "not-started",
    });
  });

  it("supports manual standings with omitted played-game values", () => {
    const manual = exactStandings.map(({ actualPosition, teamId }) => ({
      actualPosition,
      teamId,
    }));
    expect(isStandingsScoringActive(manual)).toBe(true);
    expect(scorePredictionIfActive(prediction, manual, true).status).toBe(
      "scored",
    );
  });

  it("does not score any standings snapshot before the season kickoff", () => {
    expect(scorePredictionIfActive(prediction, exactStandings, false)).toEqual({
      status: "not-started",
    });
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

describe("spotlight category scoring", () => {
  it("converts an occupied category rank into descending points", () => {
    expect(scoreCategoryRank(1)).toBe(20);
    expect(scoreCategoryRank(2)).toBe(19);
    expect(scoreCategoryRank(20)).toBe(1);
    expect(scoreCategoryRank(21)).toBe(0);
    expect(() => scoreCategoryRank(0)).toThrow(RangeError);
    expect(() => scoreCategoryRank(1.5)).toThrow(RangeError);
  });

  it("uses actual position minus the group's average prediction for overrated clubs", () => {
    const indexes = calculateTeamExpectationIndexes(
      [1, 2, 2, 3, 4].map((predictedPosition) => [
        { predictedPosition, teamId: "manchester-united" },
      ]),
      [{ actualPosition: 10, teamId: "manchester-united" }],
    );

    expect(indexes).toHaveLength(1);
    expect(indexes[0]).toMatchObject({
      actualPosition: 10,
      averagePredictedPosition: 2.4,
      teamId: "manchester-united",
    });
    expect(indexes[0]?.underdogIndex).toBeCloseTo(-7.6);
    expect(indexes[0]?.overratedIndex).toBeCloseTo(7.6);
  });

  it("ranks team overperformance and underperformance in opposite orders", () => {
    const indexes = [
      {
        actualPosition: 2,
        averagePredictedPosition: 10,
        overratedIndex: -8,
        teamId: "unexpected-high-finisher",
        underdogIndex: 8,
      },
      {
        actualPosition: 10,
        averagePredictedPosition: 2,
        overratedIndex: 8,
        teamId: "unexpected-low-finisher",
        underdogIndex: -8,
      },
    ];

    expect(
      rankTeamExpectationIndexes(indexes, "underdog").map(
        (item) => item.teamId,
      ),
    ).toEqual(["unexpected-high-finisher", "unexpected-low-finisher"]);
    expect(
      rankTeamExpectationIndexes(indexes, "overrated").map(
        (item) => item.teamId,
      ),
    ).toEqual(["unexpected-low-finisher", "unexpected-high-finisher"]);
  });

  it("ranks player ratings descending for underdogs and ascending for overrated players", () => {
    const seasonRatings = [
      { id: "highest-rating", metric: 8.3 },
      { id: "middle-rating", metric: 7.1 },
      { id: "lowest-rating", metric: 5.9 },
    ];

    expect(
      rankMetricItems(seasonRatings, "descending").map(({ id, rank }) => ({
        id,
        rank,
      })),
    ).toEqual([
      { id: "highest-rating", rank: 1 },
      { id: "middle-rating", rank: 2 },
      { id: "lowest-rating", rank: 3 },
    ]);
    expect(
      rankMetricItems(seasonRatings, "ascending").map(({ id, rank }) => ({
        id,
        rank,
      })),
    ).toEqual([
      { id: "lowest-rating", rank: 1 },
      { id: "middle-rating", rank: 2 },
      { id: "highest-rating", rank: 3 },
    ]);
  });

  it("shares metric ranks when two subjects have the same value", () => {
    expect(
      rankMetricItems(
        [
          { id: "b", metric: 10 },
          { id: "a", metric: 10 },
          { id: "c", metric: 8 },
        ],
        "descending",
      ).map(({ id, rank }) => ({ id, rank })),
    ).toEqual([
      { id: "a", rank: 1 },
      { id: "b", rank: 1 },
      { id: "c", rank: 3 },
    ]);
  });
});
