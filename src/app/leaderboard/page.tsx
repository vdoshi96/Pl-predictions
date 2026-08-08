import { Clock3, EyeOff, Medal, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LeaderboardEntryLink } from "@/features/leaderboard/entry-link";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { getActiveSeasonView } from "@/features/seasons/queries";
import { formatUtcDateTime } from "@/shared/format";

export const metadata: Metadata = { title: "Friends leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [{ season }, view] = await Promise.all([
    getActiveSeasonView(),
    getLeaderboardView(),
  ]);
  const scoringStarted = view.scoredEntries !== null;

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <section className="rounded-3xl bg-slate-950 p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-300 text-slate-950 ring-emerald-300">
              {season.name}
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
              className="mt-1 size-7 shrink-0 text-amber-300"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Friends leaderboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Every score is recalculated from the latest valid table. Equal
                totals share the same rank; tied names are alphabetical.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2">
              <Users aria-hidden="true" className="size-4 text-emerald-300" />
              {view.entries.length}{" "}
              {view.entries.length === 1 ? "entry" : "entries"}
            </span>
            {view.snapshot ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2">
                <Clock3
                  aria-hidden="true"
                  className="size-4 text-emerald-300"
                />
                Updated {formatUtcDateTime(view.snapshot.capturedAt)}
              </span>
            ) : null}
            {view.snapshot?.matchweek ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2">
                Matchweek {view.snapshot.matchweek}
              </span>
            ) : null}
          </div>
        </section>

        {!view.predictionsRevealed ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <EyeOff aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-950">
                  Tables are still private
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Names and submission times are visible now. Full predictions
                  and scoring appear after the deadline, a manual lock, or an
                  early reveal by the owner.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !scoringStarted ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <Medal aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-950">
                  Scoring begins once the season table is active
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  A zero-match preseason order is never scored. The submission
                  roster remains available below.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {view.entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-xl font-black text-slate-950">
                No entries yet
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Be the first friend to submit a full 1–20.
              </p>
              <Link
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-4 text-sm font-black text-slate-950"
                href="/"
              >
                Make your prediction
              </Link>
            </CardContent>
          </Card>
        ) : scoringStarted && view.scoredEntries ? (
          <section aria-label="Scored leaderboard" className="grid gap-3">
            {view.scoredEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:grid-cols-[4rem_1fr_6rem_18rem]">
                  <span
                    className="grid size-11 place-items-center rounded-xl bg-slate-950 text-lg font-black text-white"
                    aria-label={`Rank ${entry.rank}`}
                  >
                    {entry.rank}
                  </span>
                  <div className="min-w-0">
                    <LeaderboardEntryLink
                      entryId={entry.id}
                      participantName={entry.participantName}
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatUtcDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <strong className="block text-2xl font-black text-emerald-700 tabular-nums">
                      {entry.totalScore}
                    </strong>
                    <span className="text-[0.68rem] font-bold tracking-wide text-slate-500 uppercase">
                      points
                    </span>
                  </div>
                  <dl className="col-span-3 grid grid-cols-3 gap-1.5 sm:col-span-1">
                    <div className="rounded-lg bg-emerald-50 p-2 text-center">
                      <dt className="text-[0.64rem] font-bold text-emerald-800 uppercase">
                        Exact
                      </dt>
                      <dd className="font-black text-emerald-900">
                        {entry.exactCount}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-sky-50 p-2 text-center">
                      <dt className="text-[0.64rem] font-bold text-sky-800 uppercase">
                        Within 3
                      </dt>
                      <dd className="font-black text-sky-900">
                        {entry.withinThreeCount}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 text-center">
                      <dt className="text-[0.64rem] font-bold text-slate-600 uppercase">
                        Half
                      </dt>
                      <dd className="font-black text-slate-800">
                        {entry.correctHalfCount}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <section aria-label="Submission roster" className="grid gap-2">
            {view.entries.map((entry, index) => (
              <Card key={entry.publicKey}>
                <CardContent className="flex items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-mono text-sm font-black text-slate-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 grow">
                    {view.predictionsRevealed && entry.id ? (
                      <LeaderboardEntryLink
                        entryId={entry.id}
                        participantName={entry.participantName}
                      />
                    ) : (
                      <span className="block font-black [overflow-wrap:anywhere] text-slate-950">
                        {entry.participantName}
                      </span>
                    )}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Submitted {formatUtcDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <Badge variant="success">In</Badge>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
