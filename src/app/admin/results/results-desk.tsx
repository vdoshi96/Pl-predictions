"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchablePredictionSelect } from "@/features/predictions/searchable-prediction-select";
import {
  evaluateCoverage,
  findBoundaryTieWarnings,
} from "@/features/results/boundary-ties";
import { buildResultDiff } from "@/features/results/dataset-diff";
import {
  RESULT_DATASET_BY_CATEGORY,
  SPOTLIGHT_RESULT_DATASETS,
  type SpotlightResultActionResult,
  type SpotlightResultDataset,
} from "@/features/results/types";
import type { PredictionCategory } from "@/features/predictions/categories";

import {
  createStandaloneSpotlightResultOnlyPlayer,
  createSpotlightResultOnlyPlayer,
  finalizeSpotlightResult,
  publishSpotlightResult,
  saveSpotlightResultAlias,
  saveSpotlightResultDraft,
  undoFinalSpotlightResult,
} from "./actions";
import { PublishReviewDialog } from "./publish-review-dialog";
import { ResultsPastePanel } from "./results-paste-panel";

export type ResultDeskSubject = Readonly<{
  active?: boolean;
  id: string;
  label: string;
  names: readonly string[];
}>;

type EditableResultRow = Readonly<{
  metricValue: number;
  subjectId: string;
}>;

type ResultPointers = Readonly<{
  activeSnapshotId: string | null;
  finalSnapshotId: string | null;
  workingSnapshotId: string | null;
}>;

type ResultDeskSnapshotAlias = Readonly<{
  normalizedCustomPlayerName: string;
  playerId: string;
}>;

type ResultDeskPublishedSnapshot = Readonly<{
  capturedAt: string;
  coveredThroughRank: number;
  id: string;
  itemCount: number;
  source: string;
  sourceReference: string | null;
}>;

export type ResultDeskDataset = Readonly<{
  activeSnapshot: ResultDeskPublishedSnapshot | null;
  capturedAt: string;
  coveredThroughRank: number | null;
  dataset: SpotlightResultDataset;
  pinnedAliases: readonly ResultDeskSnapshotAlias[];
  pointers: ResultPointers;
  publishedRows: readonly EditableResultRow[];
  rows: readonly EditableResultRow[];
  source: string;
  sourceReference: string | null;
}>;

export type ResultDeskAlias = Readonly<{
  categories: readonly PredictionCategory[];
  customPlayerName: string;
  normalizedCustomPlayerName: string;
  playerId: string | null;
}>;

type EditableDataset = {
  activeSnapshot: ResultDeskPublishedSnapshot | null;
  capturedAt: string;
  coveredThroughRank: number | null;
  dataset: SpotlightResultDataset;
  dirty: boolean;
  pinnedAliases: readonly ResultDeskSnapshotAlias[];
  pointers: ResultPointers;
  publishedRows: readonly EditableResultRow[];
  rows: EditableResultRow[];
  source: string;
  sourceReference: string;
};

type ResultDeskProps = Readonly<{
  aliases: readonly ResultDeskAlias[];
  bracketCount: number;
  datasets: readonly ResultDeskDataset[];
  pickedSubjects: Readonly<
    Record<SpotlightResultDataset, readonly string[]>
  >;
  players: readonly ResultDeskSubject[];
  publishReady: boolean;
  seasonName: string;
  teams: readonly ResultDeskSubject[];
}>;

const DATASET_LABELS: Record<SpotlightResultDataset, string> = {
  clean_sheets: "Most clean sheets",
  goals: "Top scorer",
  assists: "Top assister",
  player_ratings: "Player ratings",
};

const METRIC_LABELS: Record<SpotlightResultDataset, string> = {
  clean_sheets: "Clean sheets",
  goals: "Goals",
  assists: "Assists",
  player_ratings: "Season rating",
};

function toUtcInputValue(isoValue: string) {
  const date = new Date(isoValue);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function fromUtcInputValue(value: string) {
  return new Date(`${value}:00.000Z`).toISOString();
}

function rankedRows(
  rows: readonly EditableResultRow[],
  direction: "ascending" | "descending",
  labelBySubjectId: ReadonlyMap<string, string>,
) {
  const ordered = [...rows].sort((left, right) => {
    const metricDifference =
      direction === "descending"
        ? right.metricValue - left.metricValue
        : left.metricValue - right.metricValue;
    return (
      metricDifference ||
      (labelBySubjectId.get(left.subjectId) ?? "").localeCompare(
        labelBySubjectId.get(right.subjectId) ?? "",
      )
    );
  });
  return ordered.map((row, index) => ({
    ...row,
    rank:
      index > 0 && ordered[index - 1]?.metricValue === row.metricValue
        ? ordered
            .slice(0, index)
            .findIndex(
              (candidate) => candidate.metricValue === row.metricValue,
            ) + 1
        : index + 1,
  }));
}

function DatasetMetadata({
  dataset,
  disabled,
  onChange,
}: {
  dataset: EditableDataset;
  disabled: boolean;
  onChange: (patch: Partial<EditableDataset>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-sm font-bold text-slate-800">
        Source
        <input
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
          disabled={disabled}
          maxLength={64}
          onChange={(event) => onChange({ source: event.target.value })}
          value={dataset.source}
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-800">
        Source reference
        <input
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
          disabled={disabled}
          maxLength={2048}
          onChange={(event) =>
            onChange({ sourceReference: event.target.value })
          }
          placeholder="URL, report, or owner note"
          value={dataset.sourceReference}
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-800">
        Captured at (UTC)
        <input
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
          disabled={disabled}
          onChange={(event) => onChange({ capturedAt: event.target.value })}
          type="datetime-local"
          value={dataset.capturedAt}
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-800">
        Complete through rank
        <input
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
          disabled={disabled}
          min={1}
          onChange={(event) =>
            onChange({
              coveredThroughRank: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
          type="number"
          value={dataset.coveredThroughRank ?? ""}
        />
      </label>
    </div>
  );
}

function EditableResultTable({
  dataset,
  direction,
  disabled,
  onRowsChange,
  rows,
  subjects,
  title,
}: {
  dataset: SpotlightResultDataset;
  direction: "ascending" | "descending";
  disabled: boolean;
  onRowsChange: (rows: EditableResultRow[]) => void;
  rows: readonly EditableResultRow[];
  subjects: readonly ResultDeskSubject[];
  title: string;
}) {
  const labelBySubjectId = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.label])),
    [subjects],
  );
  const ranked = rankedRows(rows, direction, labelBySubjectId);
  const selectedSubjectIds = new Set(rows.map((row) => row.subjectId));
  const firstUnusedSubject = subjects.find(
    (subject) => !selectedSubjectIds.has(subject.id),
  );

  function replaceRow(oldSubjectId: string, patch: Partial<EditableResultRow>) {
    onRowsChange(
      rows.map((row) =>
        row.subjectId === oldSubjectId ? { ...row, ...patch } : row,
      ),
    );
  }

  function searchableOptionsFor(currentSubjectId: string) {
    return subjects
      .filter(
        (subject) =>
          subject.id === currentSubjectId ||
          !selectedSubjectIds.has(subject.id),
      )
      .map((subject) => ({
        displayName: `${subject.label}${subject.active === false ? " (inactive)" : ""}`,
        id: subject.id,
        searchText: subject.label,
      }));
  }

  return (
    <section
      aria-labelledby={`${dataset}-${direction}-title`}
      className="min-w-0"
    >
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3
            className="font-black text-slate-950"
            id={`${dataset}-${direction}-title`}
          >
            {title}
          </h3>
          <p className="text-xs leading-5 text-slate-500">
            Ranked {direction === "descending" ? "highest" : "lowest"} first;
            equal values share a rank.
          </p>
        </div>
        <Button
          disabled={disabled || !firstUnusedSubject}
          onClick={() =>
            firstUnusedSubject &&
            onRowsChange([
              ...rows,
              { metricValue: 0, subjectId: firstUnusedSubject.id },
            ])
          }
          size="sm"
          variant="secondary"
        >
          Add row
        </Button>
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="w-16 px-3 py-3" scope="col">
                Rank
              </th>
              <th className="px-3 py-3" scope="col">
                {dataset === "clean_sheets" ? "Club" : "Player"}
              </th>
              <th className="w-40 px-3 py-3" scope="col">
                {METRIC_LABELS[dataset]}
              </th>
              <th className="w-24 px-3 py-3" scope="col">
                <span className="sr-only">Row action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ranked.map((row) => (
              <tr key={row.subjectId}>
                <td className="px-3 py-2 font-black text-slate-700">
                  {row.rank}
                </td>
                <td className="px-3 py-2">
                  <SearchablePredictionSelect
                    description="Search this season's reviewed subjects."
                    disabled={disabled}
                    emptyMessage="No matching subject is available."
                    label={`${title} rank ${row.rank} subject`}
                    maximumResults={40}
                    onChange={(value) =>
                      value &&
                      value !== "other" &&
                      replaceRow(row.subjectId, { subjectId: value })
                    }
                    options={searchableOptionsFor(row.subjectId)}
                    value={row.subjectId}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${title} ${METRIC_LABELS[dataset]} for ${labelBySubjectId.get(row.subjectId) ?? "subject"}`}
                    className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
                    disabled={disabled}
                    max={dataset === "player_ratings" ? 10 : undefined}
                    min={0}
                    onChange={(event) =>
                      replaceRow(row.subjectId, {
                        metricValue: Number(event.target.value),
                      })
                    }
                    step={dataset === "player_ratings" ? "0.001" : "1"}
                    type="number"
                    value={row.metricValue}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    aria-label={`Remove ${labelBySubjectId.get(row.subjectId) ?? "result row"}`}
                    disabled={disabled}
                    onClick={() =>
                      onRowsChange(
                        rows.filter(
                          (candidate) => candidate.subjectId !== row.subjectId,
                        ),
                      )
                    }
                    size="sm"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {ranked.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-slate-500"
                  colSpan={4}
                >
                  Add the first reviewed row.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function editorStatusLabel(dataset: EditableDataset) {
  if (dataset.dirty) return "Unsaved changes";
  if (dataset.pointers.workingSnapshotId) return "Saved draft";
  return "Not started";
}

export function SpotlightResultsDesk({
  aliases,
  bracketCount,
  datasets: initialDatasets,
  pickedSubjects,
  players,
  publishReady,
  seasonName,
  teams,
}: ResultDeskProps) {
  const [datasets, setDatasets] = useState<
    Record<SpotlightResultDataset, EditableDataset>
  >(
    () =>
      Object.fromEntries(
        initialDatasets.map((dataset) => [
          dataset.dataset,
          {
            ...dataset,
            capturedAt: toUtcInputValue(dataset.capturedAt),
            dirty: false,
            rows: [...dataset.rows],
            sourceReference: dataset.sourceReference ?? "",
          },
        ]),
      ) as Record<SpotlightResultDataset, EditableDataset>,
  );
  const [aliasPlayerIdByName, setAliasPlayerIdByName] = useState(
    () =>
      new Map(
        aliases.map((alias) => [
          alias.normalizedCustomPlayerName,
          alias.playerId ?? "",
        ]),
      ),
  );
  const [savedAliasPlayerIdByName, setSavedAliasPlayerIdByName] = useState(
    () =>
      new Map(
        aliases.map((alias) => [
          alias.normalizedCustomPlayerName,
          alias.playerId ?? "",
        ]),
      ),
  );
  const [availablePlayers, setAvailablePlayers] = useState(() => [...players]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newResultOnlyName, setNewResultOnlyName] = useState("");
  const [reviewDataset, setReviewDataset] =
    useState<SpotlightResultDataset | null>(null);
  const [messages, setMessages] = useState<
    Record<string, SpotlightResultActionResult>
  >({});

  const unresolvedLiveAliasCount = aliases.filter(
    (alias) => !savedAliasPlayerIdByName.get(alias.normalizedCustomPlayerName),
  ).length;

  function updateDataset(
    dataset: SpotlightResultDataset,
    patch: Partial<EditableDataset>,
    options: { markDirty?: boolean } = {},
  ) {
    const markDirty = options.markDirty ?? true;
    setDatasets((current) => ({
      ...current,
      [dataset]: {
        ...current[dataset],
        ...patch,
        dirty: markDirty ? true : (patch.dirty ?? current[dataset].dirty),
      },
    }));
  }

  function aliasesForDataset(dataset: SpotlightResultDataset) {
    return aliases.filter((alias) =>
      alias.categories.some(
        (category) => RESULT_DATASET_BY_CATEGORY[category] === dataset,
      ),
    );
  }

  function unresolvedAliasCountForDataset(dataset: SpotlightResultDataset) {
    const pinnedByName = new Map(
      datasets[dataset].pinnedAliases.map((alias) => [
        alias.normalizedCustomPlayerName,
        alias.playerId,
      ]),
    );
    return aliasesForDataset(dataset).filter((alias) => {
      const savedPlayerId = savedAliasPlayerIdByName.get(
        alias.normalizedCustomPlayerName,
      );
      return (
        !savedPlayerId ||
        pinnedByName.get(alias.normalizedCustomPlayerName) !== savedPlayerId
      );
    }).length;
  }

  function unresolvedLiveAliasCountForDataset(
    dataset: SpotlightResultDataset,
  ) {
    return aliasesForDataset(dataset).filter(
      (alias) =>
        !savedAliasPlayerIdByName.get(alias.normalizedCustomPlayerName),
    ).length;
  }

  function labelBySubjectIdFor(dataset: SpotlightResultDataset) {
    const subjects =
      dataset === "clean_sheets" ? teams : availablePlayers;
    return new Map(
      subjects.map((subject) => [subject.id, subject.label] as const),
    );
  }

  function seedFromSubmissions(datasetName: SpotlightResultDataset) {
    const dataset = datasets[datasetName];
    const present = new Set(dataset.rows.map((row) => row.subjectId));
    const additions = pickedSubjects[datasetName]
      .filter((subjectId) => !present.has(subjectId))
      .map((subjectId) => ({ metricValue: 0, subjectId }));
    if (additions.length === 0) return;
    updateDataset(datasetName, {
      rows: [...dataset.rows, ...additions],
    });
  }

  function applyPastedRows(
    datasetName: SpotlightResultDataset,
    incoming: readonly { metricValue: number; subjectId: string }[],
  ) {
    const dataset = datasets[datasetName];
    const bySubject = new Map(
      dataset.rows.map((row) => [row.subjectId, row.metricValue] as const),
    );
    for (const row of incoming) bySubject.set(row.subjectId, row.metricValue);
    updateDataset(datasetName, {
      rows: [...bySubject].map(([subjectId, metricValue]) => ({
        metricValue,
        subjectId,
      })),
    });
  }

  async function saveAndPublish(datasetName: SpotlightResultDataset) {
    const dataset = datasets[datasetName];
    const key = `${datasetName}:review-publish`;
    let draftSaved = false;
    setBusyKey(key);
    try {
      const saved = await saveSpotlightResultDraft({
        capturedAt: fromUtcInputValue(dataset.capturedAt),
        coveredThroughRank: dataset.coveredThroughRank,
        dataset: datasetName,
        expectedWorkingSnapshotId: dataset.pointers.workingSnapshotId,
        rows: dataset.rows,
        source: dataset.source,
        sourceReference: dataset.sourceReference.trim() || null,
      });
      if (!saved.ok || !saved.snapshotId) {
        setMessages((current) => ({ ...current, [datasetName]: saved }));
        return;
      }

      const workingSnapshotId = saved.snapshotId;
      draftSaved = true;
      updateDataset(
        datasetName,
        {
          dirty: false,
          pinnedAliases: saved.pinnedAliases ?? [],
          pointers: {
            ...dataset.pointers,
            workingSnapshotId,
          },
        },
        { markDirty: false },
      );

      const published = await publishSpotlightResult({
        activeSnapshotId: dataset.pointers.activeSnapshotId,
        coverageAttested: true,
        dataset: datasetName,
        finalSnapshotId: dataset.pointers.finalSnapshotId,
        workingSnapshotId,
      });
      if (published.ok) {
        updateDataset(
          datasetName,
          {
            activeSnapshot: {
              capturedAt: fromUtcInputValue(dataset.capturedAt),
              coveredThroughRank:
                dataset.coveredThroughRank ?? bracketCount,
              id: workingSnapshotId,
              itemCount: dataset.rows.length,
              source: dataset.source,
              sourceReference: dataset.sourceReference.trim() || null,
            },
            dirty: false,
            pinnedAliases: saved.pinnedAliases ?? [],
            pointers: {
              ...dataset.pointers,
              activeSnapshotId: workingSnapshotId,
              workingSnapshotId,
            },
            publishedRows: [...dataset.rows],
          },
          { markDirty: false },
        );
      }
      setMessages((current) => ({ ...current, [datasetName]: published }));
    } catch {
      setMessages((current) => ({
        ...current,
        [datasetName]: {
          message: draftSaved
            ? "The draft was saved, but publishing did not complete. Review it and try again."
            : "Something went wrong. No changes were made.",
          ok: false,
        },
      }));
    } finally {
      setBusyKey(null);
      setReviewDataset(null);
    }
  }

  function markAliasChangePending(alias: ResultDeskAlias) {
    const affectedDatasets = new Set(
      alias.categories.flatMap((category) => {
        const dataset = RESULT_DATASET_BY_CATEGORY[category];
        return dataset ? [dataset] : [];
      }),
    );
    for (const dataset of affectedDatasets) {
      updateDataset(dataset, {});
    }
  }

  async function runDatasetAction(
    datasetName: SpotlightResultDataset,
    actionName: "finalize" | "save" | "undo",
  ) {
    const key = `${datasetName}:${actionName}`;
    const dataset = datasets[datasetName];
    setBusyKey(key);
    try {
      let result: SpotlightResultActionResult;
      if (actionName === "save") {
        result = await saveSpotlightResultDraft({
          capturedAt: fromUtcInputValue(dataset.capturedAt),
          coveredThroughRank: dataset.coveredThroughRank,
          dataset: datasetName,
          expectedWorkingSnapshotId: dataset.pointers.workingSnapshotId,
          rows: dataset.rows,
          source: dataset.source,
          sourceReference: dataset.sourceReference.trim() || null,
        });
        if (result.ok && result.snapshotId) {
          updateDataset(
            datasetName,
            {
              dirty: false,
              pinnedAliases: result.pinnedAliases ?? [],
              pointers: {
                ...dataset.pointers,
                workingSnapshotId: result.snapshotId,
              },
            },
            { markDirty: false },
          );
        }
      } else {
        const pointerInput = { dataset: datasetName, ...dataset.pointers };
        result =
          actionName === "finalize"
            ? await finalizeSpotlightResult(pointerInput)
            : await undoFinalSpotlightResult(pointerInput);
        if (result.ok) {
          if (actionName === "finalize") {
            updateDataset(
              datasetName,
              {
                pointers: {
                  ...dataset.pointers,
                  finalSnapshotId: dataset.pointers.activeSnapshotId,
                },
              },
              { markDirty: false },
            );
          } else {
            updateDataset(
              datasetName,
              {
                pointers: { ...dataset.pointers, finalSnapshotId: null },
              },
              { markDirty: false },
            );
          }
        }
      }
      setMessages((current) => ({ ...current, [datasetName]: result }));
    } catch {
      setMessages((current) => ({
        ...current,
        [datasetName]: {
          message: "Something went wrong. No changes were made.",
          ok: false,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAlias(alias: ResultDeskAlias) {
    const playerId = aliasPlayerIdByName.get(alias.normalizedCustomPlayerName);
    if (!playerId) return;
    const key = `alias:${alias.normalizedCustomPlayerName}`;
    setBusyKey(key);
    try {
      const result = await saveSpotlightResultAlias({
        customPlayerName: alias.customPlayerName,
        playerId,
      });
      if (result.ok) {
        setSavedAliasPlayerIdByName((current) => {
          const next = new Map(current);
          next.set(alias.normalizedCustomPlayerName, playerId);
          return next;
        });
        markAliasChangePending(alias);
      }
      setMessages((current) => ({ ...current, [key]: result }));
    } catch {
      setMessages((current) => ({
        ...current,
        [key]: {
          message: "Something went wrong. No changes were made.",
          ok: false,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  async function createResultOnlyPlayer(alias: ResultDeskAlias) {
    const key = `alias:${alias.normalizedCustomPlayerName}`;
    setBusyKey(key);
    try {
      const result = await createSpotlightResultOnlyPlayer({
        customPlayerName: alias.customPlayerName,
      });
      if (result.ok && result.playerId) {
        const playerId = result.playerId;
        setAvailablePlayers((current) =>
          current.some((player) => player.id === playerId)
            ? current
            : [
                ...current,
                {
                  active: false,
                  id: playerId,
                  label: `${alias.customPlayerName} — result only`,
                  names: [alias.customPlayerName],
                },
              ],
        );
        setAliasPlayerIdByName((current) => {
          const next = new Map(current);
          next.set(alias.normalizedCustomPlayerName, playerId);
          return next;
        });
        setSavedAliasPlayerIdByName((current) => {
          const next = new Map(current);
          next.set(alias.normalizedCustomPlayerName, playerId);
          return next;
        });
        markAliasChangePending(alias);
      }
      setMessages((current) => ({ ...current, [key]: result }));
    } catch {
      setMessages((current) => ({
        ...current,
        [key]: {
          message: "Something went wrong. No changes were made.",
          ok: false,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  async function createStandaloneResultOnlyPlayer() {
    const displayName = newResultOnlyName.trim();
    if (!displayName) return;
    const key = "standalone-player";
    setBusyKey(key);
    try {
      const result = await createStandaloneSpotlightResultOnlyPlayer({
        displayName,
      });
      if (result.ok && result.playerId) {
        const playerId = result.playerId;
        setAvailablePlayers((current) => [
          ...current,
          {
            active: false,
            id: playerId,
            label: `${displayName} — result only`,
            names: [displayName],
          },
        ]);
        setNewResultOnlyName("");
      }
      setMessages((current) => ({ ...current, [key]: result }));
    } catch {
      setMessages((current) => ({
        ...current,
        [key]: {
          message: "Something went wrong. No changes were made.",
          ok: false,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  function renderControls(datasetName: SpotlightResultDataset) {
    const dataset = datasets[datasetName];
    const finalized = Boolean(dataset.pointers.finalSnapshotId);
    const unchangedActiveDraft =
      !dataset.dirty &&
      dataset.pointers.workingSnapshotId !== null &&
      dataset.pointers.activeSnapshotId === dataset.pointers.workingSnapshotId;
    const reviewBlocked =
      !publishReady ||
      bracketCount < 1 ||
      dataset.coveredThroughRank !== bracketCount ||
      unchangedActiveDraft ||
      finalized;
    const message = messages[datasetName];
    return (
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm font-semibold">
          {message ? (
            <span className={message.ok ? "text-emerald-700" : "text-red-700"}>
              {message.message}
            </span>
          ) : null}
          {dataset.dirty ? (
            <span className="text-amber-700">
              Unsaved changes will be saved before publication.
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            disabled={Boolean(busyKey) || finalized}
            onClick={() => runDatasetAction(datasetName, "save")}
            variant="secondary"
          >
            {busyKey === `${datasetName}:save` ? "Saving…" : "Save draft"}
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={Boolean(busyKey) || reviewBlocked}
            onClick={() => setReviewDataset(datasetName)}
          >
            Review &amp; publish
          </Button>
        </div>
      </div>
    );
  }

  function renderPublishedSnapshot(datasetName: SpotlightResultDataset) {
    const dataset = datasets[datasetName];
    const active = dataset.activeSnapshot;
    const finalized = Boolean(
      active && dataset.pointers.finalSnapshotId === active.id,
    );
    return (
      <section
        aria-label={`${DATASET_LABELS[datasetName]} published snapshot`}
        className="rounded-xl border border-sky-200 bg-sky-50 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-950">
              Published active snapshot
            </h3>
            {active ? (
              <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-700">
                <p>
                  Exact ID: <code className="break-all">{active.id}</code>
                </p>
                <p>
                  {active.source} · {active.itemCount} rows · complete through
                  rank {active.coveredThroughRank}
                </p>
                <p>{new Date(active.capturedAt).toLocaleString()}</p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                No snapshot is public for this dataset.
              </p>
            )}
          </div>
          <Badge
            variant={finalized ? "success" : active ? "warning" : "neutral"}
          >
            {finalized ? "Final" : active ? "Provisional" : "Not published"}
          </Badge>
        </div>
        {active ? (
          <div className="mt-3 flex justify-end">
            {finalized ? (
              <Button
                disabled={Boolean(busyKey)}
                onClick={() => {
                  if (
                    window.confirm(
                      `Undo final status for exact active snapshot ${active.id}? It remains provisionally public.`,
                    )
                  ) {
                    void runDatasetAction(datasetName, "undo");
                  }
                }}
                variant="danger"
              >
                Undo final for {active.id.slice(0, 8)}
              </Button>
            ) : (
              <Button
                disabled={Boolean(busyKey)}
                onClick={() => {
                  if (
                    window.confirm(
                      `Finalize exact active snapshot ${active.id} and block replacement until final status is undone?`,
                    )
                  ) {
                    void runDatasetAction(datasetName, "finalize");
                  }
                }}
                variant="secondary"
              >
                Finalize {active.id.slice(0, 8)}
              </Button>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  const ordinaryDatasets = SPOTLIGHT_RESULT_DATASETS.filter(
    (dataset) => dataset !== "player_ratings",
  );
  const ratings = datasets.player_ratings;
  const pinnedAliasIssueCount = SPOTLIGHT_RESULT_DATASETS.reduce(
    (total, dataset) => total + unresolvedAliasCountForDataset(dataset),
    0,
  );

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-950">Publication gate</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {seasonName} has {bracketCount} submitted bracket
                {bracketCount === 1 ? "" : "s"}. Every published list must be
                complete through exactly rank {bracketCount || "N"}, including
                boundary ties.
              </p>
            </div>
            <Badge
              variant={
                publishReady &&
                bracketCount > 0 &&
                unresolvedLiveAliasCount === 0 &&
                pinnedAliasIssueCount === 0
                  ? "success"
                  : "warning"
              }
            >
              {publishReady
                ? unresolvedLiveAliasCount > 0
                  ? `${unresolvedLiveAliasCount} Other alias${unresolvedLiveAliasCount === 1 ? "" : "es"} pending`
                  : pinnedAliasIssueCount > 0
                    ? "Save alias matches into each affected draft"
                    : bracketCount > 0
                      ? "Publish gate ready"
                      : "Waiting for a bracket"
                : "Reveal and close first"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {ordinaryDatasets.map((datasetName) => {
        const dataset = datasets[datasetName];
        const frozen = Boolean(dataset.pointers.finalSnapshotId);
        const subjects =
          datasetName === "clean_sheets" ? teams : availablePlayers;
        const coverage = evaluateCoverage(dataset.rows, bracketCount);
        return (
          <Card key={datasetName}>
            <CardContent className="grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-black text-slate-950">
                  {DATASET_LABELS[datasetName]}
                </h2>
                <Badge variant={dataset.dirty ? "warning" : "neutral"}>
                  {editorStatusLabel(dataset)}
                </Badge>
              </div>
              <DatasetMetadata
                dataset={dataset}
                disabled={frozen}
                onChange={(patch) => updateDataset(datasetName, patch)}
              />
              <EditableResultTable
                dataset={datasetName}
                direction="descending"
                disabled={frozen}
                onRowsChange={(rows) => updateDataset(datasetName, { rows })}
                rows={dataset.rows}
                subjects={subjects}
                title={DATASET_LABELS[datasetName]}
              />
              <p className="text-xs font-semibold text-slate-600" role="status">
                {coverage.complete
                  ? `Coverage complete through rank ${coverage.coveredThroughRank}.`
                  : `Short by ${coverage.shortfall} row${coverage.shortfall === 1 ? "" : "s"} of rank ${bracketCount}.`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={frozen || !publishReady}
                  onClick={() => seedFromSubmissions(datasetName)}
                  size="sm"
                  variant="secondary"
                >
                  Seed from submissions
                </Button>
              </div>
              <ResultsPastePanel
                datasetLabel={DATASET_LABELS[datasetName]}
                disabled={frozen}
                metricKind="integer"
                onApply={(rows) => applyPastedRows(datasetName, rows)}
                subjects={subjects.map((subject) => ({
                  id: subject.id,
                  names: subject.names,
                }))}
              />
              {renderControls(datasetName)}
              {renderPublishedSnapshot(datasetName)}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Player ratings
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                These two synchronized views edit one shared ratings draft.
              </p>
            </div>
            <Badge variant={ratings.dirty ? "warning" : "neutral"}>
              {editorStatusLabel(ratings)}
            </Badge>
          </div>
          <DatasetMetadata
            dataset={ratings}
            disabled={Boolean(ratings.pointers.finalSnapshotId)}
            onChange={(patch) => updateDataset("player_ratings", patch)}
          />
          <EditableResultTable
            dataset="player_ratings"
            direction="descending"
            disabled={Boolean(ratings.pointers.finalSnapshotId)}
            onRowsChange={(rows) => updateDataset("player_ratings", { rows })}
            rows={ratings.rows}
            subjects={availablePlayers}
            title="Underdog player ratings"
          />
          <EditableResultTable
            dataset="player_ratings"
            direction="ascending"
            disabled={Boolean(ratings.pointers.finalSnapshotId)}
            onRowsChange={(rows) => updateDataset("player_ratings", { rows })}
            rows={ratings.rows}
            subjects={availablePlayers}
            title="Overrated player ratings"
          />
          {(() => {
            const coverage = evaluateCoverage(ratings.rows, bracketCount);
            return (
              <p
                className="text-xs font-semibold text-slate-600"
                role="status"
              >
                {coverage.complete
                  ? `Coverage complete through rank ${coverage.coveredThroughRank}.`
                  : `Short by ${coverage.shortfall} row${coverage.shortfall === 1 ? "" : "s"} of rank ${bracketCount}.`}
              </p>
            );
          })()}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={
                Boolean(ratings.pointers.finalSnapshotId) || !publishReady
              }
              onClick={() => seedFromSubmissions("player_ratings")}
              size="sm"
              variant="secondary"
            >
              Seed from submissions
            </Button>
          </div>
          <ResultsPastePanel
            datasetLabel={DATASET_LABELS.player_ratings}
            disabled={Boolean(ratings.pointers.finalSnapshotId)}
            metricKind="rating"
            onApply={(rows) => applyPastedRows("player_ratings", rows)}
            subjects={availablePlayers.map((subject) => ({
              id: subject.id,
              names: subject.names,
            }))}
          />
          {renderControls("player_ratings")}
          {renderPublishedSnapshot("player_ratings")}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-xl font-black text-slate-950">
            Other-player matches
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Match each submitted spelling to a player from this season. Inactive
            catalogue players remain available for result-only matching.
          </p>
          <div className="mt-4 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-bold text-slate-800">
              New factual result subject
              <span className="text-xs leading-5 font-normal text-slate-600">
                Use when a newly identified player belongs in a factual result
                list but was not in the active prediction catalogue.
              </span>
              <input
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                maxLength={120}
                onChange={(event) => setNewResultOnlyName(event.target.value)}
                placeholder="Player display name"
                value={newResultOnlyName}
              />
            </label>
            <Button
              disabled={Boolean(busyKey) || newResultOnlyName.trim().length < 2}
              onClick={() => createStandaloneResultOnlyPlayer()}
              variant="secondary"
            >
              {busyKey === "standalone-player"
                ? "Creating…"
                : "Add result-only player"}
            </Button>
            {messages["standalone-player"] ? (
              <p
                className={`text-sm font-semibold sm:col-span-2 ${messages["standalone-player"].ok ? "text-emerald-700" : "text-red-700"}`}
                role="status"
              >
                {messages["standalone-player"].message}
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3">
            {aliases.map((alias) => {
              const key = `alias:${alias.normalizedCustomPlayerName}`;
              const message = messages[key];
              return (
                <div
                  className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end"
                  key={alias.normalizedCustomPlayerName}
                >
                  <div>
                    <p className="text-xs font-black tracking-wide text-slate-500 uppercase">
                      Submitted spelling
                    </p>
                    <p className="mt-1 font-bold break-words text-slate-950">
                      {alias.customPlayerName}
                    </p>
                  </div>
                  <SearchablePredictionSelect
                    description="Search active, inactive, and result-only players."
                    emptyMessage="No matching player is available."
                    label="Catalogue match"
                    maximumResults={40}
                    onChange={(value) =>
                      setAliasPlayerIdByName((current) => {
                        const next = new Map(current);
                        next.set(
                          alias.normalizedCustomPlayerName,
                          value && value !== "other" ? value : "",
                        );
                        return next;
                      })
                    }
                    options={availablePlayers.map((player) => ({
                      displayName: `${player.label}${player.active === false ? " (inactive)" : ""}`,
                      id: player.id,
                      searchText: player.label,
                    }))}
                    value={
                      aliasPlayerIdByName.get(
                        alias.normalizedCustomPlayerName,
                      ) || null
                    }
                  />
                  <div className="grid gap-2">
                    <Button
                      disabled={
                        Boolean(busyKey) ||
                        !aliasPlayerIdByName.get(
                          alias.normalizedCustomPlayerName,
                        )
                      }
                      onClick={() => saveAlias(alias)}
                      variant="secondary"
                    >
                      {busyKey === key ? "Saving…" : "Save match"}
                    </Button>
                    <Button
                      disabled={
                        Boolean(busyKey) ||
                        Boolean(
                          savedAliasPlayerIdByName.get(
                            alias.normalizedCustomPlayerName,
                          ),
                        )
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Create “${alias.customPlayerName}” as an inactive result-only player and match this spelling?`,
                          )
                        ) {
                          void createResultOnlyPlayer(alias);
                        }
                      }}
                      variant="ghost"
                    >
                      Create result-only player
                    </Button>
                  </div>
                  {message ? (
                    <p
                      className={`text-sm font-semibold sm:col-start-2 sm:col-end-4 ${message.ok ? "text-emerald-700" : "text-red-700"}`}
                      role="status"
                    >
                      {message.message}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {aliases.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                No Other-player spellings need matching.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {reviewDataset ? (
        <PublishReviewDialog
          attestationSentence={`I attest that ${reviewDataset === "player_ratings" ? "both the highest- and lowest-rated" : "all"} rows through rank ${bracketCount || "N"}, including boundary ties, are present in this exact draft.`}
          boundaryWarnings={[
            ...findBoundaryTieWarnings(
              datasets[reviewDataset].rows,
              bracketCount,
              "descending",
            ),
            ...(reviewDataset === "player_ratings"
              ? findBoundaryTieWarnings(
                  datasets[reviewDataset].rows,
                  bracketCount,
                  "ascending",
                )
              : []),
          ]}
          busy={busyKey === `${reviewDataset}:review-publish`}
          coveredThroughRank={
            evaluateCoverage(datasets[reviewDataset].rows, bracketCount)
              .coveredThroughRank || null
          }
          datasetLabel={DATASET_LABELS[reviewDataset]}
          diff={buildResultDiff({
            direction: "descending",
            draftRows: datasets[reviewDataset].rows,
            labelById: labelBySubjectIdFor(reviewDataset),
            publishedRows: datasets[reviewDataset].publishedRows,
          })}
          onCancel={() => setReviewDataset(null)}
          onConfirm={() => void saveAndPublish(reviewDataset)}
          requiredRank={bracketCount || null}
          unresolvedAliasCount={
            unresolvedLiveAliasCountForDataset(reviewDataset)
          }
        />
      ) : null}
    </div>
  );
}
