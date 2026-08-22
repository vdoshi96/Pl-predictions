"use client";

import { useId, useState } from "react";

import { SubmissionCountdown } from "@/components/submission-countdown";
import { formatChicagoUtcDateTime } from "@/shared/format";

const TIME_ZONES = [
  { label: "Eastern Time", value: "America/New_York" },
  { label: "Central Time", value: "America/Chicago" },
  { label: "Mountain Time", value: "America/Denver" },
  { label: "Pacific Time", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
] as const;

export function formatDeadlineInTimeZone(
  deadlineIso: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(deadlineIso));
}

export function DeadlineTimeZones({
  deadlineIso,
  initialRemainingSeconds,
}: {
  deadlineIso: string;
  initialRemainingSeconds: number;
}) {
  const selectId = useId();
  const [selectedZone, setSelectedZone] = useState("America/Chicago");

  return (
    <div className="grid gap-4">
      <div className="bg-brand rounded-2xl p-4 shadow-sm">
        <SubmissionCountdown
          deadlineIso={deadlineIso}
          initialRemainingSeconds={initialRemainingSeconds}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-border bg-surface-subtle rounded-xl border p-3">
          <span className="text-muted text-xs font-black tracking-wide uppercase">
            Chicago and UTC baseline
          </span>
          <time
            className="text-foreground mt-1 block text-sm font-black"
            dateTime={deadlineIso}
          >
            {formatChicagoUtcDateTime(deadlineIso)}
          </time>
        </div>

        <div>
          <label
            className="text-foreground text-sm font-black"
            htmlFor={selectId}
          >
            View kickoff in another time zone
          </label>
          <select
            className="border-border bg-surface text-foreground focus:border-accent focus:ring-accent/30 mt-1 min-h-12 w-full rounded-xl border px-3 text-base outline-none focus:ring-2"
            id={selectId}
            onChange={(event) => setSelectedZone(event.target.value)}
            value={selectedZone}
          >
            {TIME_ZONES.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
          <time
            aria-live="polite"
            className="text-muted mt-2 block text-sm font-bold"
            dateTime={deadlineIso}
          >
            {formatDeadlineInTimeZone(deadlineIso, selectedZone)}
          </time>
        </div>
      </div>
    </div>
  );
}
