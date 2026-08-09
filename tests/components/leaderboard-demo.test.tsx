import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeaderboardDemo } from "@/features/leaderboard/leaderboard-demo";

afterEach(cleanup);

describe("LeaderboardDemo", () => {
  it("uses snapshot player names and portraits while clearly remaining demo data", () => {
    render(<LeaderboardDemo />);

    expect(screen.getByText("Demo only", { exact: true })).toBeVisible();

    const haalandPortrait = screen.getByRole("img", {
      name: "Erling Haaland player portrait",
    });
    expect(haalandPortrait.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("manchester_city_haaland_erling.png"),
    );

    const alyssonFallback = screen.getByRole("img", {
      name: "Alysson player portrait",
    });
    expect(alyssonFallback.querySelector("svg")).toBeInTheDocument();
    expect(alyssonFallback.querySelector("img")).not.toBeInTheDocument();
  });

  it("uses the active bracket count for a separate accuracy ranking", () => {
    render(<LeaderboardDemo />);

    expect(
      screen.getByText("2 active brackets", { exact: true }),
    ).toBeVisible();
    expect(
      screen.getByText(/seven perfect picks would score 14/i),
    ).toBeVisible();

    const alex = screen.getByLabelText("Demo Alex demo accuracy entry");
    expect(
      within(alex).getByLabelText("Demo accuracy rank 1"),
    ).toHaveTextContent("1");
    expect(within(alex).getByText("6", { exact: true })).toBeVisible();
    expect(
      within(alex).getByText("7 of 7 results available", { exact: true }),
    ).toBeVisible();
    expect(alex.querySelectorAll("[data-category]")).toHaveLength(7);

    const jordan = screen.getByLabelText("Demo Jordan demo accuracy entry");
    expect(
      within(jordan).getByLabelText("Demo accuracy rank 2"),
    ).toHaveTextContent("2");
    expect(within(jordan).getByText("5", { exact: true })).toBeVisible();
    expect(jordan.querySelectorAll("[data-category]")).toHaveLength(7);

    expect(screen.queryByText(/table ·/i)).not.toBeInTheDocument();
  });
});
