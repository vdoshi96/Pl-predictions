import { describe, expect, it } from "vitest";

import {
  assignSharedRanks,
  calculateTeamExpectationIndexes,
  isStandingsScoringActive,
  rankMetricItems,
  rankPickedTeamExpectationIndexes,
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
  it("uses the active bracket count to score an occupied outcome rank", () => {
    expect(scoreCategoryRank(1, 12)).toBe(12);
    expect(scoreCategoryRank(2, 12)).toBe(11);
    expect(scoreCategoryRank(12, 12)).toBe(1);
    expect(scoreCategoryRank(13, 12)).toBe(0);
  });

  it("requires positive integer outcome ranks and bracket counts", () => {
    expect(() => scoreCategoryRank(0, 12)).toThrow(RangeError);
    expect(() => scoreCategoryRank(1.5, 12)).toThrow(RangeError);
    expect(() => scoreCategoryRank(1, 0)).toThrow(RangeError);
    expect(() => scoreCategoryRank(1, 12.5)).toThrow(RangeError);
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

  it("ranks each opinion team category only among its distinct picks", () => {
    const indexes = [
      {
        actualPosition: 1,
        averagePredictedPosition: 10,
        overratedIndex: -9,
        teamId: "unpicked-best-underdog",
        underdogIndex: 9,
      },
      {
        actualPosition: 4,
        averagePredictedPosition: 10,
        overratedIndex: -6,
        teamId: "picked-underdog",
        underdogIndex: 6,
      },
      {
        actualPosition: 15,
        averagePredictedPosition: 5,
        overratedIndex: 10,
        teamId: "unpicked-most-overrated",
        underdogIndex: -10,
      },
      {
        actualPosition: 12,
        averagePredictedPosition: 5,
        overratedIndex: 7,
        teamId: "picked-overrated",
        underdogIndex: -7,
      },
    ];

    expect(
      rankPickedTeamExpectationIndexes(
        indexes,
        ["picked-underdog"],
        "underdog",
      ).map(({ teamId, rank }) => ({ rank, teamId })),
    ).toEqual([{ rank: 1, teamId: "picked-underdog" }]);
    expect(
      rankPickedTeamExpectationIndexes(
        indexes,
        ["picked-overrated"],
        "overrated",
      ).map(({ teamId, rank }) => ({ rank, teamId })),
    ).toEqual([{ rank: 1, teamId: "picked-overrated" }]);
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
