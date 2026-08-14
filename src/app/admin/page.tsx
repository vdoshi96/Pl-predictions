import { count, desc, eq } from "drizzle-orm";
import { Database, RefreshCcw, Settings2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db/client";
import {
  predictions,
  standingsImportRuns,
  standingsSnapshots,
} from "@/db/schema";
import { getAdminSession } from "@/features/admin";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { formatUtcDateTime } from "@/shared/format";
import { getSeasonAccess } from "@/shared/policy";

import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await getAdminSession())) redirect("/admin/login");

  const { databaseNow, season } = await getActiveSeasonContext();
  const db = getDb();
  const [[submissionCount], latestRuns, activeSnapshots] = await Promise.all([
    db
      .select({ value: count() })
      .from(predictions)
      .where(eq(predictions.seasonId, season.id)),
    db
      .select({
        createdAt: standingsImportRuns.createdAt,
        status: standingsImportRuns.status,
      })
      .from(standingsImportRuns)
      .where(eq(standingsImportRuns.seasonId, season.id))
      .orderBy(desc(standingsImportRuns.createdAt))
      .limit(1),
    season.activeSnapshotId
      ? db
          .select({
            capturedAt: standingsSnapshots.capturedAt,
            isFinal: standingsSnapshots.isFinal,
          })
          .from(standingsSnapshots)
          .where(eq(standingsSnapshots.id, season.activeSnapshotId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const activeSnapshot = activeSnapshots[0];
  const latestRun = latestRuns[0];
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );

  const stats = [
    {
      icon: Users,
      label: "Submissions",
      value: String(submissionCount?.value ?? 0),
      detail: access.predictionsRevealed
        ? "Predictions revealed"
        : "Full tables private",
    },
    {
      icon: Settings2,
      label: "Entry status",
      value: access.submissionsOpen ? "Open" : "Closed",
      detail: season.submissionsLocked
        ? "Manually locked"
        : "Deadline controlled",
    },
    {
      icon: Database,
      label: "Active table",
      value: activeSnapshot
        ? activeSnapshot.isFinal
          ? "Final"
          : "Provisional"
        : "None",
      detail: activeSnapshot
        ? formatUtcDateTime(
            season.standingsAcceptedThrough ?? activeSnapshot.capturedAt,
          )
        : "Scoring has not started",
    },
  ] as const;

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5">
        <div>
          <Badge variant="accent">Private owner area</Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Season control room
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage fairness, submissions, validated standings, and reviewed
            spotlight-result snapshots.
          </p>
        </div>

        <AdminNav current="/admin" />

        <section
          className="grid gap-3 sm:grid-cols-3"
          aria-label="Season status"
        >
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent>
                <stat.icon
                  aria-hidden="true"
                  className="size-5 text-emerald-700"
                />
                <p className="mt-4 text-xs font-black tracking-[0.12em] text-slate-500 uppercase">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {stat.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <RefreshCcw aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-950">
                  Latest standings import
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {latestRun
                    ? `${latestRun.status} · ${formatUtcDateTime(latestRun.createdAt)}`
                    : "No automation or manual import has been recorded yet."}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-auto"
              href="/admin/standings"
            >
              Manage table
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
