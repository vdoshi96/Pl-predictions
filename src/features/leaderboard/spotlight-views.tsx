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
  resultRank,
  resultStatus,
}: SpotlightCategoryBoard["rows"][number]) {
  if (resultStatus === "pending") {
    return (
      <span className="bg-warning-soft text-warning rounded-lg px-2 py-1 text-[0.68rem] font-black whitespace-nowrap">
        Pending
      </span>
    );
  }
  if (resultStatus === "outside-range") {
    return (
      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[0.68rem] font-black text-slate-600">
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
            ? "bg-sky-soft text-brand"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      Result rank {rank} · {accuracyPoints ?? 0} pts
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
      className="grid gap-4 min-[860px]:grid-cols-2"
    >
      {boards.map((board) => {
        const leader = leaders[board.category];
        const resultLive = live.has(board.category);
        return (
          <Card className="overflow-hidden" key={board.category}>
            <div className="bg-surface-lilac border-surface-lilac-border flex min-h-14 items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="text-rose-ink text-xs font-black tracking-wider uppercase">
                {board.label}
              </h2>
              <Badge variant={resultLive ? "success" : "warning"}>
                {resultLive ? "Result live" : "Result pending"}
              </Badge>
            </div>
            <div className="border-surface-lilac-border flex min-h-20 items-center gap-3 border-b border-dashed px-4 py-3">
              {leader ? (
                <>
                  <SubjectMark
                    assetPath={leader.assetPath}
                    displayName={leader.displayName}
                    shortName={leader.shortName}
                    size="lg"
                    subject={leader.subject}
                  />
                  <div className="min-w-0">
                    <span className="block text-[0.62rem] font-black tracking-wider text-slate-500 uppercase">
                      Current leader
                    </span>
                    <strong className="text-brand-strong mt-0.5 block text-sm font-black [overflow-wrap:anywhere]">
                      {leader.displayName}
                    </strong>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                      {leader.metricLabel}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="block text-[0.62rem] font-black tracking-wider text-slate-500 uppercase">
                    Current leader
                  </span>
                  <strong className="mt-1 block text-sm font-black text-slate-500">
                    Awaiting results publication
                  </strong>
                </div>
              )}
            </div>
            <div>
              {board.rows.map((row) => (
                <div
                  className="border-surface-lilac-border grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-4 py-2.5 last:border-b-0"
                  key={row.identityKey}
                >
                  <SubjectMark
                    assetPath={row.assetPath}
                    displayName={row.displayName}
                    shortName={row.shortName}
                    subject={row.subject}
                  />
                  <div className="min-w-0">
                    <strong className="block text-xs font-black [overflow-wrap:anywhere] text-slate-950">
                      {row.displayName}{" "}
                      {row.isOther ? (
                        <Badge className="ml-1 min-h-5 px-1.5 py-0 text-[0.58rem]">
                          Other
                        </Badge>
                      ) : null}
                    </strong>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className="flex"
                        aria-label={`${row.count} pickers`}
                      >
                        {row.pickers.slice(0, 5).map((picker, index) => (
                          <span
                            aria-label={picker.participantName}
                            className={`grid size-6 place-items-center rounded-full border-2 border-white text-[0.55rem] font-black text-white ${index === 0 ? "" : "-ml-1.5"}`}
                            key={picker.id}
                            style={{ backgroundColor: picker.backgroundColor }}
                          >
                            {picker.initials}
                          </span>
                        ))}
                        {row.count > 5 ? (
                          <span className="-ml-1.5 grid min-w-6 place-items-center rounded-full border-2 border-white bg-slate-200 px-1 text-[0.55rem] font-black text-slate-700">
                            +{row.count - 5}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[0.68rem] font-bold text-slate-500">
                        {row.count} of {entryCount}
                      </span>
                    </div>
                  </div>
                  <ResultChip {...row} />
                </div>
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
    return "bg-slate-100 text-slate-600";
  if (pick.resultRank === undefined || pick.resultRank === null)
    return "bg-warning-soft text-warning";
  if (pick.resultRank === 1) return "bg-mint text-mint-ink";
  if (pick.resultRank <= 5) return "bg-sky-soft text-brand";
  return "bg-slate-100 text-slate-600";
}

function matrixResult(pick: SpotlightPickDisplay): string {
  if (pick.resultStatus === "outside-range") return "Outside range";
  if (pick.resultRank === undefined || pick.resultRank === null)
    return "Pending";
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
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[64rem] border-collapse text-xs">
            <caption className="sr-only">
              Every entry&apos;s seven spotlight picks and current accuracy.
            </caption>
            <thead>
              <tr className="border-border border-b-2 text-[0.6rem] font-black tracking-wider text-slate-500 uppercase">
                <th
                  className="sticky left-0 z-20 bg-white px-3 py-3 text-left"
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
                    className="sticky left-0 z-10 min-w-40 bg-white px-3 py-2 text-left"
                    scope="row"
                  >
                    <LeaderboardEntryLink
                      entryId={entry.id}
                      participantName={entry.participantName}
                    />
                  </th>
                  {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
                    const pick = entry.picksByCategory.get(definition.category);
                    return (
                      <td
                        className="px-2 py-2 text-center"
                        key={definition.category}
                      >
                        {pick ? (
                          <span
                            className={`inline-flex min-h-12 min-w-24 flex-col items-center justify-center rounded-lg px-2 py-1 ${matrixCellClass(pick)}`}
                          >
                            <strong className="max-w-24 leading-4 [overflow-wrap:anywhere]">
                              {shortPickName(pick)}
                            </strong>
                            <span className="mt-0.5 text-[0.6rem] font-bold">
                              {matrixResult(pick)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <strong className="text-rose-score block text-base font-black tabular-nums">
                      {entry.accuracyScore}
                    </strong>
                    <span className="text-[0.62rem] font-bold text-slate-500">
                      {entry.availableCategoryCount} of 7 available
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
