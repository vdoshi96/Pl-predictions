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

  it("preserves the seven-pick score calculation and shared ranking", () => {
    render(<LeaderboardDemo />);

    const jordan = screen.getByLabelText("Demo Jordan demo leaderboard entry");
    expect(within(jordan).getByLabelText("Demo rank 1")).toHaveTextContent("1");
    expect(within(jordan).getByText("82 table")).toBeVisible();
    expect(within(jordan).getByText("125 spotlight")).toBeVisible();
    expect(within(jordan).getByText("207")).toBeVisible();
    expect(jordan.querySelectorAll("[data-category]")).toHaveLength(7);

    const alex = screen.getByLabelText("Demo Alex demo leaderboard entry");
    expect(within(alex).getByLabelText("Demo rank 2")).toHaveTextContent("2");
    expect(within(alex).getByText("78 table")).toBeVisible();
    expect(within(alex).getByText("127 spotlight")).toBeVisible();
    expect(within(alex).getByText("205")).toBeVisible();
    expect(alex.querySelectorAll("[data-category]")).toHaveLength(7);
  });
});
