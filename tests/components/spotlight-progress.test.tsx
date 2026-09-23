import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpotlightProgress } from "@/features/predictions/spotlight-progress";

afterEach(cleanup);

describe("spotlight progress", () => {
  it("counts complete picks and marks the first incomplete category as next", () => {
    render(
      <SpotlightProgress
        picks={{
          most_clean_sheets: { kind: "team", teamId: "arsenal" },
          top_assister: { customPlayerName: "", kind: "custom-player" },
          top_scorer: {
            displayName: "Erling Haaland",
            kind: "player",
            playerId: "haaland",
          },
        }}
      />,
    );

    const progress = screen.getByRole("group", { name: "Spotlight progress" });
    expect(progress).toHaveTextContent("2 of 7 picked");
    const dots = Array.from(
      progress.querySelectorAll<HTMLElement>("[data-state]"),
    );
    expect(dots.map((dot) => dot.dataset.state)).toEqual([
      "done",
      "next",
      "done",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
    for (const dot of dots) expect(dot).toHaveAttribute("aria-hidden", "true");
  });

  it("reports completion", () => {
    render(
      <SpotlightProgress
        picks={{
          most_clean_sheets: { kind: "team", teamId: "arsenal" },
          overrated_player: {
            customPlayerName: "Some Player",
            kind: "custom-player",
          },
          overrated_team: { kind: "team", teamId: "chelsea" },
          top_assister: {
            customPlayerName: "Another Player",
            kind: "custom-player",
          },
          top_scorer: {
            displayName: "Erling Haaland",
            kind: "player",
            playerId: "haaland",
          },
          underdog_player: {
            customPlayerName: "Third Player",
            kind: "custom-player",
          },
          underdog_team: { kind: "team", teamId: "fulham" },
        }}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Spotlight progress" }),
    ).toHaveTextContent("7 of 7 picked");
  });
});
