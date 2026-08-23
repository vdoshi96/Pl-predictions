import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/win-streak/actions", () => ({
  INITIAL_WIN_STREAK_RESULT_ACTION_STATE: { message: "", ok: false },
  resolveWinStreakRoundAction: vi.fn(async () => ({
    message: "Matchweek 2 results are locked.",
    ok: true,
  })),
}));

import { WinStreakResultsDesk } from "@/app/admin/win-streak/results-desk";

afterEach(cleanup);

const fixtures = Array.from({ length: 10 }, (_, index) => ({
  awayTeam: {
    assetPath: `/team-marks/away-${index}.png`,
    displayName: `Away ${index + 1}`,
    shortName: `Away ${index + 1}`,
  },
  homeTeam: {
    assetPath: `/team-marks/home-${index}.png`,
    displayName: `Home ${index + 1}`,
    shortName: `Home ${index + 1}`,
  },
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  kickoffAt: `2026-08-${String(index + 21).padStart(2, "0")}T19:00:00.000Z`,
}));

describe("Win Streak results desk", () => {
  it("renders ten complete result groups, provenance fields, and the Void warning", () => {
    render(
      <WinStreakResultsDesk
        canResolve
        defaultCapturedAt="2026-08-31T22:00:00.000Z"
        fixtures={fixtures}
        matchweek={2}
        roundId="00000000-0000-4000-8000-000000000011"
      />,
    );

    expect(screen.getAllByRole("group")).toHaveLength(10);
    expect(
      screen.getByRole("group", { name: "Home 1 against Away 1 result" }),
    ).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(40);
    expect(screen.getAllByRole("img")).toHaveLength(20);
    expect(screen.getByLabelText("Source URL")).toHaveAttribute("type", "url");
    expect(screen.getByLabelText("Captured at (UTC)")).toBeRequired();
    expect(screen.getByText(/Void requires owner review/u)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Lock Matchweek 2 results" }),
    ).toBeEnabled();
  });

  it("keeps result controls unavailable until the round deadline passes", () => {
    render(
      <WinStreakResultsDesk
        canResolve={false}
        defaultCapturedAt="2026-08-28T18:00:00.000Z"
        fixtures={fixtures}
        matchweek={2}
        roundId="00000000-0000-4000-8000-000000000011"
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
    expect(
      screen.getByRole("button", { name: "Waiting for every kickoff" }),
    ).toBeDisabled();
  });
});
