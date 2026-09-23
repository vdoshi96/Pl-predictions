import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SeasonTablePage } from "@/features/standings/season-table-page";
import type { SeasonTableView } from "@/features/standings/season-table";

afterEach(cleanup);

const team = {
  assetPath: "/team-marks/arsenal.png",
  displayName: "Arsenal",
  id: "arsenal",
  shortName: "ARS",
};

const snapshot = {
  capturedAt: new Date("2026-08-22T12:00:00.000Z"),
  isFinal: false,
  matchweek: 1,
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

function numberedTeam(index: number) {
  return {
    ...team,
    displayName: `Team ${index}`,
    id: `team-${index}`,
  };
}

describe("season table landing", () => {
  it("keeps the reveal gate ahead of season-table rendering", async () => {
    await expect(
      SeasonTablePage({ view: view({ predictionsRevealed: false }) }),
    ).rejects.toThrow("cannot render before predictions reveal");
  });

  it("renders the waiting state without a standings table or zone legend", async () => {
    render(await SeasonTablePage({ view: view() }));
    expect(
      screen.getByRole("heading", {
        name: "Waiting for the first standings import",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "Premier League season table" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Table zones" }),
    ).not.toBeInTheDocument();
  });

  it("shows one short meta line without the season name or a visible UTC time", async () => {
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
          snapshot,
        }),
      }),
    );

    const updated = screen.getByText("Updated Sat 22 Aug, 7:00 am CDT");
    expect(updated.tagName).toBe("TIME");
    expect(updated).toHaveAttribute("title", "22 Aug 2026, 12:00 UTC");
    expect(screen.queryByText(/UTC/u)).not.toBeInTheDocument();
    expect(
      screen.queryByText("2026/27 Premier League", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Submissions closed · predictions revealed", {
        exact: true,
      }),
    ).toBeVisible();
    expect(screen.getByText("Provisional", { exact: true })).toBeVisible();
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
          snapshot,
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
      screen.queryByRole("columnheader", { name: "Group avg." }),
    ).not.toBeInTheDocument();
  });

  it("labels the zone rails with a legend that uses the same swatches", async () => {
    render(
      await SeasonTablePage({
        view: view({
          rows: [1, 5, 18].map((position) => ({
            actualPosition: position,
            avgPredicted: null,
            delta: null,
            leaguePoints: 3,
            team: numberedTeam(position),
          })),
          snapshot,
        }),
      }),
    );

    const legend = screen.getByRole("list", { name: "Table zones" });
    const items = within(legend).getAllByRole("listitem");
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Champions League",
      "Europa League",
      "Relegation",
    ]);
    expect(items[0]!.querySelector("[aria-hidden='true']")).toHaveClass(
      "bg-accent",
    );
    expect(items[1]!.querySelector("[aria-hidden='true']")).toHaveClass(
      "bg-accent-blue",
    );
    expect(items[2]!.querySelector("[aria-hidden='true']")).toHaveClass(
      "bg-accent-pink",
    );
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
          snapshot,
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "The biggest surprise" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Below expectations" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Group avg." }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "overachieving by 3.2 places vs the league's average prediction",
      ),
    ).toHaveClass("sr-only");
  });

  it("keeps the arrow for every nonzero rounded delta", async () => {
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
              team: numberedTeam(2),
            },
            {
              actualPosition: 3,
              avgPredicted: 3,
              delta: 0,
              leaguePoints: 3,
              team: numberedTeam(3),
            },
          ],
          snapshot,
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

  it("bands gaps as neutral under one place, then slight, clear, and far", async () => {
    const deltas = [-9.4, -6.6, -2.5, -0.9, 0, 0.9, 2.5, 6.6, 9.4];
    const bands = [
      "far",
      "clear",
      "slight",
      "neutral",
      "neutral",
      "neutral",
      "slight",
      "clear",
      "far",
    ];
    const directions = [
      "negative",
      "negative",
      "negative",
      "negative",
      "neutral",
      "positive",
      "positive",
      "positive",
      "positive",
    ];

    render(
      await SeasonTablePage({
        view: view({
          consensusActive: true,
          rows: deltas.map((delta, index) => ({
            actualPosition: index + 1,
            avgPredicted: index + 1 + delta,
            delta,
            leaguePoints: 3,
            team: numberedTeam(index + 1),
          })),
          snapshot,
        }),
      }),
    );

    deltas.forEach((delta, index) => {
      const arrow = delta === 0 ? "‒" : delta > 0 ? "▲" : "▼";
      const chip = screen.getByText(
        `${arrow} ${Math.abs(delta).toFixed(1)}`,
      ).parentElement!;
      expect(chip).toHaveClass("consensus-delta");
      expect(chip).toHaveAttribute("data-band", bands[index]);
      expect(chip).toHaveAttribute("data-direction", directions[index]);
    });
  });

  it("never lets club names break at arbitrary characters", async () => {
    const { container } = render(
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
              team: { ...team, displayName: "Manchester City" },
            },
          ],
          snapshot,
        }),
      }),
    );

    expect(container.innerHTML).not.toContain("overflow-wrap:anywhere");
    expect(
      screen.getAllByText("Manchester City", { exact: false })[0],
    ).toHaveClass("break-words");
  });
});
