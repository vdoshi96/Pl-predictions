import { EyeOff, SlidersHorizontal, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SPOTLIGHT_SCORING_MESSAGE } from "@/content/public-copy";
import { LeaderboardEntryLink } from "@/features/leaderboard/entry-link";
import {
  buildSpotlightCategoryBoard,
  buildSpotlightMatrix,
  canLoadSpotlightCategoryData,
  parseSpotlightView,
  type SpotlightView,
} from "@/features/leaderboard/spotlight-board";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { SpotlightPickGrid } from "@/features/leaderboard/spotlight-pick-grid";
import {
  SpotlightCategoriesView,
  SpotlightMatrixView,
} from "@/features/leaderboard/spotlight-views";
import {
  PREDICTION_CATEGORY_DEFINITIONS,
  isPredictionCategory,
  type PredictionCategory,
} from "@/features/predictions/categories";
import {
  getActiveSpotlightAliasResolutions,
  getCategoryOutcomeLeaders,
  type CategoryOutcomeLeader,
} from "@/features/results/queries";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { formatChicagoUtcDateTime } from "@/shared/format";

export const metadata: Metadata = { title: "Spotlight accuracy" };
export const dynamic = "force-dynamic";

type SpotlightSort = "overall" | PredictionCategory;
const viewOptions: readonly { label: string; value: SpotlightView }[] = [
  { label: "Categories", value: "categories" },
  { label: "Entries", value: "entries" },
  { label: "Matrix", value: "matrix" },
];

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
  searchParams: Promise<{
    sort?: string | string[];
    view?: string | string[];
  }>;
}) {
  const [view, query] = await Promise.all([getLeaderboardView(), searchParams]);
  const sort = parseSort(query.sort);
  const selectedView = parseSpotlightView(query.view);
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

  const categoryLeaders: Partial<
    Record<PredictionCategory, CategoryOutcomeLeader>
  > = {};
  let liveCategories: PredictionCategory[] = [];
  let categoryBoards = entries ? buildSpotlightCategoryBoard(entries) : [];
  const matrixEntries = entries ? buildSpotlightMatrix(entries) : [];

  if (
    entries &&
    canLoadSpotlightCategoryData({
      entryCount: entries.length,
      predictionsRevealed: view.predictionsRevealed,
      view: selectedView,
    })
  ) {
    const { season } = await getActiveSeasonContext();
    const [outcomes, aliases] = await Promise.all([
      getCategoryOutcomeLeaders(season.id, view.entries.length),
      getActiveSpotlightAliasResolutions(season.id),
    ]);
    Object.assign(categoryLeaders, outcomes.leaders);
    liveCategories = [...outcomes.liveCategories];
    categoryBoards = buildSpotlightCategoryBoard(entries, { aliases });

    for (const category of ["underdog_team", "overrated_team"] as const) {
      const board = categoryBoards.find(
        (candidate) => candidate.category === category,
      );
      const leader = board?.rows.find(
        (row) => row.resultStatus === "ranked" && row.resultRank === 1,
      );
      if (!leader || !leader.metricLabel) continue;
      liveCategories.push(category);
      categoryLeaders[category] = {
        assetPath: leader.assetPath,
        category,
        displayName: leader.displayName,
        metricLabel: leader.metricLabel,
        shortName: leader.shortName,
        subject: "team",
      };
    }
  }

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-accent-ink ring-accent">
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
              className="bg-accent text-accent-ink hover:bg-accent-yellow inline-flex min-h-10 items-center rounded-xl px-3 font-black transition-colors"
              href="/leaderboard"
            >
              View table leaderboard
            </Link>
          </div>
        </section>

        <Card>
          <CardContent className="flex items-start gap-3">
            <span className="bg-brand-soft text-brand-ink grid size-11 shrink-0 place-items-center rounded-xl">
              <Trophy aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-brand-ink-strong text-xl font-black">
                How spotlight points work
              </h2>
              <p className="text-muted mt-1 text-sm leading-6">
                {SPOTLIGHT_SCORING_MESSAGE}
              </p>
              <Link
                className="text-brand-ink focus-visible:ring-accent-blue mt-3 inline-flex min-h-11 items-center rounded-lg font-black underline decoration-2 underline-offset-4 outline-none focus-visible:ring-2"
                href="/rules#spotlight-scoring"
              >
                Read the full scoring rules
              </Link>
            </div>
          </CardContent>
        </Card>

        <nav aria-label="Spotlight views">
          <ul className="bg-surface-subtle grid grid-cols-3 gap-1 rounded-xl p-1">
            {viewOptions.map((option) => {
              const active = option.value === selectedView;
              const href =
                option.value === "categories"
                  ? "/spotlight"
                  : `/spotlight?view=${option.value}`;
              return (
                <li key={option.value}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`focus-visible:ring-accent-blue inline-flex min-h-11 w-full items-center justify-center rounded-lg px-2 text-xs font-black outline-none focus-visible:ring-2 ${
                      active
                        ? "bg-brand text-white"
                        : "text-muted hover:bg-surface"
                    }`}
                    href={href}
                  >
                    {option.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {selectedView === "entries" ? (
          <section
            aria-labelledby="spotlight-sort-heading"
            className="grid gap-3"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal
                aria-hidden="true"
                className="text-brand-ink size-5 shrink-0"
              />
              <h2
                id="spotlight-sort-heading"
                className="text-brand-ink-strong text-xl font-black"
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
                            : "border-border bg-surface text-muted hover:bg-surface-subtle"
                        }`}
                        href={
                          option.value === "overall"
                            ? "/spotlight?view=entries"
                            : `/spotlight?view=entries&sort=${option.value}`
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
        ) : null}

        {!view.predictionsRevealed ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <EyeOff
                aria-hidden="true"
                className="text-muted mt-0.5 size-5 shrink-0"
              />
              <div>
                <h2 className="text-foreground font-black">
                  Spotlight picks are still private
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
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
              <h2 className="text-foreground text-lg font-black">
                Accuracy results are not available yet
              </h2>
              <p className="text-muted mt-2 text-sm leading-6">
                Real rankings appear after a meaningful active table exists and
                category outcomes are available. Pending manual results do not
                count as zero.
              </p>
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <h2 className="text-foreground text-lg font-black">
                No revealed brackets yet
              </h2>
              <p className="text-muted mt-2 text-sm">
                Submitted spotlight picks will appear here after reveal.
              </p>
            </CardContent>
          </Card>
        ) : selectedView === "categories" ? (
          <SpotlightCategoriesView
            boards={categoryBoards}
            entryCount={view.entries.length}
            leaders={categoryLeaders}
            liveCategories={liveCategories}
          />
        ) : selectedView === "matrix" ? (
          <SpotlightMatrixView entries={matrixEntries} />
        ) : (
          <div className="grid gap-3">
            {!hasAvailableResults ? (
              <Card className="border-warning/35 bg-warning-soft">
                <CardContent>
                  <h2 className="text-warning font-black">
                    Accuracy rankings are not available yet
                  </h2>
                  <p className="text-warning mt-1 text-sm leading-6">
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
                const selectedRatingUnavailable =
                  (sort === "underdog_player" || sort === "overrated_player") &&
                  !selectedOutsideRange &&
                  (selectedResultRank === null ||
                    selectedResultRank === undefined);
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
                    : selectedRatingUnavailable
                      ? `${selectedDefinition.label} rating not available`
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
                          <span className="text-muted mt-1 block text-xs">
                            Submitted{" "}
                            {formatChicagoUtcDateTime(entry.createdAt)}
                          </span>
                          <span className="text-muted mt-1 block text-xs font-semibold">
                            {selectedDefinition
                              ? selectedOutsideRange
                                ? `${selectedDefinition.label} ${selectedPick?.metricLabel}`
                                : selectedRatingUnavailable
                                  ? `${selectedDefinition.label} rating N/A`
                                  : `${selectedDefinition.label} result rank ${selectedResultRank ?? "pending"}`
                              : `${entry.availableCategoryCount} of 7 results available`}
                          </span>
                        </div>
                        <div className="text-right">
                          <strong className="text-rose-score block text-2xl font-black tabular-nums">
                            {displayedScore}
                          </strong>
                          <span className="text-muted text-[0.65rem] font-bold tracking-wide uppercase">
                            {displayedScore === "—"
                              ? selectedRatingUnavailable
                                ? "rating N/A"
                                : "result pending"
                              : "accuracy points"}
                          </span>
                        </div>
                      </div>
                      <details className="border-border bg-surface mt-4 rounded-xl border">
                        <summary className="text-brand-ink focus-visible:ring-accent-blue flex min-h-12 cursor-pointer list-none items-center rounded-xl px-3 text-sm font-black outline-none focus-visible:ring-2">
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
