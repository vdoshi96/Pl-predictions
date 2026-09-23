import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildSpotlightCategoryBoard,
  buildSpotlightMatrix,
} from "@/features/leaderboard/spotlight-board";
import {
  SpotlightCategoriesView,
  SpotlightCategoryNav,
  SpotlightMatrixView,
  SpotlightViewNav,
} from "@/features/leaderboard/spotlight-views";
import type { SpotlightAccuracyEntry } from "@/features/leaderboard/queries";

afterEach(cleanup);

const entries: SpotlightAccuracyEntry[] = [
  {
    accuracyRank: 1,
    accuracyScore: 2,
    availableCategoryCount: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    id: "entry-ada",
    participantName: "Ada",
    spotlightPicks: [
      {
        accuracyPoints: 2,
        assetPath: "/player-faces/star.png",
        category: "top_scorer",
        displayName: "Star Striker",
        label: "Top scorer",
        playerId: "player-star",
        resultRank: 1,
        resultStatus: "ranked",
        shortName: null,
        subject: "player",
        teamId: null,
      },
      {
        accuracyPoints: null,
        assetPath: null,
        category: "underdog_player",
        displayName: "Unrated Player",
        label: "Underdog player",
        playerId: "player-unrated",
        resultRank: null,
        shortName: null,
        subject: "player",
        teamId: null,
      },
    ],
  },
  {
    accuracyRank: 2,
    accuracyScore: 0,
    availableCategoryCount: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    id: "entry-ben",
    participantName: "Ben",
    spotlightPicks: [
      {
        accuracyPoints: 0,
        assetPath: null,
        category: "top_scorer",
        displayName: "Outside Pick",
        label: "Top scorer",
        normalizedCustomPlayerName: "outside pick",
        playerId: null,
        resultRank: null,
        resultStatus: "outside-range",
        shortName: null,
        subject: "player",
        teamId: null,
      },
    ],
  },
];

describe("spotlight category board", () => {
  it("renders seven cards with truthful result states and compact rank chips", () => {
    render(
      <SpotlightCategoriesView
        boards={buildSpotlightCategoryBoard(entries)}
        entryCount={2}
        leaders={{
          top_scorer: {
            assetPath: "/player-faces/star.png",
            category: "top_scorer",
            displayName: "Star Striker",
            metricLabel: "14 goals",
            shortName: null,
            subject: "player",
          },
        }}
        liveCategories={["top_scorer"]}
      />,
    );

    const board = screen.getByRole("region", { name: "Spotlight categories" });
    expect(within(board).getAllByRole("heading", { level: 2 })).toHaveLength(7);
    expect(within(board).getAllByText("Result live")).toHaveLength(1);
    expect(within(board).getAllByText("Result pending")).toHaveLength(6);
    expect(within(board).getByText("#1 · 2 pts")).toBeVisible();
    expect(
      within(board).getByText("Result rank 1, 2 accuracy points"),
    ).toHaveClass("sr-only");
    expect(within(board).getByText("Outside range · 0 pts")).toBeVisible();
    expect(within(board).getByText("N/A")).toBeVisible();
    expect(within(board).getByText("Other")).toBeVisible();
  });

  it("folds the leader into one line instead of a separate block", () => {
    render(
      <SpotlightCategoriesView
        boards={buildSpotlightCategoryBoard(entries)}
        entryCount={2}
        leaders={{
          top_scorer: {
            assetPath: "/player-faces/star.png",
            category: "top_scorer",
            displayName: "Star Striker",
            metricLabel: "14 goals",
            shortName: null,
            subject: "player",
          },
        }}
        liveCategories={["top_scorer"]}
      />,
    );

    const leaderLines = screen.getAllByTestId("category-leader");
    expect(leaderLines).toHaveLength(7);
    expect(leaderLines[0]).toHaveTextContent(
      "Current leader Star Striker · 14 goals",
    );
    expect(leaderLines[1]).toHaveTextContent(
      "Current leader Awaiting results publication",
    );
    expect(leaderLines[0]!.querySelector("img")).toBeNull();
    expect(screen.queryByText(/Select to see names/u)).not.toBeInTheDocument();
  });

  it("names a lone picker inline and counts shared picks", () => {
    const sharedPlayerEntries: SpotlightAccuracyEntry[] = [
      entries[0]!,
      { ...entries[0]!, id: "entry-grace", participantName: "Grace Hopper" },
    ];
    const { rerender } = render(
      <SpotlightCategoriesView
        boards={buildSpotlightCategoryBoard(entries)}
        entryCount={2}
        leaders={{}}
        liveCategories={[]}
      />,
    );
    const lone = screen
      .getByText("Outside Pick", { selector: "summary strong > span" })
      .closest("summary")!;
    expect(lone).toHaveTextContent("Ben");
    expect(lone).not.toHaveTextContent("1 of 2");

    rerender(
      <SpotlightCategoriesView
        boards={buildSpotlightCategoryBoard(sharedPlayerEntries)}
        entryCount={2}
        leaders={{}}
        liveCategories={[]}
      />,
    );
    const shared = screen
      .getByText("Star Striker", { selector: "summary strong > span" })
      .closest("summary")!;
    expect(shared).toHaveTextContent("2 of 2");
  });

  it("reveals full predictor names from each category-row disclosure", () => {
    const sharedPlayerEntries: SpotlightAccuracyEntry[] = [
      entries[0]!,
      { ...entries[0]!, id: "entry-grace", participantName: "Grace Hopper" },
    ];

    render(
      <SpotlightCategoriesView
        boards={buildSpotlightCategoryBoard(sharedPlayerEntries)}
        entryCount={2}
        leaders={{}}
        liveCategories={[]}
      />,
    );

    const playerDisclosure = screen
      .getByText("Star Striker", { selector: "summary strong > span" })
      .closest("details");

    expect(playerDisclosure).not.toBeNull();
    expect(playerDisclosure).not.toHaveAttribute("open");
    fireEvent.click(playerDisclosure!.querySelector("summary")!);
    expect(playerDisclosure).toHaveAttribute("open");
    expect(
      within(playerDisclosure!).getByText("Predicted by"),
    ).toBeInTheDocument();
    expect(
      within(playerDisclosure!).getByRole("link", { name: "Ada" }),
    ).toHaveAttribute("href", "/entries/entry-ada");
    expect(
      within(playerDisclosure!).getByRole("link", { name: "Grace Hopper" }),
    ).toHaveAttribute("href", "/entries/entry-grace");
  });

  it("never uses arbitrary-character wrapping", () => {
    const { container } = render(
      <SpotlightCategoriesView
        boards={buildSpotlightCategoryBoard(entries)}
        entryCount={2}
        leaders={{}}
        liveCategories={[]}
      />,
    );
    expect(container.innerHTML).not.toContain("overflow-wrap:anywhere");
  });
});

describe("spotlight navigation", () => {
  it("switches category with one tap through seven links", () => {
    render(<SpotlightCategoryNav selected="underdog_team" />);
    const nav = screen.getByRole("navigation", {
      name: "Choose a spotlight category",
    });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Top scorer",
      "Top assister",
      "Most clean sheets",
      "Underdog team",
      "Overrated team",
      "Underdog player",
      "Overrated player",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/spotlight?category=top_scorer",
      "/spotlight?category=top_assister",
      "/spotlight?category=most_clean_sheets",
      "/spotlight?category=underdog_team",
      "/spotlight?category=overrated_team",
      "/spotlight?category=underdog_player",
      "/spotlight?category=overrated_player",
    ]);
    const current = within(nav).getByRole("link", { name: "Underdog team" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("bg-brand", "dark:ring-1");
    expect(
      links.filter((link) => link.hasAttribute("aria-current")),
    ).toHaveLength(1);
    for (const link of links) expect(link).toHaveClass("min-h-11");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show category" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the three spotlight views with a visible dark-mode active edge", () => {
    render(<SpotlightViewNav selected="matrix" />);
    const nav = screen.getByRole("navigation", { name: "Spotlight views" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Categories", "/spotlight"],
      ["Entries", "/spotlight?view=entries"],
      ["Matrix", "/spotlight?view=matrix"],
    ]);
    const current = within(nav).getByRole("link", { name: "Matrix" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("bg-brand", "dark:ring-1");
  });
});

describe("spotlight matrix", () => {
  it("keeps the desktop table with a sticky entry column", () => {
    render(<SpotlightMatrixView entries={buildSpotlightMatrix(entries)} />);

    const table = screen.getByRole("table", { name: /seven spotlight picks/i });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(9);
    expect(within(table).getByRole("link", { name: "Ada" })).toHaveAttribute(
      "href",
      "/entries/entry-ada",
    );
    expect(within(table).getByText("Rank 1 · 2 pts")).toBeVisible();
    expect(within(table).getByText("Outside range")).toBeVisible();
    expect(within(table).getByText("N/A")).toBeVisible();
    expect(within(table).getAllByRole("rowheader")[0]).toHaveClass(
      "sticky",
      "left-0",
    );
    expect(table.closest(".max-sm\\:hidden")).not.toBeNull();
  });

  it("adds one compact card per entry for narrow screens", () => {
    render(<SpotlightMatrixView entries={buildSpotlightMatrix(entries)} />);

    const cards = screen.getByRole("list", { name: "Picks by entry" });
    expect(cards).toHaveClass("sm:hidden");
    const items = within(cards).getAllByRole("listitem", {
      name: /spotlight picks$/u,
    });
    expect(items).toHaveLength(2);

    const ada = items[0]!;
    expect(ada).toHaveAccessibleName("Ada spotlight picks");
    expect(within(ada).getByRole("link", { name: "Ada" })).toHaveAttribute(
      "href",
      "/entries/entry-ada",
    );
    expect(ada).toHaveTextContent("1 of 7 live · 2 pts");
    const abbreviations = Array.from(ada.querySelectorAll("abbr"));
    expect(abbreviations.map((abbr) => abbr.textContent)).toEqual([
      "TS",
      "TA",
      "CS",
      "UT",
      "OT",
      "UP",
      "OP",
    ]);
    expect(abbreviations[0]).toHaveAttribute("title", "Top scorer");
    expect(
      within(ada).getByText("Top scorer: Star Striker, Rank 1 · 2 pts"),
    ).toHaveClass("sr-only");
    expect(within(ada).getByText("Top assister: no pick")).toHaveClass(
      "sr-only",
    );
    expect(
      within(ada).getByText("Underdog player: Unrated Player, N/A"),
    ).toHaveClass("sr-only");

    expect(
      within(items[1]!).getByText("Top scorer: Outside Pick, Outside range"),
    ).toHaveClass("sr-only");
  });
});
