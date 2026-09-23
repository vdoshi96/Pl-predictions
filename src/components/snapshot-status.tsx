"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";

export const PROVISIONAL_EXPLANATION =
  "Provisional tables change as matchweeks are played. The owner marks the table Final after the last matchweek.";

export function SnapshotStatus({ isFinal }: { isFinal: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (isFinal) return <Badge variant="success">Final</Badge>;

  return (
    <span className="relative inline-flex items-center">
      <Badge variant="warning">Provisional</Badge>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label="What does Provisional mean?"
        className="text-muted hover:text-brand-ink focus-visible:ring-accent-blue inline-grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <span
          className="border-border bg-surface text-foreground absolute top-full right-0 z-30 mt-1 w-64 rounded-xl border p-3 text-xs leading-5 shadow-lg"
          id={panelId}
          role="note"
        >
          {PROVISIONAL_EXPLANATION}
        </span>
      ) : null}
    </span>
  );
}
