import { CalendarClock, Eye, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminSession } from "@/features/admin";
import { getActiveSeasonView } from "@/features/seasons/queries";
import { getSeasonAccess } from "@/shared/policy";

import { AdminNav } from "../admin-nav";
import { updateSeasonSettings } from "./actions";

export const metadata: Metadata = { title: "Season settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getAdminSession())) redirect("/admin/login");
  const { season } = await getActiveSeasonView();
  const params = await searchParams;
  const deadlineValue = season.submissionDeadline
    ? season.submissionDeadline.toISOString().slice(0, 16)
    : "";
  const access = getSeasonAccess({
    revealPredictions: season.revealPredictions,
    submissionDeadline: season.submissionDeadline,
    submissionsLocked: season.submissionsLocked,
  });

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5">
        <div>
          <Badge variant="accent">Fairness controls</Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Season settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            These controls are enforced on the server for every new submission.
          </p>
        </div>

        <AdminNav current="/admin/settings" />

        {params.saved === "1" ? (
          <p
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"
            role="status"
          >
            Season settings saved.
          </p>
        ) : null}
        {params.error ? (
          <p
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800"
            role="alert"
          >
            Check the deadline and try again. Nothing was changed.
          </p>
        ) : null}

        {access.predictionsRevealed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            Predictions have been revealed. Fairness protection keeps new
            entries permanently closed; later deadline edits cannot reopen the
            season.
          </p>
        ) : null}

        <Card>
          <CardContent>
            <form action={updateSeasonSettings} className="grid gap-6">
              <div>
                <div className="flex items-start gap-3">
                  <CalendarClock
                    aria-hidden="true"
                    className="mt-0.5 size-5 text-emerald-700"
                  />
                  <div>
                    <label
                      className="font-black text-slate-950"
                      htmlFor="submissionDeadline"
                    >
                      Submission deadline
                    </label>
                    <p
                      className="mt-1 text-sm leading-6 text-slate-600"
                      id="submission-deadline-help"
                    >
                      Entered and displayed in UTC. Leave blank to keep entries
                      open until manually locked. Once predictions are visible,
                      a later date cannot reopen submissions.
                    </p>
                  </div>
                </div>
                <input
                  aria-describedby="submission-deadline-help"
                  className="mt-3 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:max-w-sm"
                  defaultValue={deadlineValue}
                  id="submissionDeadline"
                  name="submissionDeadline"
                  type="datetime-local"
                />
              </div>

              <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 outline-none focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 hover:bg-slate-50">
                <input
                  className="mt-1 size-5 accent-emerald-700"
                  defaultChecked={season.submissionsLocked}
                  disabled={access.predictionsRevealed}
                  name="submissionsLocked"
                  type="checkbox"
                />
                <LockKeyhole
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-slate-500"
                />
                <span>
                  <span className="block font-black text-slate-950">
                    Manually lock submissions
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    Rejects new entries immediately and reveals predictions.
                    This fairness boundary is permanent.
                  </span>
                </span>
              </label>

              <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 outline-none focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 hover:bg-slate-50">
                <input
                  className="mt-1 size-5 accent-emerald-700"
                  defaultChecked={access.predictionsRevealed}
                  disabled={access.predictionsRevealed}
                  name="revealPredictions"
                  type="checkbox"
                />
                <Eye
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-slate-500"
                />
                <span>
                  <span className="block font-black text-slate-950">
                    Reveal predictions early
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    Makes every full prediction public and permanently closes
                    submissions at the same time. Default is off.
                  </span>
                </span>
              </label>

              <ConfirmSubmitButton
                className="w-full sm:w-fit"
                confirmation="Save these season controls? Revealing or locking takes effect immediately and cannot be reversed."
                size="lg"
              >
                Save season settings
              </ConfirmSubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
