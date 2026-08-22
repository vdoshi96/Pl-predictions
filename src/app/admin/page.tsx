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
import { formatChicagoUtcDateTime } from "@/shared/format";
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
        ? formatChicagoUtcDateTime(
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
          <h1 className="text-foreground mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Season control room
          </h1>
          <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
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
                  className="text-mint-ink size-5"
                />
                <p className="text-muted mt-4 text-xs font-black tracking-[0.12em] uppercase">
                  {stat.label}
                </p>
                <p className="text-foreground mt-1 text-2xl font-black tracking-tight">
                  {stat.value}
                </p>
                <p className="text-muted mt-1 text-xs leading-5">
                  {stat.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="bg-surface-subtle text-muted grid size-10 shrink-0 place-items-center rounded-xl">
                <RefreshCcw aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-foreground font-black">
                  Latest standings import
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  {latestRun
                    ? `${latestRun.status} · ${formatChicagoUtcDateTime(latestRun.createdAt)}`
                    : "No automation or manual import has been recorded yet."}
                </p>
              </div>
            </div>
            <Link
              className="bg-brand hover:bg-brand-hover focus-visible:ring-accent/30 focus-visible:ring-offset-background inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto"
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
