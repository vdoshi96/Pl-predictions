import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";
import { SeasonTablePage } from "@/features/standings/season-table-page";
import type { SeasonTableView } from "@/features/standings/season-table";

const team = {
  assetPath: "/team-marks/arsenal.png",
  displayName: "Arsenal",
  id: "arsenal",
  shortName: "ARS",
};

function view(overrides: Partial<SeasonTableView> = {}): SeasonTableView {
  return {
    callouts: { overachiever: null, underachiever: null },
    consensusActive: false,
    entryCount: 1,
    predictionsRevealed: true,
    rows: null,
    seasonName: "2026/27 Premier League",
    snapshot: null,
    ...overrides,
  };
}

describe("season table landing", () => {
  it("keeps the reveal gate ahead of season-table rendering", async () => {
    await expect(
      SeasonTablePage({ view: view({ predictionsRevealed: false }) }),
    ).rejects.toThrow("cannot render before predictions reveal");
  });

  it("renders the waiting state without a standings table", async () => {
    render(await SeasonTablePage({ view: view() }));
    expect(
      screen.getByRole("heading", {
        name: "Waiting for the first standings import",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "Premier League season table" }),
    ).not.toBeInTheDocument();
  });

  it("shows real rows but withholds consensus until scoring is active", async () => {
    render(
      await SeasonTablePage({
        view: view({
          rows: [
            {
              actualPosition: 1,
              avgPredicted: null,
              delta: null,
              leaguePoints: 10,
              team,
            },
          ],
          snapshot: {
            capturedAt: new Date("2026-08-22T12:00:00.000Z"),
            isFinal: false,
            matchweek: 1,
          },
        }),
      }),
    );
    expect(screen.getByRole("cell", { name: "Arsenal" })).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Consensus comparison is waiting for a meaningful table",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "League said" }),
    ).not.toBeInTheDocument();
  });

  it("renders callouts and consensus deltas in the full state", async () => {
    render(
      await SeasonTablePage({
        view: view({
          callouts: {
            overachiever: { actualPosition: 1, avgPredicted: 4.2, team },
            underachiever: { actualPosition: 1, avgPredicted: 4.2, team },
          },
          consensusActive: true,
          rows: [
            {
              actualPosition: 1,
              avgPredicted: 4.2,
              delta: 3.2,
              leaguePoints: 10,
              team,
            },
          ],
          snapshot: {
            capturedAt: new Date("2026-08-22T12:00:00.000Z"),
            isFinal: false,
            matchweek: 1,
          },
        }),
      }),
    );
    expect(screen.getByText("Overachiever")).toBeVisible();
    expect(screen.getByText("Underachiever")).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "League said" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "overachieving by 3.2 places vs the league's average prediction",
      ),
    ).toHaveClass("sr-only");
  });

  it("uses Home for the root navigation item", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("link", { name: "Predict" }),
    ).not.toBeInTheDocument();
  });
});
