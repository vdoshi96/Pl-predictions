import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/client";
import { buildManualResultAssignments } from "@/features/results/queries";
import {
  applyResultPointerTransition,
  assertPublishableCoverage,
  assertPickedRatingSubjects,
  buildFinalizeResultQuery,
  buildPublishResultQuery,
  buildCreateResultOnlyPlayerQuery,
  buildSaveResultDraftQuery,
  buildUndoFinalResultQuery,
  parseSpotlightResultDraft,
  rankSpotlightResultRows,
  resolveSpotlightResult,
  spotlightResultContentHash,
} from "@/features/results";
import { PublicError } from "@/shared/errors";

const seasonId = "00000000-0000-4000-8000-000000000001";
const snapshotId = "00000000-0000-4000-8000-000000000002";
const playerA = "00000000-0000-4000-8000-00000000000a";
const playerB = "00000000-0000-4000-8000-00000000000b";
const playerC = "00000000-0000-4000-8000-00000000000c";
const predictionA = "00000000-0000-4000-8000-00000000000d";

describe("spotlight result validation", () => {
  it("uses competition ranks and accepts a boundary tie", () => {
    const rows = [
      { metricValue: 18, subjectId: playerB },
      { metricValue: 18, subjectId: playerA },
      { metricValue: 14, subjectId: playerC },
    ];

    expect(rankSpotlightResultRows(rows)).toEqual([
      { metricValue: 18, outcomeRank: 1, subjectId: playerA },
      { metricValue: 18, outcomeRank: 1, subjectId: playerB },
      { metricValue: 14, outcomeRank: 3, subjectId: playerC },
    ]);
    expect(() => assertPublishableCoverage("goals", rows, 3)).not.toThrow();
    try {
      assertPublishableCoverage("goals", rows, 4);
      throw new Error("Expected incomplete coverage to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(PublicError);
      expect(error).toMatchObject({ code: "BAD_REQUEST" });
      expect(error).toHaveProperty(
        "message",
        "Include every row and boundary tie through rank 4.",
      );
    }
  });

  it("requires ratings coverage in both directions", () => {
    const rows = [
      { metricValue: 9, subjectId: playerA },
      { metricValue: 7, subjectId: playerB },
      { metricValue: 5, subjectId: playerC },
    ];
    expect(() =>
      assertPublishableCoverage("player_ratings", rows, 2, 3),
    ).not.toThrow();
    expect(() =>
      assertPublishableCoverage("player_ratings", rows, 2, 100),
    ).toThrow("every high and low row");
    expect(() =>
      assertPublishableCoverage("player_ratings", rows, 3, 3),
    ).not.toThrow();
  });

  it("requires new rating drafts to contain exactly the picked players", () => {
    const rows = [
      { metricValue: 9, subjectId: playerA },
      { metricValue: 7, subjectId: playerB },
    ];
    expect(() =>
      assertPickedRatingSubjects(rows, [playerA, playerB]),
    ).not.toThrow();
    expect(() => assertPickedRatingSubjects(rows, [playerA, playerC])).toThrow(
      "Add ratings for every picked opinion player",
    );
    expect(() => assertPickedRatingSubjects(rows, [playerA])).toThrow(
      "Remove unpicked players",
    );
  });

  it("allows a complete finite subject population when N is larger", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      metricValue: 20 - index,
      subjectId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    }));
    expect(() =>
      assertPublishableCoverage("clean_sheets", rows, 25, 20),
    ).not.toThrow();
  });

  it("validates metric precision and hashes only scoring facts", () => {
    const base = {
      capturedAt: "2027-05-24T18:00:00.000Z",
      coveredThroughRank: 2,
      dataset: "player_ratings" as const,
      expectedWorkingSnapshotId: null,
      rows: [
        { metricValue: 7.123, subjectId: playerA },
        { metricValue: 6.5, subjectId: playerB },
      ],
      source: "Owner review",
      sourceReference: null,
    };
    expect(parseSpotlightResultDraft(base)).toEqual(base);
    expect(() =>
      parseSpotlightResultDraft({
        ...base,
        rows: [
          { metricValue: 8.123, subjectId: playerA },
          { metricValue: 1.001, subjectId: playerB },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      parseSpotlightResultDraft({
        ...base,
        rows: [{ metricValue: 7.1234, subjectId: playerA }],
      }),
    ).toThrow("at most 3 decimals");
    expect(spotlightResultContentHash(base)).toBe(
      spotlightResultContentHash({ ...base, rows: [...base.rows].reverse() }),
    );
  });
});

describe("spotlight result resolution", () => {
  it("distinguishes pending omissions from resolved outside-range zeroes", () => {
    expect(
      resolveSpotlightResult({
        activeBracketCount: 5,
        category: "overrated_player",
        coveredThroughRank: 5,
      }),
    ).toMatchObject({ metricLabel: "Outside lowest 5" });
    expect(
      resolveSpotlightResult({
        activeBracketCount: 5,
        category: "top_scorer",
        coveredThroughRank: 3,
      }),
    ).toBeNull();
    expect(
      resolveSpotlightResult({
        activeBracketCount: 5,
        category: "top_scorer",
        coveredThroughRank: 5,
      }),
    ).toEqual({
      accuracyPoints: 0,
      metricLabel: "Outside top 5",
      resultRank: 6,
      resultStatus: "outside-range",
    });
    expect(
      resolveSpotlightResult({
        activeBracketCount: 5,
        category: "top_scorer",
        coveredThroughRank: 5,
        metricValue: 18,
        outcomeRank: 2,
      }),
    ).toMatchObject({
      accuracyPoints: 4,
      resultRank: 2,
      resultStatus: "ranked",
    });
  });

  it("shows the third rating decimal used for ranking", () => {
    expect(
      resolveSpotlightResult({
        activeBracketCount: 2,
        category: "underdog_player",
        coveredThroughRank: 2,
        metricValue: 7.123,
        outcomeRank: 1,
      }),
    ).toMatchObject({ metricLabel: "Rating 7.123" });
  });

  it("ranks synchronized ratings within separate category-specific pick pools", () => {
    const assignments = buildManualResultAssignments({
      activeBracketCount: 3,
      aliases: [],
      items: [
        {
          metricValue: 7,
          outcomeRank: 1,
          playerId: playerA,
          snapshotId,
          teamId: null,
        },
        {
          metricValue: 9,
          outcomeRank: 2,
          playerId: playerB,
          snapshotId,
          teamId: null,
        },
        {
          metricValue: 6,
          outcomeRank: 3,
          playerId: playerC,
          snapshotId,
          teamId: null,
        },
      ],
      picks: [
        {
          category: "underdog_player",
          normalizedCustomPlayerName: null,
          playerId: playerA,
          predictionId: predictionA,
          teamId: null,
        },
        {
          category: "overrated_player",
          normalizedCustomPlayerName: null,
          playerId: playerC,
          predictionId: predictionA,
          teamId: null,
        },
        {
          category: "top_scorer",
          normalizedCustomPlayerName: "unmatched player",
          playerId: null,
          predictionId: predictionA,
          teamId: null,
        },
      ],
      snapshots: [
        { coveredThroughRank: 3, dataset: "player_ratings", id: snapshotId },
      ],
    });

    expect(assignments.get(predictionA)?.get("underdog_player")).toMatchObject({
      accuracyPoints: 3,
      resultRank: 1,
    });
    expect(assignments.get(predictionA)?.get("overrated_player")).toMatchObject(
      {
        accuracyPoints: 3,
        resultRank: 1,
      },
    );
    expect(assignments.get(predictionA)?.has("top_scorer")).toBe(false);
  });

  it("keeps a picked rating pending when the active snapshot has no fact", () => {
    const assignments = buildManualResultAssignments({
      activeBracketCount: 2,
      aliases: [],
      items: [
        {
          metricValue: 9,
          outcomeRank: 1,
          playerId: playerA,
          snapshotId,
          teamId: null,
        },
      ],
      picks: [
        {
          category: "underdog_player",
          normalizedCustomPlayerName: null,
          playerId: playerB,
          predictionId: predictionA,
          teamId: null,
        },
      ],
      snapshots: [
        { coveredThroughRank: 2, dataset: "player_ratings", id: snapshotId },
      ],
    });

    expect(
      assignments.get(predictionA)?.get("underdog_player"),
    ).toBeUndefined();
  });

  it("resolves Other names from each immutable snapshot instead of a live alias", () => {
    const assistsSnapshotId = "00000000-0000-4000-8000-000000000022";
    const assignments = buildManualResultAssignments({
      activeBracketCount: 2,
      aliases: [
        {
          normalizedCustomPlayerName: "same spelling",
          playerId: playerA,
          snapshotId,
        },
        {
          normalizedCustomPlayerName: "same spelling",
          playerId: playerB,
          snapshotId: assistsSnapshotId,
        },
      ],
      items: [
        {
          metricValue: 20,
          outcomeRank: 1,
          playerId: playerA,
          snapshotId,
          teamId: null,
        },
        {
          metricValue: 14,
          outcomeRank: 1,
          playerId: playerB,
          snapshotId: assistsSnapshotId,
          teamId: null,
        },
      ],
      picks: [
        {
          category: "top_scorer",
          normalizedCustomPlayerName: "same spelling",
          playerId: null,
          predictionId: predictionA,
          teamId: null,
        },
        {
          category: "top_assister",
          normalizedCustomPlayerName: "same spelling",
          playerId: null,
          predictionId: predictionA,
          teamId: null,
        },
      ],
      snapshots: [
        { coveredThroughRank: 2, dataset: "goals", id: snapshotId },
        {
          coveredThroughRank: 2,
          dataset: "assists",
          id: assistsSnapshotId,
        },
      ],
    });

    expect(assignments.get(predictionA)?.get("top_scorer")).toMatchObject({
      accuracyPoints: 2,
      resultRank: 1,
    });
    expect(assignments.get(predictionA)?.get("top_assister")).toMatchObject({
      accuracyPoints: 2,
      resultRank: 1,
    });
  });
});

describe("atomic spotlight result pointers", () => {
  const pointers = {
    activeSnapshotId: null,
    auditId: "00000000-0000-4000-8000-000000000003",
    dataset: "goals" as const,
    finalSnapshotId: null,
    now: new Date("2027-05-24T18:00:00.000Z"),
    requestId: "iad1::results-test",
    seasonId,
    workingSnapshotId: snapshotId,
  };

  it("guards publish by exact pointers, closure, N, coverage, and Other aliases", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildPublishResultQuery({
        ...pointers,
        coverageAttested: true,
        expectedBracketCount: 3,
      }),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(statement).toContain('state."working_snapshot_id" = $');
    expect(statement).toContain(
      'state."active_snapshot_id" is distinct from $',
    );
    expect(statement).toContain('state."active_snapshot_id" is null');
    expect(statement).toContain('state."final_snapshot_id" is null');
    expect(statement).toContain(
      'season."opening_kickoff" <= clock_timestamp()',
    );
    expect(statement).toContain('select count(*)::integer from "predictions"');
    expect(statement).toContain('snapshot."covered_through_rank" = $');
    expect(statement).toContain('snapshot."sealed_at" is not null');
    expect(statement).toContain(
      'left join "spotlight_result_snapshot_aliases"',
    );
    expect(statement).toContain("pick.\"category\" = 'top_scorer'");
    expect(statement).toContain("coverageAttested");
    expect(rendered.params).toContain(true);
    expect(() =>
      buildPublishResultQuery({
        ...pointers,
        coverageAttested: false as true,
        expectedBracketCount: 3,
      }),
    ).toThrow("attestation");
  });

  it("saves against the exact working pointer and blocks finalized state", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildSaveResultDraftQuery({
        capturedAt: new Date("2027-05-24T17:00:00.000Z"),
        contentHash: "a".repeat(64),
        coveredThroughRank: 3,
        dataset: "goals",
        expectedWorkingSnapshotId: snapshotId,
        now: pointers.now,
        requestId: pointers.requestId,
        rows: [{ metricValue: 20, outcomeRank: 1, subjectId: playerA }],
        seasonId,
        source: "Owner review",
        sourceReference: null,
        subject: "player",
      }),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();
    expect(statement).toContain('state."working_snapshot_id" = $');
    expect(statement).toContain('state."final_snapshot_id" is null');
    expect(statement).toContain("for update");
    expect(statement).not.toContain("on conflict");
    expect(statement).toContain(
      'insert into "spotlight_result_snapshot_aliases"',
    );
    expect(statement).toContain("jsonb_build_array");
    expect(statement).toContain('live_aliases."custom_player_name"');
    expect(statement).toContain("pick.\"category\" = 'top_scorer'");
    expect(statement).toContain('as "pinnedAliases"');
    expect(statement).toContain("spotlight_results.draft_saved");
  });

  it("finalizes and undoes only the exact active pointer", () => {
    const active = { ...pointers, activeSnapshotId: snapshotId };
    const finalize = new PgDialect()
      .sqlToQuery(buildFinalizeResultQuery(active))
      .sql.replaceAll(/\s+/g, " ");
    const undo = new PgDialect()
      .sqlToQuery(
        buildUndoFinalResultQuery({ ...active, finalSnapshotId: snapshotId }),
      )
      .sql.replaceAll(/\s+/g, " ");
    expect(finalize).toContain('state."active_snapshot_id" = $');
    expect(finalize).toContain('state."final_snapshot_id" is null');
    expect(undo).toContain('state."active_snapshot_id" = $');
    expect(undo).toContain('state."final_snapshot_id" = $');
    expect(finalize).not.toContain('update "spotlight_result_snapshots"');
    expect(undo).not.toContain('update "spotlight_result_snapshots"');
  });

  it("creates a submitted Other spelling only as an inactive result-only player", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildCreateResultOnlyPlayerQuery({
        customPlayerName: "New Striker",
        normalizedCustomPlayerName: "new striker",
        requestId: pointers.requestId,
        seasonId,
        slug: "result-only-new-striker-fixture",
      }),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ");
    expect(statement).toContain('from "prediction_category_picks"');
    expect(statement).toContain('insert into "spotlight_result_aliases"');
    expect(statement).toContain('insert into "players"');
    expect(statement).toContain("false");
    expect(statement).toContain("spotlight_results.result_only_player_created");
  });

  it("reports success only for a won transition", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ applied: true }] })
      .mockResolvedValueOnce({ rows: [{ applied: false }] });
    const db = { execute } as unknown as Database;
    await expect(
      applyResultPointerTransition(
        db,
        buildPublishResultQuery({
          ...pointers,
          coverageAttested: true,
          expectedBracketCount: 3,
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      applyResultPointerTransition(
        db,
        buildPublishResultQuery({
          ...pointers,
          coverageAttested: true,
          expectedBracketCount: 3,
        }),
      ),
    ).resolves.toBe(false);
  });
});
