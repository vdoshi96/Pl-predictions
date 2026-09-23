import { Eye, LockKeyhole, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeagueTime } from "@/components/league-time";
import { SnapshotStatus } from "@/components/snapshot-status";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EntryComparePicker } from "@/features/entries/entry-compare-picker";
import { EntryComparisonTable } from "@/features/entries/entry-comparison-table";
import { EntryPager } from "@/features/entries/entry-pager";
import { findAdjacentEntries } from "@/features/entries/navigation";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { getEntryComparison } from "@/features/entries/queries";
import { SpotlightPickGrid } from "@/features/leaderboard/spotlight-pick-grid";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/entries/[id]">): Promise<Metadata> {
  const entry = await getEntryComparison((await params).id);
  return entry
    ? { title: `${entry.participantName}'s prediction` }
    : { title: "Prediction unavailable" };
}

export default async function EntryPage({
  params,
  searchParams,
}: PageProps<"/entries/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const entry = await getEntryComparison(id);
  if (!entry) notFound();
  const board = entry.predictionsRevealed ? await getLeaderboardView() : null;
  const boardEntries: readonly {
    id: string | null;
    participantName: string;
  }[] = board ? (board.scoredEntries ?? board.entries) : [];
  const ordered = boardEntries.flatMap((candidate) =>
    candidate.id
      ? [{ id: candidate.id, participantName: candidate.participantName }]
      : [],
  );
  const navigation = findAdjacentEntries(ordered, entry.id);
  const compareId = typeof query.compare === "string" ? query.compare : null;
  const compareEntry =
    entry.predictionsRevealed && compareId && compareId !== entry.id
      ? await getEntryComparison(compareId)
      : null;
  const compare = compareEntry?.predictionsRevealed
    ? {
        participantName: compareEntry.participantName,
        positions: Object.fromEntries(
          compareEntry.comparisonItems.map((item) => [
            item.teamId,
            item.predictedPosition,
          ]),
        ),
      }
    : null;
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
          <LeagueTime prefix="Submitted" value={entry.createdAt} />
          {entry.snapshot ? (
            <SnapshotStatus isFinal={entry.snapshot.isFinal} />
          ) : null}
        </PageHeading>
        {navigation ? <EntryPager navigation={navigation} /> : null}
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
              <LeagueTime
                prefix="Standings from"
                value={entry.snapshot.capturedAt}
              />
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

        {entry.predictionsRevealed && ordered.length > 1 ? (
          <EntryComparePicker
            activeCompareId={compare ? compareId : null}
            entryId={entry.id}
            others={ordered.filter((other) => other.id !== entry.id)}
          />
        ) : null}
        <EntryComparisonTable
          compare={compare}
          items={entry.comparisonItems}
          participantName={entry.participantName}
          totalScore={entry.totalScore}
        />

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
