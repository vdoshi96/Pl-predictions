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
          <h1 className="text-foreground mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Season settings
          </h1>
          <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
            The fixed opening kickoff and permanent controls are enforced on the
            server for every new submission.
          </p>
        </div>

        <AdminNav current="/admin/settings" />

        {access.predictionsRevealed ? (
          <p className="border-warning/35 bg-warning-soft text-warning rounded-xl border p-3 text-sm font-bold">
            Predictions have been revealed. Fairness protection keeps new
            entries permanently closed.
          </p>
        ) : null}

        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <CalendarClock
                aria-hidden="true"
                className="text-mint-ink mt-0.5 size-5 shrink-0"
              />
              <div className="min-w-0 grow">
                <h2 className="text-foreground font-black">
                  Fixed submission deadline
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
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
                className="text-danger mt-0.5 size-5 shrink-0"
              />
              <div>
                <h2 className="text-foreground font-black">
                  Permanent season actions
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
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
