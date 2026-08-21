import { buildResultDiff } from "@/features/results/dataset-diff";
import { describe, expect, it } from "vitest";

const labelById = new Map([
  ["a", "Haaland"],
  ["b", "Salah"],
] as const);

describe("buildResultDiff", () => {
  it("marks identical rows as same", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [{ metricValue: 27, subjectId: "a" }],
      labelById,
      publishedRows: [{ metricValue: 27, subjectId: "a" }],
    });
    expect(diff.entries[0].kind).toBe("same");
    expect(diff.addedCount).toBe(0);
  });

  it("detects value changes with old and new ranks", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [
        { metricValue: 30, subjectId: "a" },
        { metricValue: 18, subjectId: "b" },
      ],
      labelById,
      publishedRows: [
        { metricValue: 27, subjectId: "a" },
        { metricValue: 18, subjectId: "b" },
      ],
    });
    expect(diff.changedCount).toBe(1);
    const haaland = diff.entries.find((entry) => entry.subjectId === "a");
    expect(haaland).toMatchObject({
      kind: "changed",
      oldMetric: 27,
      newMetric: 30,
      oldRank: 1,
      newRank: 1,
    });
  });

  it("detects added and removed subjects", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [{ metricValue: 18, subjectId: "b" }],
      labelById,
      publishedRows: [{ metricValue: 27, subjectId: "a" }],
    });
    expect(diff.addedCount).toBe(1);
    expect(diff.removedCount).toBe(1);
    expect(
      diff.entries.filter((entry) => entry.kind === "added")[0].subjectId,
    ).toBe("b");
    expect(
      diff.entries.filter((entry) => entry.kind === "removed")[0].oldRank,
    ).toBe(1);
  });

  it("handles an empty published snapshot as all-added", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [{ metricValue: 27, subjectId: "a" }],
      labelById,
      publishedRows: [],
    });
    expect(diff.addedCount).toBe(1);
    expect(diff.entries[0].oldRank).toBeNull();
  });
});
