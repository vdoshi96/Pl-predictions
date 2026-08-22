"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  parsePastedResultList,
  type PasteSubject,
} from "@/features/results/list-paste-parser";

export type ResultsPastePanelProps = Readonly<{
  datasetLabel: string;
  disabled: boolean;
  metricKind: "integer" | "rating";
  onApply: (
    rows: readonly { metricValue: number; subjectId: string }[],
  ) => void;
  subjects: readonly PasteSubject[];
}>;

export function ResultsPastePanel({
  datasetLabel,
  disabled,
  metricKind,
  onApply,
  subjects,
}: ResultsPastePanelProps) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<
    typeof parsePastedResultList
  > | null>(null);

  const matched = useMemo(
    () =>
      (parsed ?? []).flatMap((row) =>
        row.subjectId && row.metricValue !== null
          ? [{ metricValue: row.metricValue, subjectId: row.subjectId }]
          : [],
      ),
    [parsed],
  );
  const problemRows = (parsed ?? []).filter((row) => row.status !== "matched");

  return (
    <section
      aria-label={`Paste ${datasetLabel} list`}
      className="border-border grid gap-2 rounded-xl border p-3"
    >
      <label className="text-foreground grid gap-1 text-sm font-bold">
        Paste {datasetLabel.toLowerCase()} list
        <textarea
          className="border-border bg-surface focus:border-accent focus:ring-accent/30 disabled:bg-surface-subtle min-h-24 w-full rounded-xl border p-2 font-mono text-xs outline-none focus:ring-2"
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value);
            setParsed(null);
          }}
          placeholder={"Haaland 27\nSalah 18"}
          rows={4}
          value={text}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || text.trim().length === 0}
          onClick={() =>
            setParsed(parsePastedResultList({ metricKind, subjects, text }))
          }
          size="sm"
          variant="secondary"
        >
          Parse list
        </Button>
        <Button
          disabled={disabled || matched.length === 0}
          onClick={() => {
            onApply(matched);
            setText("");
            setParsed(null);
          }}
          size="sm"
        >
          Apply {matched.length || ""} row{matched.length === 1 ? "" : "s"}
        </Button>
        {problemRows.length > 0 ? (
          <span className="text-warning text-xs font-semibold">
            {problemRows.length} line{problemRows.length === 1 ? "" : "s"}{" "}
            {problemRows.length === 1 ? "needs" : "need"} attention below.
          </span>
        ) : null}
      </div>
      {problemRows.length > 0 ? (
        <ul className="bg-warning-soft text-warning list-disc rounded-xl p-2 pl-6 text-xs font-semibold">
          {problemRows.map((row) => (
            <li key={row.rawLine}>
              “{row.rawLine}” —{" "}
              {row.status === "ambiguous"
                ? `ambiguous: ${row.candidateLabels.join(", ")}`
                : row.status === "no-match"
                  ? "no matching player; add them via Other-player matches"
                  : "missing or invalid number"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
