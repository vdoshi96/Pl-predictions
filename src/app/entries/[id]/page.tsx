import { Eye, LockKeyhole, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TeamMark } from "@/components/team-mark";
import { getEntryComparison } from "@/features/entries/queries";
import { SpotlightPickGrid } from "@/features/leaderboard/spotlight-pick-grid";
import { formatChicagoUtcDateTime, ordinal } from "@/shared/format";

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
  "within-three": {
    label: "Within 3",
    className: "bg-sky-soft text-brand-ink",
  },
  "correct-half": {
    label: "Correct half",
    className: "bg-rose-soft text-rose-ink",
  },
  miss: { label: "No points", className: "bg-surface-subtle text-muted" },
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
    <main id="main-content" className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:gap-7">
        <PageHeading
          title={`${entry.participantName}'s prediction`}
          description="The original prediction, against the published season table."
          status={
            <Badge variant={entry.predictionsRevealed ? "success" : "warning"}>
              {entry.predictionsRevealed ? "Public" : "Private confirmation"}
            </Badge>
          }
        >
          <span>Submitted {formatChicagoUtcDateTime(entry.createdAt)}</span>
          {entry.snapshot ? (
            <Badge variant={entry.snapshot.isFinal ? "success" : "warning"}>
              {entry.snapshot.isFinal ? "Final" : "Provisional"}
            </Badge>
          ) : null}
          {entry.totalScore !== null ? (
            <strong className="text-brand-ink text-xl">
              {entry.totalScore} / 100 table points
            </strong>
          ) : null}
        </PageHeading>
        {!entry.predictionsRevealed && entry.isOwnerReceipt ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <LockKeyhole
                aria-hidden="true"
                className="text-warning mt-0.5 size-5 shrink-0"
              />
              <div>
                <h2 className="text-foreground font-black">
                  Only this browser can see the table
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  Your secure receipt authorizes this confirmation. Before
                  reveal, opening this address in a different browser does not
                  replace the receipt. Keep this browser’s cookies to return to
                  your entry.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {entry.snapshot ? (
          <p className="text-muted flex min-w-0 items-center gap-2 text-xs font-semibold">
            <Eye aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              Standings snapshot{" "}
              {formatChicagoUtcDateTime(entry.snapshot.capturedAt)}
              {entry.snapshot.matchweek
                ? ` · Matchweek ${entry.snapshot.matchweek}`
                : ""}
            </span>
          </p>
        ) : (
          <p className="text-muted text-sm font-semibold">
            Actual positions and table scoring appear once a meaningful season
            table is active.
          </p>
        )}

        <ol
          className="entry-comparison"
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
                    <span className="text-foreground min-w-0 font-black [overflow-wrap:anywhere] sm:truncate">
                      {item.displayName}
                    </span>
                    <div className="col-start-1 text-center sm:col-start-auto">
                      <span className="text-muted block text-[0.64rem] font-bold tracking-wide uppercase">
                        Actual
                      </span>
                      <strong className="text-foreground font-mono text-sm">
                        {item.actualPosition ?? "—"}
                      </strong>
                    </div>
                    <div className="text-center">
                      <span className="text-muted block text-[0.64rem] font-bold tracking-wide uppercase">
                        Difference
                      </span>
                      <strong className="text-foreground font-mono text-sm">
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
                        <span className="text-muted text-sm font-bold">
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

        <Card>
          <CardContent>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-brand-ink-strong text-xl font-black">
                  Spotlight picks
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  These seven picks are stored with the table. Their separate
                  just-for-fun accuracy appears as result lists become available
                  and never changes the 100-point table score.
                </p>
                {entry.snapshot && !entry.snapshot.isFinal ? (
                  <p className="text-warning mt-2 text-xs leading-5 font-semibold">
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
                  className="text-brand-ink focus-visible:ring-accent-blue border-accent-lilac/30 hover:bg-brand-soft inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black outline-none focus-visible:ring-2"
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
              <p className="bg-surface-subtle text-muted mt-4 rounded-xl p-3 text-sm">
                This legacy entry does not contain spotlight picks.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
