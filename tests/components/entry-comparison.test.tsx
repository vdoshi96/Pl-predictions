import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EntryComparePicker } from "@/features/entries/entry-compare-picker";
import {
  EntryComparisonTable,
  summarizeEntryTiers,
} from "@/features/entries/entry-comparison-table";
import { EntryPager } from "@/features/entries/entry-pager";
import { findAdjacentEntries } from "@/features/entries/navigation";
import type { EntryComparisonItem } from "@/features/entries/queries";

afterEach(cleanup);

function item(
  predictedPosition: number,
  teamId: string,
  displayName: string,
  actualPosition: number | null,
  tier: EntryComparisonItem["tier"],
  points: EntryComparisonItem["points"],
): EntryComparisonItem {
  return {
    actualPosition,
    assetPath: `/team-marks/${teamId}.png`,
    difference:
      actualPosition === null
        ? null
        : Math.abs(predictedPosition - actualPosition),
    displayName,
    points,
    predictedPosition,
    shortName: displayName.slice(0, 3).toUpperCase(),
    teamId,
    tier,
  };
}

const scoredItems = [
  item(1, "arsenal", "Arsenal", 2, "within-three", 3),
  item(2, "manchester-united", "Manchester United", 12, "miss", 0),
  item(3, "manchester-city", "Manchester City", 3, "exact", 5),
  item(4, "chelsea", "Chelsea", 10, "correct-half", 1),
];

const unscoredItems = scoredItems.map((scoredItem) => ({
  ...scoredItem,
  actualPosition: null,
  difference: null,
  points: null,
  tier: null,
}));

describe("summarizeEntryTiers", () => {
  it("counts each tier and reports whether scoring has started", () => {
    expect(summarizeEntryTiers(scoredItems)).toEqual({
      correctHalf: 1,
      exact: 1,
      miss: 1,
      scored: true,
      withinThree: 1,
    });
    expect(summarizeEntryTiers(unscoredItems)).toEqual({
      correctHalf: 0,
      exact: 0,
      miss: 0,
      scored: false,
      withinThree: 0,
    });
  });
});

describe("entry comparison table", () => {
  it("leads with the score, a proportional breakdown, and filter chips", () => {
    render(
      <EntryComparisonTable
        compare={null}
        items={scoredItems}
        participantName="Ada"
        totalScore={9}
      />,
    );

    const summary = screen.getByRole("region", { name: "Score summary" });
    expect(within(summary).getByText("9", { exact: true })).toBeVisible();
    expect(within(summary).getByText("/ 100 table points")).toBeVisible();
    const bar = within(summary).getByRole("img", {
      name: "1 exact, 1 within three places, 1 in the correct half, 1 missed",
    });
    expect(
      (Array.from(bar.children) as HTMLElement[]).map(
        (segment) => segment.style.width,
      ),
    ).toEqual(["5%", "3%", "1%"]);

    const filters = screen.getByRole("group", { name: "Filter clubs" });
    expect(
      within(filters)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All 4", "Exact · 1", "Within 3 · 1", "Half · 1", "Missed · 1"]);
    expect(
      within(filters).getByRole("button", { name: "All 4" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("filters the list to one scoring tier and back", () => {
    render(
      <EntryComparisonTable
        compare={null}
        items={scoredItems}
        participantName="Ada"
        totalScore={9}
      />,
    );
    const list = screen.getByRole("list", { name: "Ada's predicted table" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Missed · 1" }));

    expect(screen.getByRole("button", { name: "Missed · 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const missed = within(list).getAllByRole("listitem");
    expect(missed).toHaveLength(1);
    expect(missed[0]).toHaveTextContent("Manchester United");

    fireEvent.click(screen.getByRole("button", { name: "All 4" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("labels each value once and uses the shared score scale", () => {
    render(
      <EntryComparisonTable
        compare={null}
        items={scoredItems}
        participantName="Ada"
        totalScore={9}
      />,
    );
    const rows = within(
      screen.getByRole("list", { name: "Ada's predicted table" }),
    ).getAllByRole("listitem");

    expect(rows[0]).toHaveTextContent("Actual position 2");
    expect(rows[0]).toHaveTextContent("Places off 1");
    expect(within(rows[0]!).getByLabelText("Predicted 1st")).toHaveTextContent(
      "1",
    );
    expect(rows[0]).not.toHaveTextContent("ACTUAL");
    expect(rows[0]).not.toHaveTextContent("DIFFERENCE");

    const exact = screen.getByText("5 · Exact");
    expect(exact).toHaveClass("score-pill");
    expect(exact).toHaveAttribute("data-tier", "exact");
    const half = screen.getByText("1 · Correct half");
    expect(half).toHaveAttribute("data-tier", "correct-half");
    expect(half.className).not.toContain("rose");
    expect(screen.getByText("0 · No points")).toHaveAttribute(
      "data-tier",
      "miss",
    );
  });

  it("adds a comparison column for another revealed entry", () => {
    render(
      <EntryComparisonTable
        compare={{
          participantName: "Ben",
          positions: { arsenal: 3, "manchester-city": 1 },
        }}
        items={scoredItems}
        participantName="Ada"
        totalScore={9}
      />,
    );
    const rows = within(
      screen.getByRole("list", { name: "Ada's predicted table" }),
    ).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ben predicted 3");
    expect(rows[1]).toHaveTextContent("Ben predicted —");
    expect(rows[2]).toHaveTextContent("Ben predicted 1");
  });

  it("stays a plain list with Not scored before scoring starts", () => {
    render(
      <EntryComparisonTable
        compare={null}
        items={unscoredItems}
        participantName="Ada"
        totalScore={null}
      />,
    );
    expect(
      screen.queryByRole("region", { name: "Score summary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Filter clubs" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Not scored")).toHaveLength(4);
  });

  it("never uses arbitrary-character wrapping", () => {
    const { container } = render(
      <EntryComparisonTable
        compare={null}
        items={scoredItems}
        participantName="Ada"
        totalScore={9}
      />,
    );
    expect(container.innerHTML).not.toContain("overflow-wrap:anywhere");
  });
});

describe("entry navigation", () => {
  const ordered = [
    { id: "a", participantName: "Ann" },
    { id: "b", participantName: "Bo" },
    { id: "c", participantName: "Cy" },
  ];

  it("finds neighbours in leaderboard order", () => {
    expect(findAdjacentEntries(ordered, "b")).toEqual({
      next: { id: "c", participantName: "Cy" },
      position: 2,
      previous: { id: "a", participantName: "Ann" },
      total: 3,
    });
    expect(findAdjacentEntries(ordered, "a")?.previous).toBeNull();
    expect(findAdjacentEntries(ordered, "c")?.next).toBeNull();
    expect(findAdjacentEntries(ordered, "missing")).toBeNull();
  });

  it("renders previous and next links with the position", () => {
    render(<EntryPager navigation={findAdjacentEntries(ordered, "b")!} />);
    const nav = screen.getByRole("navigation", { name: "Entry navigation" });
    expect(
      within(nav).getByRole("link", { name: "Previous entry: Ann" }),
    ).toHaveAttribute("href", "/entries/a");
    expect(
      within(nav).getByRole("link", { name: "Next entry: Cy" }),
    ).toHaveAttribute("href", "/entries/c");
    expect(within(nav).getByText("2 of 3")).toBeVisible();
  });

  it("omits the missing neighbour at either end", () => {
    render(<EntryPager navigation={findAdjacentEntries(ordered, "a")!} />);
    expect(
      screen.queryByRole("link", { name: /Previous entry/u }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next entry: Bo" })).toBeVisible();
  });

  it("offers one-tap comparison links and a way to stop comparing", () => {
    const { rerender } = render(
      <EntryComparePicker
        activeCompareId={null}
        entryId="b"
        others={[ordered[0]!, ordered[2]!]}
      />,
    );
    expect(screen.getByText("Compare with…").tagName).toBe("SUMMARY");
    expect(screen.getByRole("link", { name: "Ann" })).toHaveAttribute(
      "href",
      "/entries/b?compare=a",
    );
    expect(
      screen.queryByRole("link", { name: "Stop comparing" }),
    ).not.toBeInTheDocument();

    rerender(
      <EntryComparePicker
        activeCompareId="a"
        entryId="b"
        others={[ordered[0]!, ordered[2]!]}
      />,
    );
    expect(screen.getByRole("link", { name: "Ann" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("link", { name: "Stop comparing" }),
    ).toHaveAttribute("href", "/entries/b");
  });
});
