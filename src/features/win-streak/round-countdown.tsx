"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  normalizeRemainingSeconds,
  splitCountdown,
} from "@/components/submission-countdown";

function unit(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export function formatRoundCountdownLabel(
  totalSeconds: number,
  matchweek: number,
) {
  const parts = splitCountdown(totalSeconds);
  return `${unit(parts.days, "day")}, ${unit(parts.hours, "hour")}, ${unit(parts.minutes, "minute")} until Matchweek ${matchweek} picks lock`;
}

const units = [
  { key: "days", label: "days" },
  { key: "hours", label: "hrs" },
  { key: "minutes", label: "min" },
] as const;

export function RoundCountdown({
  deadlineIso,
  initialRemainingSeconds,
  matchweek,
}: {
  deadlineIso: string;
  initialRemainingSeconds: number;
  matchweek: number;
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
    <time
      aria-label={formatRoundCountdownLabel(remainingSeconds, matchweek)}
      aria-live="off"
      className="flex gap-1.5"
      dateTime={deadlineIso}
      role="timer"
    >
      {units.map((part) => (
        <span
          className="bg-brand grid min-w-11 rounded-lg px-1.5 py-1 text-center text-white"
          key={part.key}
        >
          <strong className="text-base leading-5 font-black tabular-nums">
            {String(parts[part.key]).padStart(2, "0")}
          </strong>
          <span className="text-[0.55rem] leading-3 font-bold text-white/70 uppercase">
            {part.label}
          </span>
        </span>
      ))}
    </time>
  );
}
