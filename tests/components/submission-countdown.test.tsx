import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeRemainingSeconds,
  splitCountdown,
  SubmissionCountdown,
} from "@/components/submission-countdown";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SubmissionCountdown", () => {
  it("normalizes invalid values and splits a remaining duration", () => {
    expect(normalizeRemainingSeconds(-3)).toBe(0);
    expect(normalizeRemainingSeconds(Number.NaN)).toBe(0);
    expect(normalizeRemainingSeconds(90_061.9)).toBe(90_061);
    expect(splitCountdown(90_061)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
    });
  });

  it("renders zero-padded calendar-flip units from the database-derived duration", () => {
    render(
      <SubmissionCountdown
        deadlineIso="2026-08-21T19:00:00.000Z"
        initialRemainingSeconds={90_061}
      />,
    );

    const timer = screen.getByRole("timer");
    expect(timer).toHaveAttribute(
      "aria-label",
      "1 days, 1 hours, 1 minutes, and 1 seconds until submissions lock",
    );
    expect(screen.getAllByText("01", { exact: true })).toHaveLength(4);
    expect(timer.querySelectorAll(".countdown-flip")).toHaveLength(4);
  });

  it("counts down with elapsed monotonic time and refreshes once at zero", () => {
    render(
      <SubmissionCountdown
        deadlineIso="2026-08-21T19:00:00.000Z"
        initialRemainingSeconds={2}
      />,
    );

    expect(screen.getByRole("timer")).toHaveAccessibleName(
      /2 seconds until submissions lock$/u,
    );

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("timer")).toHaveAccessibleName(
      /1 seconds until submissions lock$/u,
    );
    expect(mocks.refresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("timer")).toHaveAccessibleName(
      /0 seconds until submissions lock$/u,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(2_000));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
