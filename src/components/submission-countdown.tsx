"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const countdownUnits = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Mins" },
  { key: "seconds", label: "Secs" },
] as const;

export function normalizeRemainingSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function splitCountdown(totalSeconds: number): CountdownParts {
  const remaining = normalizeRemainingSeconds(totalSeconds);

  return {
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3_600),
    minutes: Math.floor((remaining % 3_600) / 60),
    seconds: remaining % 60,
  };
}

function formatAccessibleCountdown(parts: CountdownParts): string {
  return `${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, and ${parts.seconds} seconds until submissions lock`;
}

export function SubmissionCountdown({
  deadlineIso,
  initialRemainingSeconds,
}: {
  deadlineIso: string;
  initialRemainingSeconds: number;
}) {
  const router = useRouter();
  const initialRemaining = normalizeRemainingSeconds(initialRemainingSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const refreshedAtZero = useRef(false);

  useEffect(() => {
    const startedAt = performance.now();

    function updateCountdown() {
      const elapsedSeconds = Math.floor(
        Math.max(0, performance.now() - startedAt) / 1_000,
      );
      setRemainingSeconds(Math.max(0, initialRemaining - elapsedSeconds));
    }

    updateCountdown();
    const boundaryDelay = 1_000 - (performance.now() % 1_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      updateCountdown();
      intervalId = window.setInterval(updateCountdown, 1_000);
    }, boundaryDelay);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [initialRemaining]);

  useEffect(() => {
    if (
      initialRemaining > 0 &&
      remainingSeconds === 0 &&
      !refreshedAtZero.current
    ) {
      refreshedAtZero.current = true;
      router.refresh();
    }
  }, [initialRemaining, remainingSeconds, router]);

  const parts = useMemo(
    () => splitCountdown(remainingSeconds),
    [remainingSeconds],
  );

  return (
    <div className="mt-3" data-testid="submission-countdown">
      <div className="mb-1.5 flex items-center gap-3">
        <span className="text-[0.68rem] font-black tracking-[0.12em] text-white/75 uppercase">
          Locks in
        </span>
      </div>
      <time
        aria-label={formatAccessibleCountdown(parts)}
        aria-live="off"
        className="grid grid-cols-4 gap-1.5"
        dateTime={deadlineIso}
        role="timer"
      >
        {countdownUnits.map((unit) => (
          <span
            className="countdown-flip min-w-0 rounded-lg px-1 py-1.5 text-center"
            key={unit.key}
          >
            <strong className="relative z-10 block font-mono text-lg leading-6 font-black tracking-[-0.05em] text-white tabular-nums sm:text-xl">
              {String(parts[unit.key]).padStart(2, "0")}
            </strong>
            <span className="relative z-10 block text-[0.55rem] leading-3 font-bold tracking-wide text-white/65 uppercase">
              {unit.label}
            </span>
          </span>
        ))}
      </time>
    </div>
  );
}
