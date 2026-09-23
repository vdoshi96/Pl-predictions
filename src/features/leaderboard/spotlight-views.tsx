import Link from "next/link";

import { PlayerMark } from "@/components/player-mark";
import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CategoryOutcomeLeader } from "@/features/results/queries";
import {
  PREDICTION_CATEGORY_DEFINITIONS,
  type PredictionCategory,
} from "@/features/predictions/categories";

import { LeaderboardEntryLink } from "./entry-link";
import type {
  SpotlightCategoryBoard,
  SpotlightMatrixEntry,
  SpotlightView,
} from "./spotlight-board";
import type { SpotlightPickDisplay } from "./spotlight-pick-grid";

function SubjectMark({
  assetPath,
  displayName,
  shortName,
  subject,
  size = "sm",
}: {
  assetPath: string | null;
  displayName: string;
  shortName: string | null;
  size?: "sm" | "lg";
  subject: "player" | "team";
}) {
  return subject === "team" ? (
    <TeamMark
      decorative
      initials={shortName}
      name={displayName}
      size={size}
      src={assetPath}
    />
  ) : (
    <PlayerMark name={displayName} size={size} src={assetPath} />
  );
}

function ResultChip({
  accuracyPoints,
  category,
  resultRank,
  resultStatus,
}: SpotlightCategoryBoard["rows"][number] & {
  category: PredictionCategory;
}) {
  if (resultStatus === "pending") {
    const unavailableRating =
      category === "underdog_player" || category === "overrated_player";
    return (
      <span className="bg-warning-soft text-warning rounded-lg px-2 py-1 text-[0.68rem] font-black whitespace-nowrap">
        {unavailableRating ? "N/A" : "Pending"}
      </span>
    );
  }
  if (resultStatus === "outside-range") {
    return (
      <span className="bg-surface-subtle text-muted rounded-lg px-2 py-1 text-[0.68rem] font-black">
        Outside range · {accuracyPoints ?? 0} pts
      </span>
    );
  }
  const rank = resultRank ?? 0;
  return (
    <span
      className={`rounded-lg px-2 py-1 text-[0.68rem] font-black whitespace-nowrap ${
        rank === 1
          ? "bg-mint text-mint-ink"
          : rank <= 5
            ? "bg-sky-soft text-brand-ink"
            : "bg-surface-subtle text-muted"
      }`}
    >
      <span aria-hidden="true">
        #{rank} · {accuracyPoints ?? 0} pts
      </span>
      <span className="sr-only">
        Result rank {rank}, {accuracyPoints ?? 0} accuracy points
      </span>
    </span>
  );
}

export function SpotlightCategoriesView({
  boards,
  entryCount,
  leaders,
  liveCategories,
}: {
  boards: readonly SpotlightCategoryBoard[];
  entryCount: number;
  leaders: Partial<Record<PredictionCategory, CategoryOutcomeLeader>>;
  liveCategories: readonly PredictionCategory[];
}) {
  const live = new Set(liveCategories);
  return (
    <section
      aria-label="Spotlight categories"
      className={
        boards.length === 1
          ? "grid min-w-0 gap-4"
          : "grid gap-4 min-[860px]:grid-cols-2"
      }
    >
      {boards.map((board) => {
        const leader = leaders[board.category];
        const resultLive = live.has(board.category);
        return (
          <Card className="overflow-hidden" key={board.category}>
            <div className="bg-surface-lilac border-surface-lilac-border flex min-h-14 items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="text-brand-ink text-lg font-bold">
                {board.label}
              </h2>
              <Badge variant={resultLive ? "success" : "warning"}>
                {resultLive ? "Result live" : "Result pending"}
              </Badge>
            </div>
            <p
              className="border-surface-lilac-border text-muted border-b border-dashed px-4 py-2 text-xs"
              data-testid="category-leader"
            >
              <span className="text-[0.62rem] font-black tracking-wider uppercase">
                Current leader
              </span>{" "}
              {leader ? (
                <>
                  <strong className="text-brand-ink-strong break-words">
                    {leader.displayName}
                  </strong>{" "}
                  · {leader.metricLabel}
                </>
              ) : (
                <strong className="text-muted">
                  Awaiting results publication
                </strong>
              )}
            </p>
            <div>
              {board.rows.map((row) => (
                <details
                  className="group border-surface-lilac-border border-b last:border-b-0"
                  key={row.identityKey}
                >
                  <summary className="focus-visible:ring-accent-blue grid min-h-16 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                    <SubjectMark
                      assetPath={row.assetPath}
                      displayName={row.displayName}
                      shortName={row.shortName}
                      subject={row.subject}
                    />
                    <span className="min-w-0">
                      <strong className="text-foreground flex items-center gap-1.5 text-xs font-black break-words">
                        <span>
                          {row.displayName}{" "}
                          {row.isOther ? (
                            <Badge className="ml-1 min-h-5 px-1.5 py-0 text-[0.58rem]">
                              Other
                            </Badge>
                          ) : null}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-muted inline-block shrink-0 transition-transform group-open:rotate-180"
                        >
                          ⌄
                        </span>
                      </strong>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className="flex"
                          aria-label={`${row.count} pickers`}
                        >
                          {row.pickers.slice(0, 5).map((picker, index) => (
                            <span
                              aria-label={picker.participantName}
                              className={`grid size-6 place-items-center rounded-full border-2 border-white text-[0.55rem] font-black text-white ${index === 0 ? "" : "-ml-1.5"}`}
                              key={picker.id}
                              style={{
                                backgroundColor: picker.backgroundColor,
                              }}
                            >
                              {picker.initials}
                            </span>
                          ))}
                          {row.count > 5 ? (
                            <span className="bg-surface-subtle text-muted -ml-1.5 grid min-w-6 place-items-center rounded-full border-2 border-white px-1 text-[0.55rem] font-black">
                              +{row.count - 5}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-muted text-[0.68rem] font-bold">
                          {row.count === 1
                            ? row.pickers[0]?.participantName
                            : `${row.count} of ${entryCount}`}
                        </span>
                      </span>
                    </span>
                    <ResultChip {...row} category={board.category} />
                  </summary>
                  <div className="border-surface-lilac-border bg-surface-subtle border-t border-dashed px-4 py-3">
                    <h3 className="text-muted text-[0.62rem] font-black tracking-wider uppercase">
                      Predicted by
                    </h3>
                    <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                      {row.pickers.map((picker) => (
                        <li key={picker.id}>
                          <LeaderboardEntryLink
                            className="text-xs"
                            entryId={picker.id}
                            participantName={picker.participantName}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

function shortPickName(pick: SpotlightPickDisplay): string {
  if (pick.shortName) return pick.shortName;
  const words = pick.displayName.trim().split(/\s+/u);
  return words.at(-1) ?? pick.displayName;
}

function matrixCellClass(pick: SpotlightPickDisplay): string {
  if (pick.resultStatus === "outside-range")
    return "bg-surface-subtle text-muted";
  if (pick.resultRank === undefined || pick.resultRank === null)
    return "bg-warning-soft text-warning";
  if (pick.resultRank === 1) return "bg-mint text-mint-ink";
  if (pick.resultRank <= 5) return "bg-sky-soft text-brand-ink";
  return "bg-surface-subtle text-muted";
}

const MATRIX_ABBREVIATIONS: Record<PredictionCategory, string> = {
  most_clean_sheets: "CS",
  overrated_player: "OP",
  overrated_team: "OT",
  top_assister: "TA",
  top_scorer: "TS",
  underdog_player: "UP",
  underdog_team: "UT",
};

function compactMatrixResult(pick: SpotlightPickDisplay): string {
  if (pick.resultStatus === "outside-range") return "Out";
  if (pick.resultRank === undefined || pick.resultRank === null) {
    return pick.category === "underdog_player" ||
      pick.category === "overrated_player"
      ? "N/A"
      : "…";
  }
  return `#${pick.resultRank}`;
}

function matrixResult(pick: SpotlightPickDisplay): string {
  if (pick.resultStatus === "outside-range") return "Outside range";
  if (pick.resultRank === undefined || pick.resultRank === null) {
    return pick.category === "underdog_player" ||
      pick.category === "overrated_player"
      ? "N/A"
      : "Pending";
  }
  const points = pick.accuracyPoints ?? 0;
  return `Rank ${pick.resultRank} · ${points} ${points === 1 ? "pt" : "pts"}`;
}

export function SpotlightMatrixView({
  entries,
}: {
  entries: readonly SpotlightMatrixEntry[];
}) {
  return (
    <section aria-label="Spotlight matrix" className="grid gap-3">
      <div
        className="flex flex-wrap gap-2"
        aria-label="Spotlight result legend"
      >
        <Badge variant="success">Rank 1</Badge>
        <Badge variant="accent">Top 5</Badge>
        <Badge>Lower rank / outside range</Badge>
        <Badge variant="warning">Result pending</Badge>
      </div>
      <div className="max-sm:hidden">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[64rem] border-collapse text-xs">
              <caption className="sr-only">
                Every entry&apos;s seven spotlight picks and current accuracy.
              </caption>
              <thead>
                <tr className="border-border text-muted border-b-2 text-[0.6rem] font-black tracking-wider uppercase">
                  <th
                    className="bg-surface sticky left-0 z-20 px-3 py-3 text-left"
                    scope="col"
                  >
                    Entry
                  </th>
                  {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => (
                    <th
                      className="px-2 py-3 text-center"
                      key={definition.category}
                      scope="col"
                    >
                      {definition.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center" scope="col">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    className="border-surface-lilac-border border-b last:border-b-0"
                    key={entry.id}
                  >
                    <th
                      className="bg-surface sticky left-0 z-10 min-w-40 px-3 py-2 text-left"
                      scope="row"
                    >
                      <LeaderboardEntryLink
                        entryId={entry.id}
                        participantName={entry.participantName}
                      />
                    </th>
                    {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
                      const pick = entry.picksByCategory.get(
                        definition.category,
                      );
                      return (
                        <td
                          className="px-2 py-2 text-center"
                          key={definition.category}
                        >
                          {pick ? (
                            <span
                              className={`inline-flex min-h-12 min-w-24 flex-col items-center justify-center rounded-lg px-2 py-1 ${matrixCellClass(pick)}`}
                            >
                              <strong className="max-w-24 leading-4 break-words">
                                {shortPickName(pick)}
                              </strong>
                              <span className="mt-0.5 text-[0.6rem] font-bold">
                                {matrixResult(pick)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <strong className="text-brand-ink-strong block text-base font-black tabular-nums">
                        {entry.accuracyScore}
                      </strong>
                      <span className="text-muted text-[0.62rem] font-bold">
                        {entry.availableCategoryCount} of 7 available
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <ul aria-label="Picks by entry" className="grid gap-2 sm:hidden">
        {entries.map((entry) => (
          <li
            aria-label={`${entry.participantName} spotlight picks`}
            className="border-border bg-surface rounded-xl border p-3"
            key={entry.id}
          >
            <div className="flex items-center justify-between gap-2">
              <LeaderboardEntryLink
                entryId={entry.id}
                participantName={entry.participantName}
              />
              <span className="text-muted shrink-0 text-xs font-semibold">
                {entry.availableCategoryCount} of 7 live · {entry.accuracyScore}{" "}
                pts
              </span>
            </div>
            <ul
              aria-label={`${entry.participantName} picks`}
              className="mt-2 grid grid-cols-4 gap-1"
            >
              {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
                const pick = entry.picksByCategory.get(definition.category);
                return (
                  <li
                    className={`flex min-h-9 items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-black ${pick ? matrixCellClass(pick) : "bg-surface-subtle text-muted"}`}
                    key={definition.category}
                  >
                    <abbr
                      aria-hidden="true"
                      className="no-underline"
                      title={definition.label}
                    >
                      {MATRIX_ABBREVIATIONS[definition.category]}
                    </abbr>
                    <span aria-hidden="true">
                      {pick ? compactMatrixResult(pick) : "—"}
                    </span>
                    <span className="sr-only">
                      {pick
                        ? `${definition.label}: ${pick.displayName}, ${matrixResult(pick)}`
                        : `${definition.label}: no pick`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

const activeChipClassName =
  "border-brand bg-brand text-white dark:ring-1 dark:ring-accent-blue";
const idleChipClassName =
  "border-border bg-surface text-muted hover:bg-surface-subtle";

export function SpotlightCategoryNav({
  selected,
}: {
  selected: PredictionCategory;
}) {
  return (
    <nav
      aria-label="Choose a spotlight category"
      className="-mx-1 overflow-x-auto px-1 pb-1"
    >
      <ul className="flex w-max gap-2">
        {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
          const active = definition.category === selected;
          return (
            <li key={definition.category}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`focus-visible:ring-accent-blue inline-flex min-h-11 items-center rounded-full border px-3.5 text-xs font-black whitespace-nowrap outline-none focus-visible:ring-2 ${active ? activeChipClassName : idleChipClassName}`}
                href={`/spotlight?category=${definition.category}`}
                scroll={false}
              >
                {definition.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const viewOptions: readonly {
  href: string;
  label: string;
  value: SpotlightView;
}[] = [
  { href: "/spotlight", label: "Categories", value: "categories" },
  { href: "/spotlight?view=entries", label: "Entries", value: "entries" },
  { href: "/spotlight?view=matrix", label: "Matrix", value: "matrix" },
];

export function SpotlightViewNav({ selected }: { selected: SpotlightView }) {
  return (
    <nav aria-label="Spotlight views">
      <ul className="bg-surface-subtle grid grid-cols-3 gap-1 rounded-xl p-1">
        {viewOptions.map((option) => {
          const active = option.value === selected;
          return (
            <li key={option.value}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`focus-visible:ring-accent-blue inline-flex min-h-11 w-full items-center justify-center rounded-lg px-2 text-xs font-black outline-none focus-visible:ring-2 ${
                  active
                    ? "bg-brand dark:ring-accent-blue text-white dark:ring-1"
                    : "text-muted hover:bg-surface"
                }`}
                href={option.href}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
