import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import {
  ManualStandingsForm,
  type ManualStandingsTeam,
} from "@/features/standings/manual-standings-form";

vi.hoisted(() => {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: MockResizeObserver,
  });
});

const teams: ManualStandingsTeam[] = PREMIER_LEAGUE_2026_27_TEAMS.map(
  (team) => ({
    assetPath: team.assetPath,
    displayName: team.displayName,
    id: team.slug,
    shortName: team.shortName,
    slug: team.slug,
    sortName: team.sortName,
  }),
);

describe("ManualStandingsForm", () => {
  it("recovers from a rejected action with a safe retryable error", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error("DATABASE_URL and private details"));

    render(
      <ManualStandingsForm
        hasActiveSnapshot={false}
        onSubmit={onSubmit}
        teams={teams}
      />,
    );

    const saveButton = screen.getByRole("button", {
      name: "Save provisional standings",
    });
    fireEvent.click(saveButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't save the standings. Check your connection and try again.",
    );
    expect(screen.queryByText(/DATABASE_URL/u)).not.toBeInTheDocument();
    await waitFor(() => expect(saveButton).toBeEnabled());
    expect(saveButton).toHaveTextContent("Save provisional standings");
  });
});
