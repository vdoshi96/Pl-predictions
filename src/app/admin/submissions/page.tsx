import { count, desc, eq, inArray } from "drizzle-orm";
import { Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db/client";
import {
  predictionCategoryPicks,
  predictionItems,
  predictions,
} from "@/db/schema";
import { getAdminSession } from "@/features/admin";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { formatUtcDateTime } from "@/shared/format";

import { AdminNav } from "../admin-nav";
import { deleteSubmission } from "./actions";

export const metadata: Metadata = { title: "Submissions admin" };
export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getAdminSession())) redirect("/admin/login");
  const { season } = await getActiveSeasonContext();
  const params = await searchParams;
  const db = getDb();
  const rows = await db
    .select({
      createdAt: predictions.createdAt,
      id: predictions.id,
      itemCount: count(predictionItems.teamId),
      participantName: predictions.participantName,
    })
    .from(predictions)
    .leftJoin(predictionItems, eq(predictionItems.predictionId, predictions.id))
    .where(eq(predictions.seasonId, season.id))
    .groupBy(predictions.id)
    .orderBy(desc(predictions.createdAt));
  const pickCountRows =
    rows.length === 0
      ? []
      : await db
          .select({
            pickCount: count(predictionCategoryPicks.category),
            predictionId: predictionCategoryPicks.predictionId,
          })
          .from(predictionCategoryPicks)
          .where(
            inArray(
              predictionCategoryPicks.predictionId,
              rows.map((row) => row.id),
            ),
          )
          .groupBy(predictionCategoryPicks.predictionId);
  const pickCountByPredictionId = new Map(
    pickCountRows.map((row) => [row.predictionId, row.pickCount] as const),
  );

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5">
        <div>
          <Badge variant="accent">Immutable entries</Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Submissions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Participants cannot edit an entry. Delete only a confirmed mistake
            so the same display name can submit again.
          </p>
        </div>

        <AdminNav current="/admin/submissions" />

        {params.deleted === "1" ? (
          <p
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900"
            role="status"
          >
            Entire submission deleted: table, spotlight picks, and receipt.
          </p>
        ) : null}

        {params.error ? (
          <p
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800"
            role="alert"
          >
            That submission could not be deleted. Refresh and try again.
          </p>
        ) : null}

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Users
                aria-hidden="true"
                className="mx-auto size-8 text-slate-400"
              />
              <h2 className="mt-3 text-xl font-black text-slate-950">
                No submissions yet
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                New entries will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2" aria-label="All submissions">
            {rows.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 grow">
                      <Link
                        className="inline-flex min-h-11 max-w-full items-center truncate rounded-lg font-black text-slate-950 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        href={`/entries/${entry.id}`}
                      >
                        {entry.participantName}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatUtcDateTime(entry.createdAt)} · {entry.itemCount}{" "}
                        positions · {pickCountByPredictionId.get(entry.id) ?? 0}{" "}
                        spotlight picks
                      </p>
                    </div>
                    <form action={deleteSubmission}>
                      <input
                        name="predictionId"
                        type="hidden"
                        value={entry.id}
                      />
                      <ConfirmSubmitButton
                        className="w-full sm:w-auto"
                        confirmation={`Delete ${entry.participantName}'s immutable prediction? This removes the 20 table rows, all spotlight picks, and allows the name to submit again.`}
                        size="md"
                        variant="danger"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                        Delete entry
                      </ConfirmSubmitButton>
                    </form>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
