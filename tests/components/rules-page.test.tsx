import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import RulesPage from "@/app/rules/page";
import { RULES_PENDING_RESULTS_MESSAGE } from "@/content/public-copy";

beforeEach(() => {
  window.history.replaceState(null, "", "/rules");
});

afterEach(cleanup);

function tabs() {
  const tablist = screen.getByRole("tablist", { name: "Rules sections" });
  return {
    spotlight: within(tablist).getByRole("tab", { name: "Spotlight" }),
    table: within(tablist).getByRole("tab", { name: "Table" }),
    tablist,
    winStreak: within(tablist).getByRole("tab", { name: "Win Streak" }),
  };
}

describe("rules page", () => {
  it("keeps the page title and opens on the Table section", () => {
    render(<RulesPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "The rules, without the guesswork.",
      }),
    ).toBeVisible();
    const { spotlight, table, winStreak } = tabs();
    expect(table).toHaveAttribute("aria-selected", "true");
    expect(spotlight).toHaveAttribute("aria-selected", "false");
    expect(winStreak).toHaveAttribute("aria-selected", "false");

    const tablePanel = screen.getByRole("tabpanel", { name: "Table" });
    expect(tablePanel).toBeVisible();
    expect(
      within(tablePanel).getByRole("heading", { name: "League-table points" }),
    ).toBeVisible();
    expect(within(tablePanel).getByText("How you enter")).toBeVisible();
    expect(document.getElementById("spotlight-scoring")).toHaveAttribute(
      "hidden",
    );
  });

  it("switches sections by click and keeps the spotlight anchor", () => {
    render(<RulesPage />);
    fireEvent.click(tabs().spotlight);

    expect(tabs().spotlight).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "Spotlight" });
    expect(panel).toHaveAttribute("id", "spotlight-scoring");
    expect(panel).toBeVisible();
    expect(
      within(panel).getByRole("heading", {
        name: "Pick seven outcomes. Closer calls score more.",
      }),
    ).toBeVisible();
    expect(panel).toHaveTextContent(
      "With 14 entries, 1st earns 14 points, 2nd earns 13, and so on down to 0.",
    );
    expect(panel).toHaveTextContent(RULES_PENDING_RESULTS_MESSAGE);
    expect(within(panel).getByText("Can’t find a player?")).toBeVisible();
  });

  it("supports arrow, Home, and End keys between tabs", () => {
    render(<RulesPage />);
    const { table } = tabs();
    table.focus();

    fireEvent.keyDown(table, { key: "ArrowRight" });
    expect(tabs().spotlight).toHaveFocus();
    expect(tabs().spotlight).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs().spotlight, { key: "End" });
    expect(tabs().winStreak).toHaveFocus();
    expect(tabs().winStreak).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs().winStreak, { key: "ArrowRight" });
    expect(tabs().table).toHaveFocus();

    fireEvent.keyDown(tabs().table, { key: "ArrowLeft" });
    expect(tabs().winStreak).toHaveFocus();

    fireEvent.keyDown(tabs().winStreak, { key: "Home" });
    expect(tabs().table).toHaveFocus();
    expect(tabs().table).toHaveAttribute("aria-selected", "true");
  });

  it("opens the Spotlight section from an existing #spotlight-scoring link", () => {
    window.history.replaceState(null, "", "/rules#spotlight-scoring");
    render(<RulesPage />);
    expect(tabs().spotlight).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Spotlight" })).toBeVisible();
  });

  it("explains Win Streak as three outcomes with a way to play", () => {
    render(<RulesPage />);
    fireEvent.click(tabs().winStreak);
    const panel = screen.getByRole("tabpanel", { name: "Win Streak" });
    const outcomes = within(panel).getByRole("list", {
      name: "How a round scores",
    });
    expect(
      within(outcomes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Win → +1, club used", "Draw or loss → reset", "Missed → held"]);
    expect(
      within(panel).getByRole("link", { name: "Play Win Streak" }),
    ).toHaveAttribute("href", "/win-streak");
  });

  it("keeps operator and implementation language off the public page", () => {
    const { container } = render(<RulesPage />);
    const text = container.textContent ?? "";
    for (const forbidden of [
      /max\(0/iu,
      /N \+ 1/u,
      /\b578\b/u,
      /\b580\b/u,
      /snapshot/iu,
      /canonical/iu,
      /internally reconciled/iu,
      /Current data status/iu,
      /derived on read/iu,
      /bracket/iu,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });
});
