import { CalendarDays, Flame } from "lucide-react";
import type { Metadata } from "next";

import {
  createWinStreakProfileAction,
  submitWinStreakPickAction,
} from "@/app/actions/win-streak";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WIN_STREAK_SOURCE } from "@/features/win-streak/fixtures";
import { getWinStreakPageData } from "@/features/win-streak/queries";
import { WinStreakEntryPanel } from "@/features/win-streak/win-streak-entry-panel";
import { WinStreakLeaderboard } from "@/features/win-streak/win-streak-leaderboard";
import { formatChicagoUtcDateTime } from "@/shared/format";

export const metadata: Metadata = {
  description:
    "Pick one Premier League club to win each matchweek and build your longest streak.",
  title: "Win Streak",
};

export const dynamic = "force-dynamic";

function Hero({
  activeRound,
}: {
  activeRound: Awaited<ReturnType<typeof getWinStreakPageData>>["activeRound"];
}) {
  const roundState = activeRound
    ? activeRound.pickOpen
      ? `Matchweek ${activeRound.matchweek} open`
      : `Matchweek ${activeRound.matchweek} locked`
    : "Season complete";

  return (
    <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-accent text-accent-ink ring-accent">
          Live game
        </Badge>
        <Badge className="bg-white/10 text-white ring-white/20">
          {roundState}
        </Badge>
        <Badge className="bg-white/10 text-white ring-white/20">
          Public picks
        </Badge>
      </div>
      <div className="mt-5 flex items-start gap-3">
        <Flame
          aria-hidden="true"
          className="text-accent-blue mt-1 size-7 shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
            Win Streak
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            Pick one club to win each matchweek. A win extends your streak; a
            draw or loss resets it. Winning clubs stay unavailable until the
            streak breaks.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs leading-5 font-semibold text-white/70">
        <span>Matchweeks 2–38</span>
        <span>37 shared rounds</span>
        <span>No account or password</span>
        {activeRound ? (
          <span>Locks {formatChicagoUtcDateTime(activeRound.deadlineAt)}</span>
        ) : null}
      </div>
    </section>
  );
}

function SourceNote() {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <CalendarDays
          aria-hidden="true"
          className="text-accent-lilac mt-0.5 size-5 shrink-0"
        />
        <div className="min-w-0">
          <h2 className="text-brand-ink-strong font-black">
            Official fixture snapshot
          </h2>
          <p className="text-muted mt-1 text-xs leading-5 sm:text-sm">
            Matchweeks 2–38 use a reviewed Premier League fixture snapshot
            checked {WIN_STREAK_SOURCE.checkedAt}. Fixtures remain subject to
            change. This page never fetches football data at runtime.{" "}
            <a
              className="text-brand-ink font-bold underline underline-offset-4"
              href={WIN_STREAK_SOURCE.fixtureListUrl}
              rel="noreferrer"
              target="_blank"
            >
              View the official fixture list
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function WinStreakPage() {
  const view = await getWinStreakPageData();

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-5 sm:gap-7">
        <Hero activeRound={view.activeRound} />
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(20rem,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-7">
          <div className="min-w-0 lg:sticky lg:top-5">
            <WinStreakEntryPanel
              activeRound={view.activeRound}
              createProfileAction={createWinStreakProfileAction}
              submitPickAction={submitWinStreakPickAction}
              viewer={view.viewer}
            />
          </div>
          <div className="min-w-0">
            <WinStreakLeaderboard entries={view.leaderboard} />
          </div>
        </div>
        <SourceNote />
      </div>
    </main>
  );
}
