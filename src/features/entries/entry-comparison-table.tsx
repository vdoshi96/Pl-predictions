"use client";

import { useState } from "react";

import { ScoreBreakdownBar } from "@/components/score-breakdown-bar";
import { ScorePill } from "@/components/score-pill";
import { TeamMark } from "@/components/team-mark";
import type { ScoreTier } from "@/features/scoring";
import { ordinal } from "@/shared/format";

import type { EntryComparisonItem } from "./queries";

export type EntryCompare = Readonly<{
  participantName: string;
  positions: Readonly<Record<string, number>>;
}>;

type Filter = "all" | ScoreTier;

export function summarizeEntryTiers(
  items: readonly Pick<EntryComparisonItem, "tier">[],
) {
  const summary = {
    correctHalf: 0,
    exact: 0,
    miss: 0,
    scored: false,
    withinThree: 0,
  };
  for (const item of items) {
    if (item.tier === null) continue;
    summary.scored = true;
    if (item.tier === "exact") summary.exact += 1;
    else if (item.tier === "within-three") summary.withinThree += 1;
    else if (item.tier === "correct-half") summary.correctHalf += 1;
    else summary.miss += 1;
  }
  return summary;
}

const rowColumns =
  "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-3 py-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_3rem_3rem_5.5rem]";
const rowColumnsWithCompare =
  "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-3 py-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_3rem_3rem_3rem_5.5rem]";

export function EntryComparisonTable({
  compare,
  items,
  participantName,
  totalScore,
}: {
  compare: EntryCompare | null;
  items: readonly EntryComparisonItem[];
  participantName: string;
  totalScore: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const summary = summarizeEntryTiers(items);
  const showSummary = totalScore !== null && summary.scored;
  const columns = compare ? rowColumnsWithCompare : rowColumns;
  const filters: readonly { label: string; value: Filter }[] = [
    { label: `All ${items.length}`, value: "all" },
    { label: `Exact · ${summary.exact}`, value: "exact" },
    { label: `Within 3 · ${summary.withinThree}`, value: "within-three" },
    { label: `Half · ${summary.correctHalf}`, value: "correct-half" },
    { label: `Missed · ${summary.miss}`, value: "miss" },
  ];
  const visible =
    filter === "all" ? items : items.filter((item) => item.tier === filter);

  return (
    <div className="grid gap-4">
      {showSummary ? (
        <section aria-label="Score summary" className="grid gap-3">
          <p className="flex items-end gap-2">
            <strong className="text-brand-ink-strong text-4xl leading-none font-black tabular-nums">
              {totalScore}
            </strong>
            <span className="text-muted pb-1 text-sm font-semibold">
              / 100 table points
            </span>
          </p>
          <ScoreBreakdownBar
            correctHalf={summary.correctHalf}
            exact={summary.exact}
            missed={summary.miss}
            size="lg"
            withinThree={summary.withinThree}
          />
          <div
            aria-label="Filter clubs"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
          >
            {filters.map((option) => {
              const active = filter === option.value;
              return (
                <button
                  aria-pressed={active}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-xs font-black whitespace-nowrap ${
                    active
                      ? "border-brand bg-brand dark:ring-accent-blue text-white dark:ring-1"
                      : "border-border bg-surface text-muted hover:bg-surface-subtle"
                  }`}
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div
        aria-hidden="true"
        className={`text-muted hidden text-[0.62rem] font-black tracking-wide uppercase sm:grid ${columns}`}
      >
        <span>Pred</span>
        <span>Club</span>
        <span className="text-center">Actual</span>
        <span className="text-center">Off</span>
        {compare ? (
          <span className="truncate text-center">
            {compare.participantName}
          </span>
        ) : null}
        <span className="text-right">Pts</span>
      </div>

      <ol
        aria-label={`${participantName}'s predicted table`}
        className="entry-comparison"
      >
        {visible.map((item) => (
          <li
            className={columns}
            data-tier={item.tier ?? "unscored"}
            key={item.teamId}
          >
            <span
              aria-label={`Predicted ${ordinal(item.predictedPosition)}`}
              className="bg-brand row-span-2 grid size-8 place-items-center rounded-lg text-xs font-black text-white tabular-nums sm:row-span-1"
            >
              {item.predictedPosition}
            </span>
            <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-auto sm:row-start-auto">
              <TeamMark
                initials={item.shortName}
                name={item.displayName}
                size="sm"
                src={item.assetPath}
              />
              <span className="text-foreground min-w-0 text-sm font-black break-words">
                {item.displayName}
              </span>
            </span>
            <span className="text-muted col-start-2 row-start-2 flex flex-wrap gap-x-3 text-xs font-bold tabular-nums sm:contents">
              <span className="sm:text-foreground sm:text-center sm:text-sm">
                <span aria-hidden="true" className="sm:hidden">
                  Act{" "}
                </span>
                <span className="sr-only">Actual position </span>
                {item.actualPosition ?? "—"}
              </span>
              <span className="sm:text-center">
                <span aria-hidden="true" className="sm:hidden">
                  Off{" "}
                </span>
                <span className="sr-only">Places off </span>
                {item.difference ?? "—"}
              </span>
              {compare ? (
                <span className="sm:text-foreground sm:text-center sm:text-sm">
                  <span aria-hidden="true" className="sm:hidden">
                    {compare.participantName}{" "}
                  </span>
                  <span className="sr-only">
                    {compare.participantName} predicted{" "}
                  </span>
                  {compare.positions[item.teamId] ?? "—"}
                </span>
              ) : null}
            </span>
            <span className="col-start-3 row-span-2 row-start-1 text-right sm:col-start-auto sm:row-span-1 sm:row-start-auto">
              {item.tier && item.points !== null ? (
                <ScorePill points={item.points} tier={item.tier} />
              ) : (
                <span className="text-muted text-xs font-bold">Not scored</span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {visible.length === 0 ? (
        <p className="text-muted text-sm" role="status">
          No clubs in this group.
        </p>
      ) : null}
    </div>
  );
}
