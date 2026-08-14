"use client";

import { useId, useState } from "react";

import { SubmissionCountdown } from "@/components/submission-countdown";

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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-black tracking-wide text-slate-500 uppercase">
            Central Time baseline
          </span>
          <time
            className="mt-1 block text-sm font-black text-slate-950"
            dateTime={deadlineIso}
          >
            {formatDeadlineInTimeZone(deadlineIso, "America/Chicago")}
          </time>
        </div>

        <div>
          <label
            className="text-sm font-black text-slate-950"
            htmlFor={selectId}
          >
            View kickoff in another time zone
          </label>
          <select
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
            className="mt-2 block text-sm font-bold text-slate-700"
            dateTime={deadlineIso}
          >
            {formatDeadlineInTimeZone(deadlineIso, selectedZone)}
          </time>
        </div>
      </div>
    </div>
  );
}
