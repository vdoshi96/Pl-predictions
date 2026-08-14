import { CalendarClock, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ACTIVE_SEASON } from "@/data/season";
import { getAdminSession } from "@/features/admin";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { getSeasonAccess } from "@/shared/policy";

import { AdminNav } from "../admin-nav";
import { DeadlineTimeZones } from "./deadline-timezones";
import { IrreversibleSeasonAction } from "./irreversible-season-action";

export const metadata: Metadata = { title: "Season settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  const { databaseNow, season } = await getActiveSeasonContext();
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );
  const initialRemainingSeconds = Math.max(
    0,
    Math.floor(
      (season.openingKickoff.getTime() - databaseNow.getTime()) / 1_000,
    ),
  );

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5">
        <div>
          <Badge variant="accent">Fairness controls</Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Season settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            The fixed opening kickoff and permanent controls are enforced on the
            server for every new submission.
          </p>
        </div>

        <AdminNav current="/admin/settings" />

        {access.predictionsRevealed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            Predictions have been revealed. Fairness protection keeps new
            entries permanently closed.
          </p>
        ) : null}

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <CalendarClock
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-emerald-700"
              />
              <div className="min-w-0 grow">
                <h2 className="font-black text-slate-950">
                  Fixed submission deadline
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Submissions close at Arsenal v Coventry&apos;s opening
                  kickoff. This time cannot be edited here.{" "}
                  <a
                    className="font-bold underline underline-offset-2"
                    href={ACTIVE_SEASON.openingFixture.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Premier League fixture source
                  </a>
                  .
                </p>
                <div className="mt-4">
                  <DeadlineTimeZones
                    deadlineIso={season.openingKickoff.toISOString()}
                    initialRemainingSeconds={initialRemainingSeconds}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4">
            <div className="flex items-start gap-3">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-red-700"
              />
              <div>
                <h2 className="font-black text-slate-950">
                  Permanent season actions
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Both actions reveal predictions and permanently close new
                  submissions. Choose the action that records your intent.
                </p>
              </div>
            </div>

            <IrreversibleSeasonAction
              confirmationPhrase="LOCK"
              description="Reject new entries immediately and make every prediction public."
              disabled={access.predictionsRevealed}
              intent="lock"
              title="Lock submissions now"
            />
            <IrreversibleSeasonAction
              confirmationPhrase="REVEAL"
              description="Publish every prediction before kickoff and close submissions at the same moment."
              disabled={access.predictionsRevealed}
              intent="reveal"
              title="Reveal predictions early"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
