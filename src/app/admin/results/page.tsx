import { and, asc, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import {
  players,
  predictions,
  predictionCategoryPicks,
  spotlightResultAliases,
  spotlightResultItems,
  spotlightResultSnapshotAliases,
  spotlightResultSnapshots,
  spotlightResultStates,
} from "@/db/schema";
import { getAdminSession } from "@/features/admin";
import {
  isPredictionCategory,
  type PredictionCategory,
} from "@/features/predictions/categories";
import {
  isSpotlightResultDataset,
  SPOTLIGHT_RESULT_DATASETS,
} from "@/features/results";
import { getPickedSubjectsByCategory } from "@/features/results/seed-queries";
import {
  getActiveSeasonContext,
  getSeasonTeams,
} from "@/features/seasons/queries";
import { getSeasonAccess } from "@/shared/policy";

import { AdminNav } from "../admin-nav";
import {
  SpotlightResultsDesk,
  type ResultDeskAlias,
  type ResultDeskDataset,
} from "./results-desk";

export const metadata: Metadata = { title: "Spotlight results admin" };
export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  if (!(await getAdminSession())) redirect("/admin/login");

  const { databaseNow, season } = await getActiveSeasonContext();
  const db = getDb();
  const [
    seasonPlayers,
    seasonTeams,
    stateRows,
    [bracketCountRow],
    customPicks,
    aliases,
    pickedSubjects,
  ] = await Promise.all([
    db
      .select({
        displayName: players.displayName,
        id: players.id,
        isActive: players.isActive,
        sortName: players.sortName,
        teamId: players.teamId,
      })
      .from(players)
      .where(eq(players.seasonId, season.id))
      .orderBy(asc(players.sortName), asc(players.displayName)),
    getSeasonTeams(season.id),
    db
      .select()
      .from(spotlightResultStates)
      .where(eq(spotlightResultStates.seasonId, season.id)),
    db
      .select({ value: count() })
      .from(predictions)
      .where(eq(predictions.seasonId, season.id)),
    db
      .select({
        category: predictionCategoryPicks.category,
        customPlayerName: predictionCategoryPicks.customPlayerName,
        normalizedCustomPlayerName:
          predictionCategoryPicks.normalizedCustomPlayerName,
      })
      .from(predictionCategoryPicks)
      .innerJoin(
        predictions,
        eq(predictions.id, predictionCategoryPicks.predictionId),
      )
      .where(
        and(
          eq(predictions.seasonId, season.id),
          isNotNull(predictionCategoryPicks.customPlayerName),
          isNotNull(predictionCategoryPicks.normalizedCustomPlayerName),
        ),
      ),
    db
      .select({
        normalizedCustomPlayerName:
          spotlightResultAliases.normalizedCustomPlayerName,
        playerId: spotlightResultAliases.playerId,
      })
      .from(spotlightResultAliases)
      .where(eq(spotlightResultAliases.seasonId, season.id)),
    getPickedSubjectsByCategory(season.id, { resolveAliases: false }),
  ]);

  const stateByDataset = new Map(
    stateRows.flatMap((state) =>
      isSpotlightResultDataset(state.dataset)
        ? [[state.dataset, state] as const]
        : [],
    ),
  );
  const referencedSnapshotIds = [
    ...new Set(
      stateRows.flatMap((state) =>
        [
          state.workingSnapshotId,
          state.activeSnapshotId,
          state.finalSnapshotId,
        ].filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const [snapshotRows, itemRows, snapshotAliasRows] =
    referencedSnapshotIds.length
      ? await Promise.all([
          db
            .select()
            .from(spotlightResultSnapshots)
            .where(inArray(spotlightResultSnapshots.id, referencedSnapshotIds)),
          db
            .select({
              metricValue: spotlightResultItems.metricValue,
              playerId: spotlightResultItems.playerId,
              snapshotId: spotlightResultItems.snapshotId,
              teamId: spotlightResultItems.teamId,
            })
            .from(spotlightResultItems)
            .where(
              inArray(spotlightResultItems.snapshotId, referencedSnapshotIds),
            ),
          db
            .select({
              normalizedCustomPlayerName:
                spotlightResultSnapshotAliases.normalizedCustomPlayerName,
              playerId: spotlightResultSnapshotAliases.playerId,
              snapshotId: spotlightResultSnapshotAliases.snapshotId,
            })
            .from(spotlightResultSnapshotAliases)
            .where(
              inArray(
                spotlightResultSnapshotAliases.snapshotId,
                referencedSnapshotIds,
              ),
            ),
        ])
      : [[], [], []];
  const snapshotById = new Map(
    snapshotRows.map((snapshot) => [snapshot.id, snapshot]),
  );
  const bracketCount = bracketCountRow?.value ?? 0;
  const datasets: ResultDeskDataset[] = SPOTLIGHT_RESULT_DATASETS.map(
    (dataset) => {
      const state = stateByDataset.get(dataset);
      const editorSnapshotId =
        state?.workingSnapshotId ?? state?.activeSnapshotId ?? null;
      const snapshot = editorSnapshotId
        ? snapshotById.get(editorSnapshotId)
        : undefined;
      const activeSnapshot = state?.activeSnapshotId
        ? snapshotById.get(state.activeSnapshotId)
        : undefined;
      return {
        activeSnapshot: activeSnapshot
          ? {
              capturedAt: activeSnapshot.capturedAt.toISOString(),
              coveredThroughRank: activeSnapshot.coveredThroughRank ?? 0,
              id: activeSnapshot.id,
              itemCount: itemRows.filter(
                (item) => item.snapshotId === activeSnapshot.id,
              ).length,
              source: activeSnapshot.source,
              sourceReference: activeSnapshot.sourceReference,
            }
          : null,
        capturedAt: (snapshot?.capturedAt ?? databaseNow).toISOString(),
        coveredThroughRank:
          snapshot?.coveredThroughRank ??
          (bracketCount > 0 ? bracketCount : null),
        dataset,
        pinnedAliases: editorSnapshotId
          ? snapshotAliasRows.flatMap((alias) =>
              alias.snapshotId === editorSnapshotId
                ? [
                    {
                      normalizedCustomPlayerName:
                        alias.normalizedCustomPlayerName,
                      playerId: alias.playerId,
                    },
                  ]
                : [],
            )
          : [],
        pointers: {
          activeSnapshotId: state?.activeSnapshotId ?? null,
          finalSnapshotId: state?.finalSnapshotId ?? null,
          workingSnapshotId: state?.workingSnapshotId ?? null,
        },
        publishedRows: state?.activeSnapshotId
          ? itemRows.flatMap((item) => {
              if (item.snapshotId !== state.activeSnapshotId) return [];
              const subjectId = item.playerId ?? item.teamId;
              return subjectId
                ? [{ metricValue: item.metricValue, subjectId }]
                : [];
            })
          : [],
        rows: editorSnapshotId
          ? itemRows.flatMap((item) => {
              if (item.snapshotId !== editorSnapshotId) return [];
              const subjectId = item.playerId ?? item.teamId;
              return subjectId
                ? [{ metricValue: item.metricValue, subjectId }]
                : [];
            })
          : [],
        source: snapshot?.source ?? "Manual owner review",
        sourceReference: snapshot?.sourceReference ?? null,
      };
    },
  );

  const teamById = new Map(seasonTeams.map((team) => [team.id, team]));
  const aliasByName = new Map(
    aliases.map((alias) => [alias.normalizedCustomPlayerName, alias.playerId]),
  );
  const customNameByNormalized = new Map<
    string,
    { categories: Set<PredictionCategory>; customPlayerName: string }
  >();
  for (const pick of customPicks) {
    if (
      pick.normalizedCustomPlayerName &&
      pick.customPlayerName &&
      isPredictionCategory(pick.category)
    ) {
      const existing = customNameByNormalized.get(
        pick.normalizedCustomPlayerName,
      );
      const categories = existing?.categories ?? new Set<PredictionCategory>();
      categories.add(pick.category);
      customNameByNormalized.set(pick.normalizedCustomPlayerName, {
        categories,
        customPlayerName: existing?.customPlayerName ?? pick.customPlayerName,
      });
    }
  }
  const resultAliases: ResultDeskAlias[] = [...customNameByNormalized]
    .map(([normalizedCustomPlayerName, value]) => ({
      categories: [...value.categories],
      customPlayerName: value.customPlayerName,
      normalizedCustomPlayerName,
      playerId: aliasByName.get(normalizedCustomPlayerName) ?? null,
    }))
    .sort((left, right) =>
      left.customPlayerName.localeCompare(right.customPlayerName),
    );
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );

  return (
    <main id="main-content" className="page-shell min-w-0 flex-1 py-6 sm:py-10">
      <div className="grid min-w-0 gap-5">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Spotlight results
          </h1>
          <p className="text-muted mt-2 max-w-3xl text-sm leading-6">
            Enter reviewed season outcomes row by row. Draft snapshots stay
            private; publishing moves one exact immutable snapshot into public
            scoring, and final status can only be undone against that same
            active pointer.
          </p>
        </div>

        <AdminNav current="/admin/results" />

        <SpotlightResultsDesk
          aliases={resultAliases}
          bracketCount={bracketCount}
          datasets={datasets}
          pickedSubjects={pickedSubjects}
          players={seasonPlayers.map((player) => ({
            active: player.isActive,
            id: player.id,
            label: player.teamId
              ? `${player.displayName} — ${teamById.get(player.teamId)?.shortName ?? "Unknown club"}`
              : player.displayName,
            names: [player.displayName, player.sortName],
          }))}
          publishReady={access.predictionsRevealed && !access.submissionsOpen}
          seasonName={season.name}
          teams={seasonTeams.map((team) => ({
            id: team.id,
            label: team.displayName,
            names: [team.displayName, team.shortName, team.sortName],
          }))}
        />
      </div>
    </main>
  );
}
