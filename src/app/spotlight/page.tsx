import { EyeOff, SlidersHorizontal, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SPOTLIGHT_SCORING_MESSAGE } from "@/content/public-copy";
import { LeaderboardEntryLink } from "@/features/leaderboard/entry-link";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { SpotlightPickGrid } from "@/features/leaderboard/spotlight-pick-grid";
import {
  PREDICTION_CATEGORY_DEFINITIONS,
  isPredictionCategory,
  type PredictionCategory,
} from "@/features/predictions/categories";
import { formatUtcDateTime } from "@/shared/format";

export const metadata: Metadata = { title: "Spotlight accuracy" };
export const dynamic = "force-dynamic";

type SpotlightSort = "overall" | PredictionCategory;

const sortOptions: readonly { label: string; value: SpotlightSort }[] = [
  { label: "Overall", value: "overall" },
  ...PREDICTION_CATEGORY_DEFINITIONS.map((definition) => ({
    label: definition.label,
    value: definition.category,
  })),
];

const nameCollator = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});

function parseSort(value: string | string[] | undefined): SpotlightSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isPredictionCategory(candidate) ? candidate : "overall";
}

function resultRankFor(
  entry: NonNullable<
    Awaited<ReturnType<typeof getLeaderboardView>>["spotlightAccuracyEntries"]
  >[number],
  category: PredictionCategory,
) {
  return entry.spotlightPicks.find((pick) => pick.category === category)
    ?.resultRank;
}

function resultFor(
  entry: NonNullable<
    Awaited<ReturnType<typeof getLeaderboardView>>["spotlightAccuracyEntries"]
  >[number],
  category: PredictionCategory,
) {
  return entry.spotlightPicks.find((pick) => pick.category === category);
}

export default async function SpotlightPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const [view, query] = await Promise.all([getLeaderboardView(), searchParams]);
  const sort = parseSort(query.sort);
  const selectedDefinition =
    sort === "overall"
      ? null
      : PREDICTION_CATEGORY_DEFINITIONS.find(
          (definition) => definition.category === sort,
        );
  const entries = view.spotlightAccuracyEntries
    ? [...view.spotlightAccuracyEntries]
    : null;
  const hasAvailableResults = Boolean(
    entries?.some((entry) => entry.availableCategoryCount > 0),
  );

  if (entries && sort !== "overall") {
    entries.sort((left, right) => {
      const leftRank = resultRankFor(left, sort) ?? Number.POSITIVE_INFINITY;
      const rightRank = resultRankFor(right, sort) ?? Number.POSITIVE_INFINITY;
      return (
        leftRank - rightRank ||
        nameCollator.compare(left.participantName, right.participantName)
      );
    });
  }

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-brand ring-accent">
              {view.seasonName}
            </Badge>
            <Badge className="bg-white/15 text-white ring-white/20">
              Just for fun
            </Badge>
          </div>
          <div className="mt-5 flex items-start gap-3">
            <Sparkles
              aria-hidden="true"
              className="text-accent-blue mt-1 size-7 shrink-0"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Spotlight accuracy
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                This separate page tracks how highly each selected player or
                club finishes in its outcome list. It never changes the main
                100-point table leaderboard.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/75">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-2">
              {view.entries.length} active{" "}
              {view.entries.length === 1 ? "bracket" : "brackets"}
            </span>
            <Link
              className="bg-accent text-brand hover:bg-accent-yellow inline-flex min-h-10 items-center rounded-xl px-3 font-black transition-colors"
              href="/leaderboard"
            >
              View table leaderboard
            </Link>
          </div>
        </section>

        <Card>
          <CardContent className="flex items-start gap-3">
            <span className="bg-brand-soft text-brand grid size-11 shrink-0 place-items-center rounded-xl">
              <Trophy aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-brand-strong text-xl font-black">
                How spotlight points work
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {SPOTLIGHT_SCORING_MESSAGE}
              </p>
              <Link
                className="text-brand focus-visible:ring-accent-blue mt-3 inline-flex min-h-11 items-center rounded-lg font-black underline decoration-2 underline-offset-4 outline-none focus-visible:ring-2"
                href="/rules#spotlight-scoring"
              >
                Read the full scoring rules
              </Link>
            </div>
          </CardContent>
        </Card>

        <section
          aria-labelledby="spotlight-sort-heading"
          className="grid gap-3"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              aria-hidden="true"
              className="text-brand size-5 shrink-0"
            />
            <h2
              id="spotlight-sort-heading"
              className="text-brand-strong text-xl font-black"
            >
              Real bracket accuracy
            </h2>
          </div>
          <nav aria-label="Sort spotlight accuracy">
            <ul className="flex flex-wrap gap-2">
              {sortOptions.map((option) => {
                const active = option.value === sort;
                return (
                  <li key={option.value}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`focus-visible:ring-accent-blue inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-black outline-none focus-visible:ring-2 ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-border bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      href={
                        option.value === "overall"
                          ? "/spotlight"
                          : `/spotlight?sort=${option.value}`
                      }
                    >
                      {option.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </section>

        {!view.predictionsRevealed ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <EyeOff
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-slate-600"
              />
              <div>
                <h2 className="font-black text-slate-950">
                  Spotlight picks are still private
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  The accuracy table appears only after the season reveal. The
                  active bracket count includes only complete entries containing
                  all 20 table positions and all seven spotlight picks.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : entries === null ? (
          <Card>
            <CardContent className="py-8 text-center">
              <h2 className="text-lg font-black text-slate-950">
                Accuracy results are not available yet
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Real rankings appear after a meaningful active table exists and
                category outcomes are available. Pending manual results do not
                count as zero.
              </p>
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <h2 className="text-lg font-black text-slate-950">
                No revealed brackets yet
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Submitted spotlight picks will appear here after reveal.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {!hasAvailableResults ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent>
                  <h2 className="font-black text-amber-950">
                    Accuracy rankings are not available yet
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    Revealed choices are listed below, but no entered category
                    result is available. Pending picks do not create a zero
                    score or an overall accuracy rank.
                  </p>
                </CardContent>
              </Card>
            ) : null}
            <section
              aria-label="Spotlight accuracy leaderboard"
              className="grid gap-3"
            >
              {entries.map((entry) => {
                const selectedPick =
                  sort === "overall" ? null : resultFor(entry, sort);
                const selectedResultRank = selectedPick?.resultRank;
                const selectedOutsideRange =
                  selectedPick?.resultStatus === "outside-range";
                const selectedAccuracyPoints = selectedPick?.accuracyPoints;
                const displayedRank =
                  sort === "overall"
                    ? hasAvailableResults
                      ? entry.accuracyRank
                      : "—"
                    : selectedOutsideRange
                      ? ">"
                      : (selectedResultRank ?? "—");
                const displayedScore =
                  sort === "overall"
                    ? hasAvailableResults
                      ? entry.accuracyScore
                      : "—"
                    : (selectedAccuracyPoints ?? "—");
                const rankLabel = selectedDefinition
                  ? selectedOutsideRange
                    ? `${selectedDefinition.label} outside the published result range`
                    : `${selectedDefinition.label} result rank ${selectedResultRank ?? "pending"}`
                  : hasAvailableResults
                    ? `Accuracy rank ${entry.accuracyRank}`
                    : "Accuracy rank pending";

                return (
                  <Card
                    aria-label={`${entry.participantName} spotlight accuracy entry`}
                    key={entry.id}
                    role="article"
                  >
                    <CardContent>
                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <span
                          className="bg-brand grid size-11 place-items-center rounded-xl text-lg font-black text-white"
                          aria-label={rankLabel}
                        >
                          {displayedRank}
                        </span>
                        <div className="min-w-0">
                          <LeaderboardEntryLink
                            entryId={entry.id}
                            participantName={entry.participantName}
                          />
                          <span className="mt-1 block text-xs text-slate-500">
                            Submitted {formatUtcDateTime(entry.createdAt)}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-slate-600">
                            {selectedDefinition
                              ? selectedOutsideRange
                                ? `${selectedDefinition.label} ${selectedPick?.metricLabel}`
                                : `${selectedDefinition.label} result rank ${selectedResultRank ?? "pending"}`
                              : `${entry.availableCategoryCount} of 7 results available`}
                          </span>
                        </div>
                        <div className="text-right">
                          <strong className="block text-2xl font-black text-[#c80047] tabular-nums">
                            {displayedScore}
                          </strong>
                          <span className="text-[0.65rem] font-bold tracking-wide text-slate-500 uppercase">
                            {displayedScore === "—"
                              ? "result pending"
                              : "accuracy points"}
                          </span>
                        </div>
                      </div>
                      <details className="border-border mt-4 rounded-xl border bg-white">
                        <summary className="text-brand focus-visible:ring-accent-blue flex min-h-12 cursor-pointer list-none items-center rounded-xl px-3 text-sm font-black outline-none focus-visible:ring-2">
                          View seven spotlight picks
                        </summary>
                        <SpotlightPickGrid
                          className="border-border border-t p-3"
                          picks={entry.spotlightPicks}
                        />
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
