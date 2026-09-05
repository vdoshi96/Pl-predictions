import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  LeaderboardRosterTable,
  ScoredLeaderboardBoard,
} from "@/features/leaderboard/leaderboard-board";
import type {
  LeaderboardRosterEntry,
  ScoredLeaderboardEntry,
} from "@/features/leaderboard/queries";

afterEach(cleanup);

const champion = {
  actualPosition: 1,
  assetPath: "/team-marks/arsenal.png",
  displayName: "Arsenal",
  shortName: "ARS",
};

function scored(
  id: string,
  participantName: string,
  rank: number,
  totalScore: number,
  movement: number | null,
): ScoredLeaderboardEntry {
  return {
    champion,
    correctHalfCount: 4,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    exactCount: 5,
    id,
    movement,
    participantName,
    rank,
    tableScore: totalScore,
    totalScore,
    withinThreeCount: 9,
  };
}

describe("dense leaderboard", () => {
  it("renders shared-rank podium labels and every scored entry in the table", () => {
    render(
      <ScoredLeaderboardBoard
        entries={[
          scored("a", "Maya", 1, 58, null),
          scored("b", "Dev", 2, 55, 1),
          scored("c", "Vishal", 2, 55, -1),
        ]}
      />,
    );

    const podium = screen.getByLabelText("Leaderboard podium");
    const groups = within(podium).getAllByRole("group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAttribute("aria-label", "1st place");
    expect(groups[1]).toHaveAttribute("aria-label", "Joint 2nd place");
    const tied = within(groups[1]).getAllByTestId("podium-entry");
    expect(tied).toHaveLength(2);
    expect(tied[0].className).toBe(tied[1].className);
    expect(tied[0]).toHaveTextContent("Dev");
    expect(tied[1]).toHaveTextContent("Vishal");
    expect(
      within(screen.getByLabelText("Scored leaderboard")).getAllByRole("row"),
    ).toHaveLength(4);
  });

  it("includes every tie at the third occupied rank without promoting rank four", () => {
    render(
      <ScoredLeaderboardBoard
        entries={[
          scored("a", "One", 1, 90, null),
          scored("b", "Two", 2, 80, null),
          ...["Three", "Four", "Five", "Six"].map((name) =>
            scored(name, name, 3, 70, null),
          ),
          scored("z", "Seventh", 7, 60, null),
        ]}
      />,
    );
    const podium = screen.getByLabelText("Leaderboard podium");
    expect(within(podium).getAllByTestId("podium-entry")).toHaveLength(6);
    expect(within(podium).queryByText("Seventh")).not.toBeInTheDocument();
    expect(
      within(
        within(podium).getByRole("group", { name: "Joint 3rd place" }),
      ).getAllByTestId("podium-entry"),
    ).toHaveLength(4);
  });

  it("places all joint leaders on the same tier and skips unoccupied ranks", () => {
    render(
      <ScoredLeaderboardBoard
        entries={["A", "B", "C", "D"].map((name) =>
          scored(name, name, 1, 40, null),
        )}
      />,
    );
    const podium = screen.getByLabelText("Leaderboard podium");
    expect(within(podium).getAllByRole("group")).toHaveLength(1);
    expect(within(podium).getAllByTestId("podium-entry")).toHaveLength(4);
  });

  it("shows movement, score pills, and capped progress semantics", () => {
    render(<ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, 2)]} />);
    const row = screen.getByLabelText("Dev leaderboard entry");

    expect(within(row).getByText("climbed 2 places")).toHaveClass("sr-only");
    expect(within(row).getByText("5 exact")).toBeVisible();
    expect(within(row).getByText("9 within 3")).toBeVisible();
    expect(within(row).getByText("4 half")).toBeVisible();
    const progressbar = within(row).getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "55");
    expect(progressbar).toHaveClass("border", "border-border");
  });

  it("includes the CSS-only 320px stacked-row reflow", () => {
    render(
      <ScoredLeaderboardBoard
        entries={[scored("a", "Long Name", 1, 100, 0)]}
      />,
    );
    const row = screen.getByLabelText("Long Name leaderboard entry");
    expect(row).toHaveClass(
      "max-sm:grid",
      "max-sm:grid-cols-[3rem_minmax(0,1fr)_auto]",
      "max-sm:min-h-24",
    );
    expect(within(row).getByRole("link", { name: "Long Name" })).toHaveClass(
      "min-h-11",
    );
  });

  it("uses the dense table for the private and revealed roster variants", () => {
    const roster: LeaderboardRosterEntry = {
      champion: { ...champion, actualPosition: null },
      createdAt: new Date("2026-08-01T00:00:00Z"),
      id: null,
      participantName: "Maya",
      publicKey: "maya",
      spotlightPicks: null,
      totalScore: 0,
    };
    const { rerender } = render(
      <LeaderboardRosterTable entries={[roster]} predictionsRevealed={false} />,
    );
    expect(
      screen.queryByRole("link", { name: "Maya" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(
      <LeaderboardRosterTable
        entries={[{ ...roster, id: "entry-a" }]}
        predictionsRevealed
      />,
    );
    expect(screen.getByRole("link", { name: "Maya" })).toHaveAttribute(
      "href",
      "/entries/entry-a",
    );
  });
});
