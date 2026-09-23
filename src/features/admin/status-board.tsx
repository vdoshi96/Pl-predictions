import Link from "next/link";

import { formatLeagueDateTime } from "@/shared/format";

export type AdminDatasetKey =
  "goals" | "assists" | "clean_sheets" | "player_ratings";

export type AdminStatusInput = Readonly<{
  datasets: readonly Readonly<{
    active: Readonly<{
      capturedAt: Date;
      coveredThroughRank: number | null;
    }> | null;
    dataset: AdminDatasetKey;
    hasUnpublishedDraft: boolean;
    isFinal: boolean;
  }>[];
  standings: Readonly<{ capturedAt: Date; isFinal: boolean }> | null;
  winStreak: Readonly<{ matchweek: number; readyToResolve: boolean }> | null;
}>;

export type AdminStatusRow = Readonly<{
  actionLabel: string;
  attention: boolean;
  draft: string;
  href: string;
  key: string;
  label: string;
  publicVersion: string;
}>;

const DATASET_LABELS: Record<AdminDatasetKey, string> = {
  assists: "Assists",
  clean_sheets: "Clean sheets",
  goals: "Goals",
  player_ratings: "Player ratings",
};

const DATASET_ORDER: readonly AdminDatasetKey[] = [
  "goals",
  "assists",
  "clean_sheets",
  "player_ratings",
];

export function buildAdminStatusRows(
  input: AdminStatusInput,
): AdminStatusRow[] {
  const rows: AdminStatusRow[] = [
    {
      actionLabel: "Import standings",
      attention: input.standings === null,
      draft: "—",
      href: "/admin/standings",
      key: "standings",
      label: "Standings",
      publicVersion: input.standings
        ? `${formatLeagueDateTime(input.standings.capturedAt)}${input.standings.isFinal ? " · Final" : ""}`
        : "None",
    },
  ];

  for (const key of DATASET_ORDER) {
    const dataset = input.datasets.find(
      (candidate) => candidate.dataset === key,
    );
    const active = dataset?.active ?? null;
    const hasDraft = dataset?.hasUnpublishedDraft ?? false;
    rows.push({
      actionLabel: hasDraft
        ? "Review & publish"
        : active
          ? "Update"
          : "Enter results",
      attention: hasDraft || active === null,
      draft: hasDraft ? "Saved draft not published" : "—",
      href: "/admin/results",
      key,
      label: DATASET_LABELS[key],
      publicVersion: active
        ? [
            formatLeagueDateTime(active.capturedAt),
            active.coveredThroughRank
              ? `to rank ${active.coveredThroughRank}`
              : null,
            dataset?.isFinal ? "Final" : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Not published",
    });
  }

  rows.push(
    input.winStreak
      ? {
          actionLabel: input.winStreak.readyToResolve
            ? "Resolve round"
            : "Waiting for kickoffs",
          attention: input.winStreak.readyToResolve,
          draft: "—",
          href: "/admin/win-streak",
          key: "win-streak",
          label: `Win Streak MW${input.winStreak.matchweek}`,
          publicVersion: "Unresolved",
        }
      : {
          actionLabel: "Open",
          attention: false,
          draft: "—",
          href: "/admin/win-streak",
          key: "win-streak",
          label: "Win Streak",
          publicVersion: "All rounds resolved",
        },
  );

  return rows;
}

export function AdminStatusBoard({
  rows,
}: {
  rows: readonly AdminStatusRow[];
}) {
  return (
    <section aria-labelledby="dataset-status-heading" className="grid gap-3">
      <h2 className="text-xl font-bold" id="dataset-status-heading">
        Dataset status
      </h2>
      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table
          aria-label="Dataset status"
          className="w-full min-w-[34rem] text-left text-sm"
        >
          <thead className="text-muted text-[0.65rem] font-black tracking-wide uppercase">
            <tr>
              <th className="px-3 py-2" scope="col">
                Dataset
              </th>
              <th className="px-3 py-2" scope="col">
                Public version
              </th>
              <th className="px-3 py-2" scope="col">
                Draft
              </th>
              <th className="px-3 py-2" scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-border border-t" key={row.key}>
                <th className="px-3 py-2.5 font-bold" scope="row">
                  {row.label}
                </th>
                <td className="text-muted px-3 py-2.5">{row.publicVersion}</td>
                <td className="text-muted px-3 py-2.5">{row.draft}</td>
                <td className="px-3 py-2.5">
                  {row.attention ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="bg-warning mr-2 inline-block size-2 rounded-full"
                      />
                      <span className="sr-only">Needs attention</span>
                    </>
                  ) : null}
                  <Link
                    className="text-brand-ink inline-flex min-h-11 items-center font-semibold underline"
                    href={row.href}
                  >
                    {row.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
