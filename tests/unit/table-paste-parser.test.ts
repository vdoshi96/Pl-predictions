import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data";
import { parsePastedStandingsTable } from "@/features/standings/table-paste-parser";
import { describe, expect, it } from "vitest";

const teams = PREMIER_LEAGUE_2026_27_TEAMS;

describe("parsePastedStandingsTable", () => {
  it("parses a full table with positions, played, and points", () => {
    const text = [
      "1 Liverpool 8 20",
      "2 Arsenal 8 18",
      "3 Manchester City 8 17",
      "Aston Villa 8 15",
      "5 Chelsea 7 14",
    ].join("\n");
    const parsed = parsePastedStandingsTable(text, teams);
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok).toHaveLength(5);
    expect(ok[0]).toMatchObject({
      teamSlug: "liverpool",
      actualPosition: 1,
      playedGames: 8,
      leaguePoints: 20,
    });
    expect(parsed.positionsInferred).toBe(false);
  });

  it("infers positions from row order when the position column is absent", () => {
    const text = ["Liverpool 8 20", "Arsenal 8 18"].join("\n");
    const parsed = parsePastedStandingsTable(text, teams);
    expect(parsed.positionsInferred).toBe(true);
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok[0].actualPosition).toBe(1);
    expect(ok[1].actualPosition).toBe(2);
  });

  it("resolves aliases and short names", () => {
    const parsed = parsePastedStandingsTable(
      ["1 Spurs 8 16", "2 Man Utd 8 12"].join("\n"),
      teams,
    );
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok.map((row) => row.teamSlug)).toEqual([
      "tottenham-hotspur",
      "manchester-united",
    ]);
  });

  it("flags unknown clubs without dropping the line", () => {
    const parsed = parsePastedStandingsTable(
      ["1 Liverpool 8 20", "1 Bayern Munich 6 18"].join("\n"),
      teams,
    );
    expect(parsed.rows[1].status).toBe("unknown-club");
    expect(parsed.rows[1].rawLine).toBe("1 Bayern Munich 6 18");
  });

  it("skips header lines and records that numbers are header-classified", () => {
    const text = ["Pos Club P GD Pts", "1 Liverpool 8 20"].join("\n");
    const parsed = parsePastedStandingsTable(text, teams);
    expect(parsed.headerDetected).toBe(true);
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok[0].numbersLowConfidence).toBe(false);
  });

  it("marks heuristic numbers low-confidence when no header exists", () => {
    const parsed = parsePastedStandingsTable("Liverpool 8 11 20", teams);
    expect(parsed.rows[0].numbersLowConfidence).toBe(true);
    expect(parsed.rows[0].playedGames).toBe(8);
    expect(parsed.rows[0].leaguePoints).toBe(20);
  });

  it("treats a single trailing number as points", () => {
    const parsed = parsePastedStandingsTable("Liverpool 20", teams);
    expect(parsed.rows[0].playedGames).toBeNull();
    expect(parsed.rows[0].leaguePoints).toBe(20);
  });

  it("ignores junk lines with no club or numbers", () => {
    const parsed = parsePastedStandingsTable("--- *** ---", teams);
    expect(parsed.rows).toHaveLength(0);
  });

  it("tolerates thousands separators in numbers", () => {
    const parsed = parsePastedStandingsTable("Liverpool 1,234 2,000", teams);
    expect(parsed.rows[0].playedGames).toBe(1234);
    expect(parsed.rows[0].leaguePoints).toBe(2000);
  });
});
