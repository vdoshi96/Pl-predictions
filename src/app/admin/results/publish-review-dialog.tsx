"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BoundaryTieWarning } from "@/features/results/boundary-ties";
import type { ResultDiff } from "@/features/results/dataset-diff";

export type PublishReviewDialogProps = Readonly<{
  attestationSentence: string;
  boundaryWarnings: readonly BoundaryTieWarning[];
  busy: boolean;
  coveredThroughRank: number | null;
  datasetLabel: string;
  diff: ResultDiff;
  onCancel: () => void;
  onConfirm: () => void;
  requiredRank: number | null;
  unresolvedAliasCount: number;
}>;

export function PublishReviewDialog({
  attestationSentence,
  boundaryWarnings,
  busy,
  coveredThroughRank,
  datasetLabel,
  diff,
  onCancel,
  onConfirm,
  requiredRank,
  unresolvedAliasCount,
}: PublishReviewDialogProps) {
  const [attested, setAttested] = useState(false);
  const aliasBlocked = unresolvedAliasCount > 0;

  return (
    <div
      aria-label={`Review and publish ${datasetLabel}`}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
        <h2 className="text-lg font-black text-slate-950">
          Review &amp; publish — {datasetLabel}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Coverage through rank {coveredThroughRank ?? "—"} of required{" "}
          {requiredRank ?? "—"}. {diff.addedCount} added, {diff.changedCount}{" "}
          changed, {diff.removedCount} removed.
        </p>
        {aliasBlocked ? (
          <p
            className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800"
            role="alert"
          >
            {unresolvedAliasCount} Other-player match
            {unresolvedAliasCount === 1 ? "" : "es"} pending. Resolve them below
            the editor first.
          </p>
        ) : null}
        {boundaryWarnings.length > 0 ? (
          <ul className="mt-2 list-disc rounded-xl bg-amber-50 p-3 pl-6 text-sm font-semibold text-amber-900">
            {boundaryWarnings.map((warning) => (
              <li key={`${warning.tiedValue}-${warning.direction}`}>
                Tie at {warning.tiedValue} spans rank {warning.boundaryRank} —{" "}
                confirm every tied player is in the list.
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {diff.entries.map((entry) => (
            <li
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              key={entry.subjectId}
            >
              <span className="font-semibold text-slate-950">
                {entry.label}
              </span>
              <span className="text-xs font-bold tracking-wide uppercase">
                <span
                  className={
                    entry.kind === "removed"
                      ? "text-red-700"
                      : entry.kind === "added"
                        ? "text-emerald-700"
                        : entry.kind === "changed"
                          ? "text-amber-700"
                          : "text-slate-500"
                  }
                >
                  {entry.kind}
                </span>{" "}
                <span className="text-slate-700">
                  {entry.oldMetric ?? "—"} → {entry.newMetric ?? "—"}
                  {entry.oldRank !== null && entry.newRank !== null
                    ? ` (rank ${entry.oldRank} → ${entry.newRank})`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <label className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 font-semibold text-slate-700">
          <input
            checked={attested}
            className="mt-1 size-4 shrink-0 accent-emerald-600"
            onChange={(event) => setAttested(event.target.checked)}
            type="checkbox"
          />
          {attestationSentence}
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button disabled={busy} onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!attested || busy || aliasBlocked}
            onClick={onConfirm}
          >
            Publish provisional
          </Button>
        </div>
      </div>
    </div>
  );
}
