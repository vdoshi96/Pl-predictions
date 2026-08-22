import { Clock3, EyeOff, Medal, Sparkles, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  LeaderboardRosterTable,
  ScoredLeaderboardBoard,
} from "@/features/leaderboard/leaderboard-board";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { formatChicagoUtcDateTime } from "@/shared/format";

export const metadata: Metadata = { title: "Table leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const view = await getLeaderboardView();
  const scoringStarted = view.scoredEntries !== null;

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-accent-ink ring-accent">
              {view.seasonName}
            </Badge>
            <Badge className="bg-white/15 text-white ring-white/20">
              100-point table
            </Badge>
            {view.snapshot ? (
              <Badge variant={view.snapshot.isFinal ? "accent" : "warning"}>
                {view.snapshot.isFinal ? "Final" : "Provisional"}
              </Badge>
            ) : null}
          </div>
          <div className="mt-5 flex items-start gap-3">
            <Trophy
              aria-hidden="true"
              className="text-accent-blue mt-1 size-7 shrink-0"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Dranx Prediction League
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                The table leaderboard is recalculated from the latest valid
                standings and always stays within 100 points. Spotlight picks
                have a separate just-for-fun accuracy table.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/75">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-2">
              Table points · maximum 100
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
              <Users aria-hidden="true" className="text-accent size-4" />
              {view.entries.length}{" "}
              {view.entries.length === 1 ? "entry" : "entries"}
            </span>
            {view.snapshot ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Clock3
                  aria-hidden="true"
                  className="text-accent-blue size-4"
                />
                Updated {formatChicagoUtcDateTime(view.snapshot.capturedAt)}
              </span>
            ) : null}
            {view.snapshot?.matchweek ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                Matchweek {view.snapshot.matchweek}
              </span>
            ) : null}
            <Link
              className="bg-accent text-accent-ink hover:bg-accent-yellow inline-flex min-h-10 items-center gap-2 rounded-xl px-3 font-black transition-colors"
              href="/spotlight"
            >
              <Sparkles aria-hidden="true" className="size-4" />
              View spotlight accuracy
            </Link>
          </div>
        </section>

        {!view.predictionsRevealed ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="bg-surface-subtle text-muted grid size-11 shrink-0 place-items-center rounded-xl">
                <EyeOff aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-foreground font-black">
                  Full tables are still private
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  Everyone is on 0 table points, and only each predicted
                  champion is public now. The other 19 positions and all seven
                  spotlight picks stay private until the opening kickoff, a
                  manual lock, or an early reveal by the owner.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !scoringStarted ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="bg-warning-soft text-warning grid size-11 shrink-0 place-items-center rounded-xl">
                <Medal aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-foreground font-black">
                  {view.seasonStarted
                    ? "Waiting for the first active table"
                    : "Everyone starts on 0 points"}
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  {view.seasonStarted
                    ? "Table scores will recalculate as soon as a meaningful standings snapshot is active."
                    : "Only predicted champions are shown until Arsenal v Coventry kicks off."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {view.entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-foreground text-xl font-black">
                No entries yet
              </h2>
              <p className="text-muted mt-2 text-sm">
                Be the first to submit a full 1–20.
              </p>
              <Link
                className="bg-accent text-accent-ink hover:bg-accent-yellow mt-5 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black"
                href="/"
              >
                Make your prediction
              </Link>
            </CardContent>
          </Card>
        ) : scoringStarted && view.scoredEntries ? (
          <ScoredLeaderboardBoard entries={view.scoredEntries} />
        ) : (
          <LeaderboardRosterTable
            entries={view.entries}
            predictionsRevealed={view.predictionsRevealed}
          />
        )}
      </div>
    </main>
  );
}
