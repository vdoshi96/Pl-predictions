import { parsePastedResultList } from "@/features/results/list-paste-parser";
import { describe, expect, it } from "vitest";

const players = [
  { id: "p-haaland", names: ["Haaland", "Haaland, Erling"] },
  { id: "p-salah", names: ["Salah"] },
  { id: "p-wilson", names: ["Wilson"] },
];

describe("parsePastedResultList", () => {
  it("parses rank-prefixed integer lines", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "1 Haaland 27\n2 Salah 18",
    });
    expect(rows[0]).toMatchObject({
      status: "matched",
      subjectId: "p-haaland",
      metricValue: 27,
    });
    expect(rows[1]).toMatchObject({
      status: "matched",
      subjectId: "p-salah",
      metricValue: 18,
    });
  });

  it("parses dash-separated lines without ranks", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Haaland — 27",
    });
    expect(rows[0]).toMatchObject({
      status: "matched",
      subjectId: "p-haaland",
      metricValue: 27,
    });
  });

  it("parses decimal ratings within 0–10 with at most three decimals", () => {
    const rows = parsePastedResultList({
      metricKind: "rating",
      subjects: players,
      text: "Salah 7.852\nHaaland 10",
    });
    expect(rows[0].status).toBe("matched");
    expect(rows[0].metricValue).toBe(7.852);
    expect(rows[1].status).toBe("matched");
  });

  it("rejects ratings above ten or with too many decimals as bad-metric", () => {
    const rows = parsePastedResultList({
      metricKind: "rating",
      subjects: players,
      text: "Salah 11\nHaaland 7.8521",
    });
    expect(rows[0].status).toBe("bad-metric");
    expect(rows[1].status).toBe("bad-metric");
  });

  it("rejects decimals for integer datasets", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Salah 18.5",
    });
    expect(rows[0].status).toBe("bad-metric");
  });

  it("flags unknown names while keeping their lines", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Mystery Player 12",
    });
    expect(rows[0]).toMatchObject({ status: "no-match", subjectId: null });
  });

  it("matches reversed sort-name forms", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Haaland, Erling 27",
    });
    expect(rows[0]).toMatchObject({
      status: "matched",
      subjectId: "p-haaland",
    });
  });

  it("flags lines with no number as bad-metric", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Salah",
    });
    expect(rows[0].status).toBe("bad-metric");
  });

  it("skips empty lines entirely", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "\n  \nSalah 18\n",
    });
    expect(rows).toHaveLength(1);
  });
});
