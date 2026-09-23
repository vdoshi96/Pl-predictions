import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  LeaderboardRosterTable,
  ScoredLeaderboardBoard,
} from "@/features/leaderboard/leaderboard-board";
import { LeaderboardExplorer } from "@/features/leaderboard/leaderboard-explorer";
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

function roster(
  participantName: string,
  id: string | null = null,
): LeaderboardRosterEntry {
  return {
    champion: { ...champion, actualPosition: null },
    createdAt: new Date("2026-08-01T00:00:00Z"),
    id,
    participantName,
    publicKey: participantName.toLowerCase(),
    spotlightPicks: null,
    totalScore: 0,
  };
}

describe("podium", () => {
  it("groups by occupied rank and gives tied entries equal styling", () => {
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
    const tied = within(groups[1]!).getAllByTestId("podium-entry");
    expect(tied).toHaveLength(2);
    expect(tied[0]!.className).toBe(tied[1]!.className);
    expect(tied[0]).toHaveTextContent("Dev");
    expect(tied[1]).toHaveTextContent("Vishal");
    expect(within(tied[0]!).getByText("55", { exact: true })).toBeVisible();
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

  it("moves the exact-count and champion line into a detail that mobile can hide", () => {
    render(
      <ScoredLeaderboardBoard entries={[scored("a", "Maya", 1, 58, 0)]} />,
    );
    const person = screen.getByTestId("podium-entry");
    expect(within(person).getByText("5 exact · Arsenal")).toHaveClass(
      "podium-detail",
    );
  });
});

describe("compact leaderboard rows", () => {
  it("keeps every scored entry in the accessible table", () => {
    render(
      <ScoredLeaderboardBoard
        entries={[
          scored("a", "Maya", 1, 58, null),
          scored("b", "Dev", 2, 55, 1),
          scored("c", "Vishal", 2, 55, -1),
        ]}
      />,
    );
    expect(
      within(screen.getByLabelText("Scored leaderboard")).getAllByRole("row"),
    ).toHaveLength(4);
  });

  it("uses a four-column 56px mobile row", () => {
    render(
      <ScoredLeaderboardBoard
        entries={[scored("a", "Long Name", 1, 100, 0)]}
      />,
    );
    const row = screen.getByLabelText("Long Name leaderboard entry");
    expect(row).toHaveClass(
      "max-sm:grid",
      "max-sm:grid-cols-[2.5rem_minmax(0,1fr)_2rem_3rem]",
      "max-sm:min-h-14",
    );
    expect(row.className).not.toContain("max-sm:min-h-24");
    expect(within(row).getByRole("link", { name: "Long Name" })).toHaveClass(
      "min-h-11",
    );
  });

  it("renders the score in brand ink with a screen-reader unit and no progress bar", () => {
    render(<ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, 2)]} />);
    const row = screen.getByLabelText("Dev leaderboard entry");
    const score = within(row).getByText("55", { exact: true });
    expect(score).toHaveClass("text-brand-ink-strong");
    expect(score).not.toHaveClass("text-rose-score");
    expect(within(row).getByText("of 100 table points")).toHaveClass("sr-only");
    expect(within(row).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(row).queryByText("table points")).not.toBeInTheDocument();
  });

  it("shows the scoring breakdown as a proportional bar and a text line on every width", () => {
    render(<ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, 2)]} />);
    const row = screen.getByLabelText("Dev leaderboard entry");
    const bar = within(row).getByRole("img", {
      name: "5 exact, 9 within three places, 4 in the correct half",
    });
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments.map((segment) => segment.style.width)).toEqual([
      "25%",
      "27%",
      "4%",
    ]);
    expect(segments.map((segment) => segment.dataset.tier)).toEqual([
      "exact",
      "within-three",
      "correct-half",
    ]);
    const summary = within(row).getByText("5 exact · 9 within 3 · 4 half");
    expect(summary.closest("td")?.className ?? "").not.toContain("sr-only");
  });

  it("shows the champion crest on mobile and keeps its accessible name", () => {
    render(<ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, 2)]} />);
    const row = screen.getByLabelText("Dev leaderboard entry");
    const champion = within(row).getByLabelText("Predicted champion: Arsenal");
    expect(champion.querySelector("img")).not.toBeNull();
    expect(within(champion).getByText("Arsenal")).toHaveClass("max-sm:sr-only");
  });

  it("drops the initials avatar in favour of the name link", () => {
    render(<ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, 2)]} />);
    const row = screen.getByLabelText("Dev leaderboard entry");
    expect(row.querySelector("span[aria-hidden='true'][style]")).toBeNull();
    expect(
      within(row).queryByText("D", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("explains what movement arrows compare against", () => {
    const { rerender } = render(
      <ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, 2)]} />,
    );
    expect(
      within(screen.getByLabelText("Dev leaderboard entry")).getByText(
        "climbed 2 places",
      ),
    ).toHaveClass("sr-only");
    expect(
      screen.getByText("▲▼ Movement since the previous published table."),
    ).toBeVisible();

    rerender(
      <ScoredLeaderboardBoard entries={[scored("b", "Dev", 2, 55, null)]} />,
    );
    expect(
      screen.queryByText("▲▼ Movement since the previous published table."),
    ).not.toBeInTheDocument();
  });

  it("never uses arbitrary-character wrapping for names", () => {
    const { container } = render(
      <>
        <ScoredLeaderboardBoard
          entries={[scored("b", "Kazorla(grown man)", 2, 55, 2)]}
        />
        <LeaderboardRosterTable
          entries={[roster("Rohan Tejaswi")]}
          predictionsRevealed={false}
        />
      </>,
    );
    expect(container.innerHTML).not.toContain("overflow-wrap:anywhere");
  });
});

describe("roster table", () => {
  it("keeps private and revealed variants, with brand-ink scores", () => {
    const { rerender } = render(
      <LeaderboardRosterTable
        entries={[roster("Maya")]}
        predictionsRevealed={false}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Maya" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("0", { exact: true })).toHaveClass(
      "text-brand-ink-strong",
    );

    rerender(
      <LeaderboardRosterTable
        entries={[roster("Maya", "entry-a")]}
        predictionsRevealed
      />,
    );
    expect(screen.getByRole("link", { name: "Maya" })).toHaveAttribute(
      "href",
      "/entries/entry-a",
    );
  });
});

describe("instant participant filter", () => {
  const entries = [
    scored("a", "Maya", 1, 58, null),
    scored("b", "Dev", 2, 55, null),
    scored("c", "Vishal Doshi", 3, 50, null),
  ];

  it("filters rows as the visitor types and never filters the podium", () => {
    render(
      <LeaderboardExplorer
        initialQuery=""
        predictionsRevealed
        rosterEntries={[]}
        scoredEntries={entries}
      />,
    );

    const input = screen.getByLabelText("Find a participant");
    expect(input).toHaveAttribute("placeholder", "Filter 3 names");
    expect(input).toHaveAttribute("name", "q");
    expect(
      screen.queryByRole("button", { name: "Find" }),
    ).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "dev" } });

    expect(screen.getByLabelText("Dev leaderboard entry")).toBeVisible();
    expect(
      screen.queryByLabelText("Maya leaderboard entry"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Leaderboard podium")).getByText("Maya"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(input).toHaveValue("");
    expect(screen.getByLabelText("Maya leaderboard entry")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("starts from the server query and reports an empty match", () => {
    render(
      <LeaderboardExplorer
        initialQuery="vis"
        predictionsRevealed
        rosterEntries={[]}
        scoredEntries={entries}
      />,
    );
    expect(screen.getByLabelText("Find a participant")).toHaveValue("vis");
    expect(
      screen.getByLabelText("Vishal Doshi leaderboard entry"),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Dev leaderboard entry"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Find a participant"), {
      target: { value: "zzz" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No matching participant. Try a different name.",
    );
  });

  it("filters the roster before scoring starts", () => {
    render(
      <LeaderboardExplorer
        initialQuery=""
        predictionsRevealed={false}
        rosterEntries={[roster("Maya"), roster("Dev")]}
        scoredEntries={null}
      />,
    );
    fireEvent.change(screen.getByLabelText("Find a participant"), {
      target: { value: "ma" },
    });
    expect(screen.getByLabelText("Maya leaderboard entry")).toBeVisible();
    expect(
      screen.queryByLabelText("Dev leaderboard entry"),
    ).not.toBeInTheDocument();
  });
});
