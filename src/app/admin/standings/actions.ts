"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  ManualStandingsPayload,
  ManualStandingsResult,
} from "@/features/standings/manual-standings-form";
import { getDb } from "@/db/client";
import { adminAuditLogs, standingsItems } from "@/db/schema";
import {
  getAdminAuditMetadata,
  isFinalStandingsCandidate,
  requireAdminMutation,
} from "@/features/admin";
import { getActiveSeasonView } from "@/features/seasons/queries";
import {
  finalizeSnapshotAtomically,
  undoFinalSnapshotAtomically,
} from "@/features/standings/finalization";
import { safeErrorMessage } from "@/shared/errors";
import { importCanonicalStandings } from "../../../../scripts/import-standings";

function revalidateStandingsViews() {
  revalidatePath("/leaderboard");
  revalidatePath("/admin");
  revalidatePath("/admin/standings");
}

export async function saveManualStandings(
  payload: ManualStandingsPayload,
): Promise<ManualStandingsResult> {
  try {
    await requireAdminMutation();
    const { season } = await getActiveSeasonView();
    const result = await importCanonicalStandings({
      capturedAt: new Date().toISOString(),
      isFinal: false,
      kind: "snapshot",
      matchweek: payload.matchweek,
      seasonSlug: season.slug,
      source: "manual-admin",
      sourceReference: null,
      sourceUpdatedAt: null,
      standings: payload.standings,
      version: 1,
    });
    const audit = await getAdminAuditMetadata();
    await getDb()
      .insert(adminAuditLogs)
      .values({
        seasonId: season.id,
        actor: "admin",
        action: "standings.manual.saved",
        targetType: "standings_snapshot",
        targetId: "snapshotId" in result ? result.snapshotId : null,
        requestId: audit.requestId,
        metadata: { matchweek: payload.matchweek, status: result.status },
      });
    revalidateStandingsViews();
    return {
      ok: true,
      message:
        result.status === "duplicate"
          ? "That table already exists; the active snapshot was unchanged."
          : "The validated provisional table is now active.",
    };
  } catch (error) {
    return { ok: false, message: safeErrorMessage(error) };
  }
}

export async function finalizeActiveSnapshot() {
  await requireAdminMutation();
  const { season } = await getActiveSeasonView();
  if (!season.activeSnapshotId)
    throw new Error("No active snapshot to finalize.");
  const db = getDb();
  const candidateItems = await db
    .select({ playedGames: standingsItems.playedGames })
    .from(standingsItems)
    .where(eq(standingsItems.snapshotId, season.activeSnapshotId));
  if (!isFinalStandingsCandidate(candidateItems)) {
    redirect("/admin/standings?error=incomplete");
  }

  const audit = await getAdminAuditMetadata();
  const finalized = await finalizeSnapshotAtomically(db, {
    requestId: audit.requestId,
    seasonId: season.id,
    snapshotId: season.activeSnapshotId,
  });
  if (!finalized) redirect("/admin/standings?error=changed");

  revalidateStandingsViews();
}

export async function undoFinalSnapshot() {
  await requireAdminMutation();
  const { season } = await getActiveSeasonView();
  if (!season.finalSnapshotId) throw new Error("The season is not final.");
  const audit = await getAdminAuditMetadata();
  const db = getDb();
  const undone = await undoFinalSnapshotAtomically(db, {
    requestId: audit.requestId,
    seasonId: season.id,
    snapshotId: season.finalSnapshotId,
  });
  if (!undone) redirect("/admin/standings?error=undo-changed");

  revalidateStandingsViews();
}
