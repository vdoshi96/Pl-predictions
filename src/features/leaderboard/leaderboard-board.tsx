import { TeamMark } from "@/components/team-mark";
import { Card } from "@/components/ui/card";
import { Podium } from "./podium";

import { getEntryAvatar } from "./entry-avatar";
import { LeaderboardEntryLink } from "./entry-link";
import type { LeaderboardRosterEntry, ScoredLeaderboardEntry } from "./queries";

function EntryAvatar({ name }: { name: string }) {
  const avatar = getEntryAvatar(name);
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-black text-white"
      style={{ backgroundColor: avatar.backgroundColor }}
    >
      {avatar.initials}
    </span>
  );
}

function Movement({ value }: { value: number | null }) {
  const climbed = value !== null && value > 0;
  const dropped = value !== null && value < 0;
  const label =
    value === null
      ? "no previous table"
      : climbed
        ? `climbed ${value} ${value === 1 ? "place" : "places"}`
        : dropped
          ? `dropped ${Math.abs(value)} ${value === -1 ? "place" : "places"}`
          : "no rank change";
  return (
    <span
      className={`mt-1 block text-[0.7rem] font-black whitespace-nowrap ${
        climbed ? "text-mint-ink" : dropped ? "text-rose-score" : "text-muted"
      }`}
    >
      <span aria-hidden="true">
        {climbed ? `▲${value}` : dropped ? `▼${Math.abs(value!)}` : "–"}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Champion({
  champion,
}: {
  champion: LeaderboardRosterEntry["champion"];
}) {
  return (
    <span
      aria-label={`Predicted champion: ${champion.displayName}`}
      className="text-brand-ink inline-flex min-w-0 items-center gap-1.5 text-xs font-bold"
    >
      <TeamMark
        decorative
        initials={champion.shortName}
        name={champion.displayName}
        size="sm"
        src={champion.assetPath}
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {champion.displayName}
      </span>
    </span>
  );
}

export function ScoredLeaderboardBoard({
  entries,
  query = "",
}: {
  entries: readonly ScoredLeaderboardEntry[];
  query?: string;
}) {
  const visibleEntries = entries.filter((entry) =>
    entry.participantName
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <section aria-label="Scored leaderboard" className="grid gap-5">
      <Podium entries={entries} />
      {visibleEntries.length === 0 ? (
        <p role="status" className="text-muted py-4 text-sm">
          No matching participant. Try a different name.
        </p>
      ) : null}
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm max-sm:block">
          <caption className="sr-only">
            Table leaderboard with shared ranks, movement, champion picks,
            scoring breakdowns, and points out of 100.
          </caption>
          <thead className="max-sm:sr-only">
            <tr className="border-border text-muted border-b-2 text-left text-[0.62rem] font-black tracking-wider uppercase">
              <th className="w-20 px-3 py-3" scope="col">
                Rank
              </th>
              <th className="px-3 py-3" scope="col">
                Entry
              </th>
              <th className="px-3 py-3" scope="col">
                Champion
              </th>
              <th className="px-3 py-3" scope="col">
                Breakdown
              </th>
              <th className="w-32 px-3 py-3 text-right" scope="col">
                Table points
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {visibleEntries.map((entry) => (
              <tr
                aria-label={`${entry.participantName} leaderboard entry`}
                className="border-surface-lilac-border hover:bg-surface-subtle border-b align-middle last:border-b-0 max-sm:grid max-sm:min-h-24 max-sm:grid-cols-[3rem_minmax(0,1fr)_auto] max-sm:grid-rows-[auto_auto] max-sm:items-center max-sm:gap-x-2 max-sm:px-3 max-sm:py-2"
                key={entry.id}
              >
                <td className="px-3 py-2 max-sm:col-start-1 max-sm:row-span-2 max-sm:p-0">
                  <span
                    aria-label={`Rank ${entry.rank}`}
                    className="bg-brand grid size-9 place-items-center rounded-xl font-black text-white"
                  >
                    {entry.rank}
                  </span>
                  <Movement value={entry.movement} />
                </td>
                <td className="min-w-0 px-3 py-2 max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <EntryAvatar name={entry.participantName} />
                    <LeaderboardEntryLink
                      entryId={entry.id}
                      participantName={entry.participantName}
                    />
                  </span>
                </td>
                <td className="px-3 py-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:p-0">
                  <Champion champion={entry.champion} />
                </td>
                <td className="px-3 py-2 max-sm:sr-only">
                  <span className="flex flex-wrap gap-1.5">
                    <span className="bg-mint text-mint-ink rounded-full px-2 py-1 text-[0.68rem] font-black">
                      {entry.exactCount} exact
                    </span>
                    <span className="bg-sky-soft text-brand-ink rounded-full px-2 py-1 text-[0.68rem] font-black">
                      {entry.withinThreeCount} within 3
                    </span>
                    <span className="bg-rose-soft text-rose-ink rounded-full px-2 py-1 text-[0.68rem] font-black">
                      {entry.correctHalfCount} half
                    </span>
                  </span>
                  <span className="sr-only">
                    {entry.exactCount} exact, {entry.withinThreeCount} within 3,
                    {entry.correctHalfCount} in the correct half
                  </span>
                </td>
                <td className="px-3 py-2 text-right max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0">
                  <strong className="text-rose-score block text-xl font-black tabular-nums">
                    {entry.totalScore}
                  </strong>
                  <span className="text-muted text-[0.62rem] font-bold uppercase">
                    table points
                  </span>
                  <span
                    aria-label={`${entry.totalScore} of 100 table points`}
                    className="border-border bg-surface-subtle mt-1 ml-auto block h-2 w-24 overflow-hidden rounded-full border max-sm:w-16"
                    role="progressbar"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={entry.totalScore}
                  >
                    <span
                      className="from-accent-lilac to-accent-pink block h-full rounded-full bg-gradient-to-r"
                      style={{
                        width: `${Math.min(100, Math.max(0, entry.totalScore))}%`,
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

export function LeaderboardRosterTable({
  entries,
  predictionsRevealed,
}: {
  entries: readonly LeaderboardRosterEntry[];
  predictionsRevealed: boolean;
}) {
  return (
    <section aria-label="Submission roster">
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm max-sm:block">
          <caption className="sr-only">
            Active prediction entries and their public champion picks.
          </caption>
          <thead className="max-sm:sr-only">
            <tr className="border-border text-muted border-b-2 text-left text-[0.62rem] font-black tracking-wider uppercase">
              <th className="w-16 px-3 py-3" scope="col">
                Rank
              </th>
              <th className="px-3 py-3" scope="col">
                Entry
              </th>
              <th className="px-3 py-3" scope="col">
                Champion
              </th>
              <th className="w-28 px-3 py-3 text-right" scope="col">
                Table points
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {entries.map((entry) => (
              <tr
                aria-label={`${entry.participantName} leaderboard entry`}
                className="border-surface-lilac-border border-b last:border-b-0 max-sm:grid max-sm:min-h-20 max-sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] max-sm:grid-rows-2 max-sm:items-center max-sm:gap-x-2 max-sm:px-3 max-sm:py-2"
                key={entry.publicKey}
              >
                <td className="px-3 py-2 max-sm:col-start-1 max-sm:row-span-2 max-sm:p-0">
                  <span
                    aria-label="Rank pending"
                    className="bg-brand grid size-9 place-items-center rounded-xl font-black text-white"
                  >
                    —
                  </span>
                </td>
                <td className="min-w-0 px-3 py-2 max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <EntryAvatar name={entry.participantName} />
                    {predictionsRevealed && entry.id ? (
                      <LeaderboardEntryLink
                        entryId={entry.id}
                        participantName={entry.participantName}
                      />
                    ) : (
                      <span className="text-foreground font-black [overflow-wrap:anywhere]">
                        {entry.participantName}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:p-0">
                  <Champion champion={entry.champion} />
                </td>
                <td className="px-3 py-2 text-right max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0">
                  <strong className="text-rose-score block text-xl font-black tabular-nums">
                    {entry.totalScore}
                  </strong>
                  <span className="text-muted text-[0.62rem] font-bold uppercase">
                    table points
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
