import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/client";
import {
  buildAtomicPredictionInsertQuery,
  insertPredictionAtomically,
  type AtomicPredictionInsertInput,
} from "@/features/predictions/atomic-insert";

const input: AtomicPredictionInsertInput = {
  categoryPicks: [
    {
      category: "top_scorer",
      playerId: "10000000-0000-4000-8000-000000000001",
    },
    {
      category: "top_assister",
      customPlayerName: "Bruno Fernandes",
    },
    {
      category: "most_clean_sheets",
      teamId: "00000000-0000-4000-8000-000000000010",
    },
    {
      category: "underdog_team",
      teamId: "00000000-0000-4000-8000-000000000011",
    },
    {
      category: "overrated_team",
      teamId: "00000000-0000-4000-8000-000000000012",
    },
    {
      category: "underdog_player",
      playerId: "10000000-0000-4000-8000-000000000002",
    },
    {
      category: "overrated_player",
      customPlayerName: "Placeholder Player",
    },
  ],
  id: "00000000-0000-4000-8000-000000000001",
  items: Array.from({ length: 20 }, (_, index) => ({
    predictedPosition: index + 1,
    teamId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
  })),
  normalizedParticipantName: "deadline tester",
  participantName: "Deadline Tester",
  receiptTokenHash: "a".repeat(64),
  seasonId: "00000000-0000-4000-8000-000000000002",
};

describe("atomic prediction insertion", () => {
  it("locks the season before checking the wall clock and either insert", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildAtomicPredictionInsertQuery(input),
    );
    const statement = rendered.sql.replaceAll(/\s+/g, " ").trim();

    expect(statement).toContain("locked_season as materialized");
    expect(statement).toContain("deadline_check as materialized");
    expect(statement).toContain("eligible_season as materialized");
    expect(statement).toContain('where "submissions_locked" = false');
    expect(statement).toContain('and "reveal_predictions" = false');
    expect(statement).toContain('and "checked_at" < "opening_kickoff"');
    expect(statement).toContain('or "checked_at" < "submission_deadline"');
    expect(statement).toContain('clock_timestamp() as "checked_at"');
    expect(statement).toContain("for update");
    expect(statement).toContain(
      "from inserted_prediction cross join jsonb_to_recordset",
    );
    expect(statement).toContain('insert into "prediction_category_picks"');
    expect(statement).toContain('returning "prediction_id"');
    expect(statement).toContain(
      "(select count(*)::integer from inserted_items)",
    );
    expect(statement).toContain(
      "(select count(*)::integer from inserted_category_picks)",
    );
    expect(rendered.params).toContain(input.seasonId);
    expect(rendered.params).not.toContainEqual(expect.any(Date));
    expect(rendered.params).toContainEqual(
      expect.stringContaining('"category":"top_scorer"'),
    );
    expect(rendered.params).toContainEqual(
      expect.stringContaining(
        '"normalized_custom_player_name":"placeholder player"',
      ),
    );
  });

  it("reports a lost guard without accepting any item rows", async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ inserted: false, itemCount: 0, pickCount: 0 }],
    });
    const db = { execute } as unknown as Database;

    await expect(insertPredictionAtomically(db, input)).resolves.toBe(false);
  });

  it("rejects incomplete child arrays before building or executing SQL", async () => {
    expect(() =>
      buildAtomicPredictionInsertQuery({
        ...input,
        items: input.items.slice(0, 19),
      }),
    ).toThrow("exactly 20 table items");
    expect(() =>
      buildAtomicPredictionInsertQuery({
        ...input,
        categoryPicks: input.categoryPicks.slice(0, 6),
      }),
    ).toThrow("exactly 7 spotlight picks");

    const execute = vi.fn();
    const db = { execute } as unknown as Database;
    await expect(
      insertPredictionAtomically(db, {
        ...input,
        categoryPicks: input.categoryPicks.slice(0, 6),
      }),
    ).rejects.toThrow("exactly 7 spotlight picks");
    expect(execute).not.toHaveBeenCalled();
  });

  it("accepts only an atomic 20-team plus seven-pick result", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ inserted: true, itemCount: 20, pickCount: 7 }],
      })
      .mockResolvedValueOnce({
        rows: [{ inserted: true, itemCount: 19, pickCount: 7 }],
      })
      .mockResolvedValueOnce({
        rows: [{ inserted: true, itemCount: 20, pickCount: 6 }],
      });
    const db = { execute } as unknown as Database;

    await expect(insertPredictionAtomically(db, input)).resolves.toBe(true);
    await expect(insertPredictionAtomically(db, input)).rejects.toThrow(
      "invalid item count",
    );
    await expect(insertPredictionAtomically(db, input)).rejects.toThrow(
      "invalid pick count",
    );
  });
});
