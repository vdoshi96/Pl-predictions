import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";
import { SeasonTablePage } from "@/features/standings/season-table-page";
import type { SeasonTableView } from "@/features/standings/season-table";

afterEach(cleanup);

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

  it("shows the direction of every nonzero rounded consensus delta", async () => {
    render(
      await SeasonTablePage({
        view: view({
          consensusActive: true,
          rows: [
            {
              actualPosition: 1,
              avgPredicted: 1.1,
              delta: 0.1,
              leaguePoints: 3,
              team,
            },
            {
              actualPosition: 2,
              avgPredicted: 1.9,
              delta: -0.1,
              leaguePoints: 3,
              team: {
                assetPath: "/team-marks/chelsea.png",
                displayName: "Chelsea",
                id: "chelsea",
                shortName: "CHE",
              },
            },
            {
              actualPosition: 3,
              avgPredicted: 3,
              delta: 0,
              leaguePoints: 3,
              team: {
                assetPath: "/team-marks/liverpool.png",
                displayName: "Liverpool",
                id: "liverpool",
                shortName: "LIV",
              },
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

    expect(screen.getByText("▲ 0.1")).toBeVisible();
    expect(screen.getByText("▼ 0.1")).toBeVisible();
    expect(screen.getByText("‒ 0.0")).toBeVisible();
    expect(
      screen.getByText(
        "overachieving by 0.1 places vs the league's average prediction",
      ),
    ).toHaveClass("sr-only");
    expect(
      screen.getByText(
        "underachieving by 0.1 places vs the league's average prediction",
      ),
    ).toHaveClass("sr-only");
  });

  it("maps below and above consensus gaps onto a diverging color scale", async () => {
    const deltas = [-6.6, -2.5, -0.9, 0, 0.9, 2.5, 6.6];
    const bands = ["far", "slight", "near", "neutral", "near", "slight", "far"];

    render(
      await SeasonTablePage({
        view: view({
          consensusActive: true,
          rows: deltas.map((delta, index) => ({
            actualPosition: index + 1,
            avgPredicted: index + 1 + delta,
            delta,
            leaguePoints: 3,
            team: {
              ...team,
              displayName: `Team ${index + 1}`,
              id: `team-${index + 1}`,
            },
          })),
          snapshot: {
            capturedAt: new Date("2026-08-22T12:00:00.000Z"),
            isFinal: false,
            matchweek: 1,
          },
        }),
      }),
    );

    deltas.forEach((delta, index) => {
      const arrow = delta === 0 ? "‒" : delta > 0 ? "▲" : "▼";
      expect(
        screen.getByText(`${arrow} ${Math.abs(delta).toFixed(1)}`)
          .parentElement,
      ).toHaveAttribute("data-band", bands[index]);
    });
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
