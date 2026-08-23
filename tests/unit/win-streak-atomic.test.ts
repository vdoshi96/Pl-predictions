import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/client";
import {
  buildAtomicWinStreakPickQuery,
  buildCreateWinStreakProfileQuery,
  insertWinStreakPickAtomically,
  insertWinStreakProfileAtomically,
  WIN_STREAK_PROFILE_LIMIT,
} from "@/features/win-streak/atomic";

const profileInput = {
  id: "00000000-0000-4000-8000-000000000001",
  normalizedParticipantName: "ada",
  participantName: "Ada",
  receiptTokenHash: "a".repeat(64),
  seasonId: "00000000-0000-4000-8000-000000000002",
};

describe("atomic Win Streak writes", () => {
  it("locks the current unresolved round before sampling the profile join clock", () => {
    const rendered = new PgDialect().sqlToQuery(
      buildCreateWinStreakProfileQuery(profileInput),
    );
    const statement = rendered.sql.replaceAll(/\s+/gu, " ").trim();

    expect(statement).toContain('"locked_round" as materialized');
    expect(statement).toContain("for update");
    expect(statement).toContain('clock_timestamp() as "checked_at"');
    expect(statement).toContain('"checked_at" < "pick_deadline"');
    expect(statement).toContain('insert into "win_streak_profiles"');
    expect(statement).toContain('select count(*) from "win_streak_profiles"');
    expect(rendered.params).toContain(WIN_STREAK_PROFILE_LIMIT);
    expect(rendered.params).toContain(profileInput.seasonId);
    expect(rendered.params).toContain(profileInput.receiptTokenHash);
  });

  it("authenticates the receipt and locks the same current round before inserting a pick", () => {
    const input = {
      id: "00000000-0000-4000-8000-000000000003",
      profileId: profileInput.id,
      receiptTokenHash: profileInput.receiptTokenHash,
      teamSlug: "arsenal",
    } as const;
    const rendered = new PgDialect().sqlToQuery(
      buildAtomicWinStreakPickQuery(input),
    );
    const statement = rendered.sql.replaceAll(/\s+/gu, " ").trim();

    expect(statement).toContain('"locked_profile" as materialized');
    expect(statement).toContain('"locked_round" as materialized');
    expect(statement).toContain('receipt_token_hash" =');
    expect(statement).toContain('team."slug" =');
    expect(statement).toContain('insert into "win_streak_picks"');
    expect(statement).toContain('"checked_at" < checked_round."pick_deadline"');
    expect(rendered.params).toContain(input.profileId);
    expect(rendered.params).toContain(input.teamSlug);
  });

  it("returns false when either guarded insert loses eligibility", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const db = { execute } as unknown as Database;

    await expect(
      insertWinStreakProfileAtomically(db, profileInput),
    ).resolves.toBe(false);
    await expect(
      insertWinStreakPickAtomically(db, {
        id: "00000000-0000-4000-8000-000000000003",
        profileId: profileInput.id,
        receiptTokenHash: profileInput.receiptTokenHash,
        teamSlug: "arsenal",
      }),
    ).resolves.toBe(false);
  });
});
