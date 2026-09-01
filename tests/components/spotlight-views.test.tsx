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
  SpotlightMatrixView,
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

describe("spotlight category and matrix views", () => {
  it("renders seven taxonomy-ordered category cards with truthful result states", () => {
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
    expect(within(board).getByText("Result rank 1 · 2 pts")).toBeVisible();
    expect(within(board).getByText("Outside range · 0 pts")).toBeVisible();
    expect(within(board).getByText("N/A")).toBeVisible();
    expect(within(board).getByText("Other")).toBeVisible();
  });

  it("reveals full predictor names from each category-row disclosure", () => {
    const sharedPlayerEntries: SpotlightAccuracyEntry[] = [
      entries[0]!,
      {
        ...entries[0]!,
        id: "entry-grace",
        participantName: "Grace Hopper",
      },
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

  it("renders the taxonomy matrix with a sticky entry column and pending-safe cells", () => {
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
  });
});
