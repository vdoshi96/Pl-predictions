import { Clock3, EyeOff, Medal, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChampionPick } from "@/features/leaderboard/champion-pick";
import { LeaderboardEntryLink } from "@/features/leaderboard/entry-link";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { getActiveSeasonView } from "@/features/seasons/queries";
import { formatUtcDateTime } from "@/shared/format";

export const metadata: Metadata = { title: "Leaderboard" };
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
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-brand ring-accent">
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
              className="text-accent-blue mt-1 size-7 shrink-0"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Dranx Prediction League
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                Every score is recalculated from the latest valid table. Equal
                totals share the same rank; tied names are alphabetical.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-white/75">
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
                Updated {formatUtcDateTime(view.snapshot.capturedAt)}
              </span>
            ) : null}
            {view.snapshot?.matchweek ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
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
                  Full tables are still private
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Everyone is on 0 points, and only each predicted champion is
                  public now. The other 19 positions stay private until the
                  opening kickoff, a manual lock, or an early reveal by the
                  owner.
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
                  {view.seasonStarted
                    ? "Waiting for the first active table"
                    : "Everyone starts on 0 points"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {view.seasonStarted
                    ? "Scores will recalculate as soon as a meaningful standings snapshot is active."
                    : "Only predicted champions are shown until Arsenal v Coventry kicks off."}
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
                Be the first to submit a full 1–20.
              </p>
              <Link
                className="bg-accent text-brand hover:bg-accent-yellow mt-5 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black"
                href="/"
              >
                Make your prediction
              </Link>
            </CardContent>
          </Card>
        ) : scoringStarted && view.scoredEntries ? (
          <section aria-label="Scored leaderboard" className="grid gap-3">
            {view.scoredEntries.map((entry) => (
              <Card
                aria-label={`${entry.participantName} leaderboard entry`}
                key={entry.id}
                role="article"
              >
                <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:grid-cols-[4rem_1fr_6rem]">
                  <span
                    className="bg-brand grid size-11 place-items-center rounded-xl text-lg font-black text-white"
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
                    <strong className="block text-2xl font-black text-[#c80047] tabular-nums">
                      {entry.totalScore}
                    </strong>
                    <span className="text-[0.68rem] font-bold tracking-wide text-slate-500 uppercase">
                      points
                    </span>
                  </div>
                  <div className="col-span-3 grid min-w-0 gap-2 sm:col-span-2 sm:col-start-2 sm:grid-cols-[minmax(0,1fr)_18rem]">
                    <ChampionPick champion={entry.champion} />
                    <dl className="grid grid-cols-3 gap-1.5">
                      <div className="rounded-lg bg-[#ddffef] p-2 text-center">
                        <dt className="text-[0.64rem] font-bold text-[#075d42] uppercase">
                          Exact
                        </dt>
                        <dd className="font-black text-[#064c37]">
                          {entry.exactCount}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-[#dffcff] p-2 text-center">
                        <dt className="text-brand text-[0.64rem] font-bold uppercase">
                          Within 3
                        </dt>
                        <dd className="text-brand-strong font-black">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <section aria-label="Submission roster" className="grid gap-2">
            {view.entries.map((entry) => (
              <Card
                aria-label={`${entry.participantName} leaderboard entry`}
                key={entry.publicKey}
                role="article"
              >
                <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)_5rem]">
                  <div className="min-w-0">
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
                  <ChampionPick
                    champion={entry.champion}
                    className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                  />
                  <div className="col-start-2 row-start-1 text-right sm:col-start-3">
                    <strong className="block text-2xl font-black text-[#c80047] tabular-nums">
                      {entry.totalScore}
                    </strong>
                    <span className="text-[0.68rem] font-bold tracking-wide text-slate-500 uppercase">
                      points
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
