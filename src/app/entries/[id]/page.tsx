import { Eye, LockKeyhole, Medal, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TeamMark } from "@/components/team-mark";
import { getEntryComparison } from "@/features/entries/queries";
import { SpotlightPickGrid } from "@/features/leaderboard/spotlight-pick-grid";
import { formatUtcDateTime, ordinal } from "@/shared/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/entries/[id]">): Promise<Metadata> {
  const entry = await getEntryComparison((await params).id);
  return entry
    ? { title: `${entry.participantName}'s prediction` }
    : { title: "Prediction unavailable" };
}

const tierPresentation = {
  exact: { label: "Exact", className: "bg-mint text-mint-ink" },
  "within-three": { label: "Within 3", className: "bg-sky-soft text-brand" },
  "correct-half": {
    label: "Correct half",
    className: "bg-rose-soft text-rose-ink",
  },
  miss: { label: "No points", className: "bg-slate-100 text-slate-700" },
} as const;

export default async function EntryPage({
  params,
}: PageProps<"/entries/[id]">) {
  const entry = await getEntryComparison((await params).id);
  if (!entry) notFound();
  const availableSpotlightCount = entry.spotlightPicks.filter(
    (pick) => pick.accuracyPoints !== null && pick.accuracyPoints !== undefined,
  ).length;

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:gap-7">
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-brand ring-accent">
              2026/27 prediction
            </Badge>
            {entry.predictionsRevealed ? (
              <Badge variant="success">Public</Badge>
            ) : (
              <Badge variant="warning">Private confirmation</Badge>
            )}
            {entry.snapshot ? (
              <Badge variant={entry.snapshot.isFinal ? "accent" : "warning"}>
                {entry.snapshot.isFinal ? "Final" : "Provisional"}
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
            {entry.participantName}&apos;s prediction
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Submitted {formatUtcDateTime(entry.createdAt)}
          </p>
          {entry.totalScore !== null ? (
            <div className="mt-6 flex items-center gap-3">
              <span className="bg-accent text-brand grid size-12 place-items-center rounded-2xl">
                <Medal aria-hidden="true" className="size-6" />
              </span>
              <div>
                <strong className="block text-3xl font-black tabular-nums">
                  {entry.totalScore} table points
                </strong>
                <span className="text-xs font-semibold text-white/65">
                  Main leaderboard score · maximum 100
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {!entry.predictionsRevealed && entry.isOwnerReceipt ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-amber-700"
              />
              <div>
                <h2 className="font-black text-slate-950">
                  Only this browser can see the table
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your secure receipt authorizes this confirmation. Other people
                  cannot enumerate or open it before reveal.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-brand-strong text-xl font-black">
                  Spotlight picks
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  These seven picks are stored with the table. Their separate
                  just-for-fun accuracy appears as result lists become available
                  and never changes the 100-point table score.
                </p>
                {entry.snapshot && !entry.snapshot.isFinal ? (
                  <p className="mt-2 text-xs leading-5 font-semibold text-amber-800">
                    Accuracy uses provisional published snapshots. Shared ties
                    can award the same high rank, including zero-stat rows early
                    in the season.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={availableSpotlightCount > 0 ? "success" : "warning"}
                >
                  {availableSpotlightCount} of 7 results available
                </Badge>
                <Link
                  className="text-brand focus-visible:ring-accent-blue inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-200 px-3 text-xs font-black outline-none hover:bg-purple-50 focus-visible:ring-2"
                  href="/spotlight"
                >
                  <Sparkles aria-hidden="true" className="size-4" />
                  View accuracy table
                </Link>
              </div>
            </div>
            {entry.spotlightPicks.length > 0 ? (
              <SpotlightPickGrid
                className="mt-4"
                picks={entry.spotlightPicks}
              />
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                This legacy entry does not contain spotlight picks.
              </p>
            )}
          </CardContent>
        </Card>

        {entry.snapshot ? (
          <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
            <Eye aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              Standings snapshot {formatUtcDateTime(entry.snapshot.capturedAt)}
              {entry.snapshot.matchweek
                ? ` · Matchweek ${entry.snapshot.matchweek}`
                : ""}
            </span>
          </p>
        ) : (
          <p className="text-sm font-semibold text-slate-600">
            Actual positions and table scoring appear once a meaningful season
            table is active.
          </p>
        )}

        <ol
          className="grid gap-2"
          aria-label={`${entry.participantName}'s predicted table`}
        >
          {entry.comparisonItems.map((item) => {
            const tier = item.tier ? tierPresentation[item.tier] : null;
            return (
              <li key={item.teamId}>
                <Card>
                  <CardContent className="grid grid-cols-[auto_auto_1fr] items-center gap-3 py-3 sm:grid-cols-[3rem_3rem_1fr_7rem_6rem_7rem]">
                    <span
                      className="bg-brand grid size-10 place-items-center rounded-xl font-mono text-sm font-black text-white"
                      aria-label={`Predicted ${ordinal(item.predictedPosition)}`}
                    >
                      {item.predictedPosition}
                    </span>
                    <TeamMark
                      initials={item.shortName}
                      name={item.displayName}
                      size="md"
                      src={item.assetPath}
                    />
                    <span className="min-w-0 font-black [overflow-wrap:anywhere] text-slate-950 sm:truncate">
                      {item.displayName}
                    </span>
                    <div className="col-start-1 text-center sm:col-start-auto">
                      <span className="block text-[0.64rem] font-bold tracking-wide text-slate-500 uppercase">
                        Actual
                      </span>
                      <strong className="font-mono text-sm text-slate-900">
                        {item.actualPosition ?? "—"}
                      </strong>
                    </div>
                    <div className="text-center">
                      <span className="block text-[0.64rem] font-bold tracking-wide text-slate-500 uppercase">
                        Difference
                      </span>
                      <strong className="font-mono text-sm text-slate-900">
                        {item.difference ?? "—"}
                      </strong>
                    </div>
                    <div className="text-right">
                      {tier ? (
                        <span
                          className={`inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-black ${tier.className}`}
                        >
                          {item.points} · {tier.label}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">
                          Not scored
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
