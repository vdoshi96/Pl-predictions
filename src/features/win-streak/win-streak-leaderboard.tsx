import { Flame, Trophy } from "lucide-react";

import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

import { getWinStreakTeam } from "./fixtures";
import type {
  WinStreakLeaderboardRow,
  WinStreakPublicPick,
} from "./view-model";

function PickSummary({ pick }: { pick: WinStreakPublicPick | null }) {
  if (!pick) {
    return <span className="text-muted text-xs">No pick yet</span>;
  }

  const team = getWinStreakTeam(pick.teamSlug);
  const opponent = getWinStreakTeam(pick.opponentTeamSlug);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamMark
        decorative
        name={team.displayName}
        initials={team.shortName}
        src={team.assetPath}
        size="sm"
      />
      <span className="min-w-0">
        <strong className="text-brand-ink-strong block text-xs leading-4 break-words sm:text-sm">
          {team.displayName}
        </strong>
        <span className="text-muted block text-[0.68rem] leading-4">
          MW{pick.matchweek} · {pick.isHome ? "Home vs" : "Away at"}{" "}
          {opponent.displayName}
        </span>
      </span>
    </span>
  );
}

export function WinStreakLeaderboard({
  entries,
}: {
  entries: readonly WinStreakLeaderboardRow[];
}) {
  return (
    <Card
      className="panel-shadow overflow-hidden"
      data-testid="win-streak-leaderboard"
    >
      <CardHeader className="pb-4 sm:pb-5">
        <div className="flex items-start gap-3">
          <span className="bg-mint text-mint-ink grid size-11 shrink-0 place-items-center rounded-xl">
            <Trophy aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-brand-ink-strong text-xl font-black tracking-tight">
                Win Streak leaderboard
              </h2>
              <Badge variant="success">Public</Badge>
            </div>
            <p className="text-muted mt-1 text-sm leading-5">
              Ranked by personal best. Tied bests share a rank; current picks
              are visible as soon as they are locked.
            </p>
          </div>
        </div>
      </CardHeader>

      {entries.length === 0 ? (
        <div className="border-border border-t p-6 text-center sm:p-8">
          <Flame
            aria-hidden="true"
            className="text-accent-pink mx-auto size-7"
          />
          <p className="text-brand-ink-strong mt-3 font-black">
            No streaks yet
          </p>
          <p className="text-muted mt-1 text-sm">
            The first confirmed Matchweek 2 pick will appear here.
          </p>
        </div>
      ) : (
        <>
          <ol
            className="border-border grid border-t sm:hidden"
            aria-label="Win Streak leaderboard"
          >
            {entries.map((entry, index) => (
              <li
                key={`${entry.displayName}-${index}`}
                className="border-border grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-3 border-b p-3 last:border-b-0"
              >
                <span className="bg-brand-soft text-brand-ink grid size-9 place-items-center rounded-xl font-mono text-sm font-black tabular-nums">
                  {entry.rank}
                </span>
                <div className="min-w-0">
                  <strong className="text-brand-ink-strong block leading-5 font-black [overflow-wrap:anywhere]">
                    {entry.displayName}
                  </strong>
                  {entry.isViewer ? (
                    <Badge className="mt-1" variant="accent">
                      You
                    </Badge>
                  ) : null}
                </div>
                <span className="text-center">
                  <span className="text-muted block text-[0.58rem] font-black tracking-wide uppercase">
                    Current
                  </span>
                  <strong className="text-brand-ink-strong font-mono text-lg tabular-nums">
                    {entry.currentStreak}
                  </strong>
                </span>
                <span className="text-center">
                  <span className="text-muted block text-[0.58rem] font-black tracking-wide uppercase">
                    Best
                  </span>
                  <strong className="text-rose-score font-mono text-lg font-black tabular-nums">
                    {entry.bestStreak}
                  </strong>
                </span>
                <div className="border-border col-span-4 min-w-0 border-t pt-3">
                  <PickSummary pick={entry.currentPick} />
                </div>
              </li>
            ))}
          </ol>

          <div className="border-border hidden overflow-x-auto border-t sm:block">
            <table
              className="w-full table-fixed text-left text-sm"
              aria-label="Win Streak leaderboard"
            >
              <thead className="bg-brand-soft text-brand-ink text-[0.65rem] tracking-wide uppercase">
                <tr>
                  <th className="w-16 px-3 py-2.5 text-center font-black">
                    Rank
                  </th>
                  <th className="w-[26%] px-3 py-2.5 font-black">Player</th>
                  <th className="px-3 py-2.5 font-black">Current pick</th>
                  <th className="w-20 px-2 py-2.5 text-center font-black">
                    Current
                  </th>
                  <th className="w-20 px-2 py-2.5 text-center font-black">
                    Best
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={`${entry.displayName}-${index}`}
                    className="border-border border-t first:border-t-0"
                  >
                    <td className="px-3 py-3 text-center font-mono font-black tabular-nums">
                      {entry.rank}
                    </td>
                    <th
                      scope="row"
                      className="text-brand-ink-strong px-3 py-3 leading-5 font-bold [overflow-wrap:anywhere]"
                    >
                      <span>{entry.displayName}</span>
                      {entry.isViewer ? (
                        <Badge className="ml-2 align-middle" variant="accent">
                          You
                        </Badge>
                      ) : null}
                    </th>
                    <td className="px-3 py-3">
                      <PickSummary pick={entry.currentPick} />
                    </td>
                    <td className="px-2 py-3 text-center font-mono tabular-nums">
                      {entry.currentStreak}
                    </td>
                    <td className="text-rose-score px-2 py-3 text-center font-mono font-black tabular-nums">
                      {entry.bestStreak}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
