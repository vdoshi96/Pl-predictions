"use client";

import { useState } from "react";

import {
  LeaderboardRosterTable,
  matchesParticipantQuery,
  ScoredLeaderboardBoard,
} from "./leaderboard-board";
import type { LeaderboardRosterEntry, ScoredLeaderboardEntry } from "./queries";

export function LeaderboardExplorer({
  initialQuery,
  predictionsRevealed,
  rosterEntries,
  scoredEntries,
}: {
  initialQuery: string;
  predictionsRevealed: boolean;
  rosterEntries: readonly LeaderboardRosterEntry[];
  scoredEntries: readonly ScoredLeaderboardEntry[] | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const count = scoredEntries?.length ?? rosterEntries.length;

  return (
    <div className="grid gap-4">
      <form
        action="/leaderboard"
        aria-label="Participant filter"
        className="flex items-center gap-2"
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <label className="sr-only" htmlFor="leaderboard-filter">
          Find a participant
        </label>
        <input
          autoComplete="off"
          className="border-border bg-surface min-h-11 w-full max-w-sm rounded-lg border px-3 text-base sm:text-sm"
          id="leaderboard-filter"
          maxLength={80}
          name="q"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${count} ${count === 1 ? "name" : "names"}`}
          type="search"
          value={query}
        />
        {query ? (
          <button
            className="text-brand-ink inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold underline"
            onClick={() => setQuery("")}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </form>
      {scoredEntries ? (
        <ScoredLeaderboardBoard entries={scoredEntries} query={query} />
      ) : (
        <LeaderboardRosterTable
          entries={rosterEntries.filter((entry) =>
            matchesParticipantQuery(entry.participantName, query),
          )}
          predictionsRevealed={predictionsRevealed}
        />
      )}
    </div>
  );
}
