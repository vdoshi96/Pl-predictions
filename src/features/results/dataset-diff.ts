import { rankMetricItems } from "@/features/scoring/categories";

export type ResultDiffKind = "added" | "changed" | "removed" | "same";

export type ResultDiffEntry = Readonly<{
  kind: ResultDiffKind;
  label: string;
  newMetric: number | null;
  newRank: number | null;
  oldMetric: number | null;
  oldRank: number | null;
  subjectId: string;
}>;

export type ResultDiff = Readonly<{
  addedCount: number;
  changedCount: number;
  entries: readonly ResultDiffEntry[];
  removedCount: number;
}>;

type DiffRow = Readonly<{ metricValue: number; subjectId: string }>;

export function buildResultDiff({
  direction,
  draftRows,
  labelById,
  publishedRows,
}: {
  direction: "ascending" | "descending";
  draftRows: readonly DiffRow[];
  labelById: ReadonlyMap<string, string>;
  publishedRows: readonly DiffRow[];
}): ResultDiff {
  const rankedPublished = rankMetricItems(
    publishedRows.map((row) => ({
      id: row.subjectId,
      metric: row.metricValue,
    })),
    direction,
  );
  const rankedDraft = rankMetricItems(
    draftRows.map((row) => ({
      id: row.subjectId,
      metric: row.metricValue,
    })),
    direction,
  );
  const oldById = new Map(
    rankedPublished.map((item) => [item.id, item] as const),
  );
  const newIds = new Set(rankedDraft.map((item) => item.id));

  let addedCount = 0;
  let changedCount = 0;
  let removedCount = 0;
  const entries: ResultDiffEntry[] = [];

  for (const draft of rankedDraft) {
    const old = oldById.get(draft.id) ?? null;
    const kind: ResultDiffKind = !old
      ? "added"
      : old.metric !== draft.metric
        ? "changed"
        : "same";
    if (kind === "added") addedCount += 1;
    if (kind === "changed") changedCount += 1;
    entries.push({
      kind,
      label: labelById.get(draft.id) ?? draft.id,
      newMetric: draft.metric,
      newRank: draft.rank,
      oldMetric: old?.metric ?? null,
      oldRank: old?.rank ?? null,
      subjectId: draft.id,
    });
  }
  for (const published of rankedPublished) {
    if (newIds.has(published.id)) continue;
    removedCount += 1;
    entries.push({
      kind: "removed",
      label: labelById.get(published.id) ?? published.id,
      newMetric: null,
      newRank: null,
      oldMetric: published.metric,
      oldRank: published.rank,
      subjectId: published.id,
    });
  }

  const order = { added: 0, changed: 1, removed: 2, same: 3 } as const;
  entries.sort(
    (left, right) =>
      order[left.kind] - order[right.kind] ||
      (left.newRank ?? left.oldRank ?? Number.MAX_SAFE_INTEGER) -
        (right.newRank ?? right.oldRank ?? Number.MAX_SAFE_INTEGER),
  );
  return { addedCount, changedCount, entries, removedCount };
}
