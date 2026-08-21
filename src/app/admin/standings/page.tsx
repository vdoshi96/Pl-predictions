import { desc, eq } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db/client";
import {
  standingsImportRuns,
  standingsItems,
  standingsSnapshots,
} from "@/db/schema";
import { getAdminSession, isFinalStandingsCandidate } from "@/features/admin";
import {
  getActiveSeasonContext,
  getSeasonTeams,
} from "@/features/seasons/queries";
import { ManualStandingsForm } from "@/features/standings/manual-standings-form";
import { StandingsPastePanel } from "@/features/standings/standings-paste-panel";
import { formatUtcDateTime } from "@/shared/format";

import { AdminNav } from "../admin-nav";
import {
  finalizeActiveSnapshot,
  saveManualStandings,
  undoFinalSnapshot,
} from "./actions";

export const metadata: Metadata = { title: "Standings admin" };
export const dynamic = "force-dynamic";

export default async function AdminStandingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getAdminSession())) redirect("/admin/login");
  const params = await searchParams;
  const { season } = await getActiveSeasonContext();
  const teams = await getSeasonTeams(season.id);
  const db = getDb();
  const [activeSnapshots, latestRuns] = await Promise.all([
    season.activeSnapshotId
      ? db
          .select({
            capturedAt: standingsSnapshots.capturedAt,
            id: standingsSnapshots.id,
            isFinal: standingsSnapshots.isFinal,
            matchweek: standingsSnapshots.matchweek,
            source: standingsSnapshots.source,
          })
          .from(standingsSnapshots)
          .where(eq(standingsSnapshots.id, season.activeSnapshotId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        createdAt: standingsImportRuns.createdAt,
        errorCode: standingsImportRuns.errorCode,
        id: standingsImportRuns.id,
        itemCount: standingsImportRuns.itemCount,
        source: standingsImportRuns.source,
        status: standingsImportRuns.status,
      })
      .from(standingsImportRuns)
      .where(eq(standingsImportRuns.seasonId, season.id))
      .orderBy(desc(standingsImportRuns.createdAt))
      .limit(8),
  ]);
  const activeSnapshot = activeSnapshots[0];
  const activeItems = activeSnapshot
    ? await db
        .select({
          actualPosition: standingsItems.actualPosition,
          leaguePoints: standingsItems.leaguePoints,
          playedGames: standingsItems.playedGames,
          teamId: standingsItems.teamId,
        })
        .from(standingsItems)
        .where(eq(standingsItems.snapshotId, activeSnapshot.id))
    : [];
  const itemByTeamId = new Map(activeItems.map((item) => [item.teamId, item]));
  const orderedTeams = [...teams].sort((left, right) => {
    const leftPosition = itemByTeamId.get(left.id)?.actualPosition;
    const rightPosition = itemByTeamId.get(right.id)?.actualPosition;
    return leftPosition && rightPosition
      ? leftPosition - rightPosition
      : left.sortName.localeCompare(right.sortName);
  });
  const completedCandidate = isFinalStandingsCandidate(activeItems);

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5">
        <div>
          <Badge variant="accent">Validated snapshot control</Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Current standings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Reorder the 20 clubs manually or review owner-run imports. Every
            save is a complete atomic snapshot; malformed data cannot replace
            the last good table.
          </p>
        </div>

        <AdminNav current="/admin/standings" />

        {params.error === "incomplete" ? (
          <p
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800"
            role="alert"
          >
            Final status requires all 20 clubs to have 38 played games. No
            changes were made.
          </p>
        ) : null}

        {params.error === "changed" ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900"
            role="alert"
          >
            The active standings changed while final status was being applied.
            Review the current snapshot and try again; no snapshot was marked
            final.
          </p>
        ) : null}

        {params.error === "undo-changed" ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900"
            role="alert"
          >
            Final status changed while the undo was being applied. Review the
            current snapshot and try again; no partial undo was saved.
          </p>
        ) : null}

        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black text-slate-950">Active snapshot</h2>
                <Badge
                  variant={
                    activeSnapshot?.isFinal
                      ? "accent"
                      : activeSnapshot
                        ? "warning"
                        : "neutral"
                  }
                >
                  {activeSnapshot
                    ? activeSnapshot.isFinal
                      ? "Final"
                      : "Provisional"
                    : "None"}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-6 break-words text-slate-600">
                {activeSnapshot
                  ? `${formatUtcDateTime(season.standingsAcceptedThrough ?? activeSnapshot.capturedAt)} · ${activeSnapshot.source}${activeSnapshot.matchweek ? ` · Matchweek ${activeSnapshot.matchweek}` : ""}`
                  : "No table is active, so scoring has not started."}
              </p>
            </div>

            {activeSnapshot?.isFinal ? (
              <form action={undoFinalSnapshot} className="w-full sm:w-auto">
                <ConfirmSubmitButton
                  className="w-full sm:w-auto"
                  confirmation="Undo final status and allow newer validated snapshots? The current table will remain active but become provisional."
                  variant="danger"
                >
                  Undo final status
                </ConfirmSubmitButton>
              </form>
            ) : activeSnapshot && completedCandidate ? (
              <form
                action={finalizeActiveSnapshot}
                className="w-full sm:w-auto"
              >
                <ConfirmSubmitButton
                  className="w-full sm:w-auto"
                  confirmation="Mark the active table final? Future imports will be blocked until final status is explicitly undone."
                >
                  Mark table final
                </ConfirmSubmitButton>
              </form>
            ) : activeSnapshot ? (
              <p className="max-w-xs text-sm leading-5 font-semibold text-slate-600">
                Finalization unlocks after all 20 clubs have 38 played games.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {completedCandidate && !activeSnapshot?.isFinal ? (
          <p
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900"
            role="status"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            Every club has 38 played games. This snapshot is ready for owner
            confirmation as final.
          </p>
        ) : null}

        <StandingsPastePanel
          activeItems={activeItems}
          disabled={Boolean(activeSnapshot?.isFinal)}
          onSubmit={saveManualStandings}
          teams={teams.map((team) => ({
            displayName: team.displayName,
            id: team.id,
            shortName: team.shortName,
            slug: team.slug,
            sortName: team.sortName,
          }))}
        />

        {activeSnapshot?.isFinal ? (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 font-semibold text-amber-950">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            The final table is locked. Undo final status explicitly before
            saving or importing another snapshot.
          </p>
        ) : (
          <ManualStandingsForm
            hasActiveSnapshot={Boolean(activeSnapshot)}
            initialLeaguePoints={Object.fromEntries(
              activeItems.map((item) => [item.teamId, item.leaguePoints]),
            )}
            initialMatchweek={activeSnapshot?.matchweek}
            initialPlayedGames={Object.fromEntries(
              activeItems.map((item) => [item.teamId, item.playedGames]),
            )}
            onSubmit={saveManualStandings}
            teams={orderedTeams.map((team) => ({
              assetPath: team.assetPath,
              displayName: team.displayName,
              id: team.id,
              shortName: team.shortName,
              slug: team.slug,
              sortName: team.sortName,
            }))}
          />
        )}

        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <History aria-hidden="true" className="size-5 text-slate-500" />
              <h2 className="font-black text-slate-950">
                Recent import history
              </h2>
            </div>
            {latestRuns.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No imports recorded yet.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {latestRuns.map((run) => (
                  <li
                    className="rounded-xl border border-slate-200 p-3"
                    key={run.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold break-all text-slate-900">
                        {run.source}
                      </span>
                      <Badge
                        variant={
                          run.status === "succeeded"
                            ? "success"
                            : run.status === "failed" ||
                                run.status === "rejected"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {run.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatUtcDateTime(run.createdAt)} · {run.itemCount} rows
                    </p>
                    {run.errorCode ? (
                      <p className="mt-2 text-xs leading-5 break-words text-red-700">
                        Import issue: {run.errorCode.replaceAll("_", " ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
