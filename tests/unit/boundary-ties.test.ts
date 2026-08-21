import {
  evaluateCoverage,
  findBoundaryTieWarnings,
} from "@/features/results/boundary-ties";
import { describe, expect, it } from "vitest";

const rows = (values: number[]) =>
  values.map((metricValue) => ({ metricValue }));

describe("findBoundaryTieWarnings", () => {
  it("returns no warnings when no tie straddles the boundary", () => {
    expect(findBoundaryTieWarnings(rows([9, 8, 7]), 2, "descending")).toEqual(
      [],
    );
  });

  it("warns when a tie group spans rank N", () => {
    const warnings = findBoundaryTieWarnings(
      rows([9, 8, 8, 6]),
      2,
      "descending",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      tiedCount: 2,
      tiedValue: 8,
      boundaryRank: 2,
    });
  });

  it("warns on ascending direction for overrated views", () => {
    const warnings = findBoundaryTieWarnings(
      rows([4.1, 5.5, 5.5, 6.9]),
      2,
      "ascending",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ tiedCount: 2, tiedValue: 5.5 });
  });

  it("does not warn when the tie sits fully inside the covered range", () => {
    expect(findBoundaryTieWarnings(rows([9, 9, 7]), 3, "descending")).toEqual(
      [],
    );
  });
});

describe("evaluateCoverage", () => {
  it("reports complete coverage at exactly N rows", () => {
    expect(evaluateCoverage(rows([3, 2, 1]), 3)).toEqual({
      complete: true,
      coveredThroughRank: 3,
      shortfall: 0,
    });
  });

  it("reports shortfall below N", () => {
    expect(evaluateCoverage(rows([3, 2]), 3)).toEqual({
      complete: false,
      coveredThroughRank: 2,
      shortfall: 1,
    });
  });

  it("ignores extra rows beyond N", () => {
    expect(evaluateCoverage(rows([5, 4, 3, 2, 1]), 3).complete).toBe(true);
  });
});
