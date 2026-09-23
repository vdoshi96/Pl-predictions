import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import {
  PredictionSorter,
  sortTeamsAlphabetically,
  type PredictionTeam,
} from "@/features/predictions/prediction-sorter";

vi.hoisted(() => {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: MockResizeObserver,
  });
});

afterEach(cleanup);

const teams: PredictionTeam[] = sortTeamsAlphabetically(
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => ({
    assetPath: team.assetPath,
    displayName: team.displayName,
    id: team.slug,
    shortName: team.shortName,
    sortName: team.sortName,
  })),
);

function ControlledSorter({
  disabled = false,
  onChange,
}: {
  disabled?: boolean;
  onChange?: (teams: PredictionTeam[]) => void;
}) {
  const [order, setOrder] = useState(teams);
  return (
    <PredictionSorter
      disabled={disabled}
      onChange={(next) => {
        setOrder(next);
        onChange?.(next);
      }}
      teams={order}
    />
  );
}

function positionOf(name: string): number {
  const list = screen.getByRole("list", {
    name: "Premier League predicted positions",
  });
  const item = within(list)
    .getAllByRole("listitem")
    .find((candidate) =>
      candidate.getAttribute("aria-label")?.startsWith(`${name}, `),
    );
  if (!item) throw new Error(`Missing ${name}`);
  return Number(item.getAttribute("data-position"));
}

describe("tap-a-position move sheet", () => {
  it("moves a club straight to a chosen position", () => {
    const onChange = vi.fn();
    render(<ControlledSorter onChange={onChange} />);
    const tottenhamStart = positionOf("Tottenham Hotspur");

    fireEvent.click(
      screen.getByRole("button", {
        name: `Choose a new position for Tottenham Hotspur, currently ${tottenhamStart} of 20`,
      }),
    );

    const sheet = screen.getByRole("dialog", {
      name: "Move Tottenham Hotspur",
    });
    expect(sheet).toHaveAccessibleDescription(
      `Currently predicted position ${tottenhamStart} of 20.`,
    );
    const choices = within(sheet).getAllByRole("button", {
      name: /^Position \d+$/u,
    });
    expect(choices).toHaveLength(20);
    for (const choice of choices) expect(choice).toHaveClass("min-h-11");
    expect(
      within(sheet).getByRole("button", {
        name: `Position ${tottenhamStart}`,
      }),
    ).toBeDisabled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Position 5" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0][4].id).toBe("tottenham-hotspur");
    expect(positionOf("Tottenham Hotspur")).toBe(5);
    expect(
      screen.queryByRole("dialog", { name: "Move Tottenham Hotspur" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Tottenham Hotspur moved to position 5 of 20."),
    ).toBeInTheDocument();
  });

  it("offers top and bottom shortcuts", () => {
    render(<ControlledSorter />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Choose a new position for Fulham, currently \d+ of 20$/u,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to top" }));
    expect(positionOf("Fulham")).toBe(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose a new position for Fulham, currently 1 of 20",
      }),
    );
    expect(screen.getByRole("button", { name: "Move to top" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move to bottom" }));
    expect(positionOf("Fulham")).toBe(20);
  });

  it("closes without changes from Cancel", () => {
    const onChange = vi.fn();
    render(<ControlledSorter onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /^Choose a new position for Arsenal, currently \d+ of 20$/u,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Move Arsenal" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the 56px drag handle and disables position buttons with the sorter", () => {
    render(<ControlledSorter disabled />);
    expect(
      screen.getByRole("button", { name: /^Move Arsenal, currently/u }),
    ).toHaveClass("size-14");
    for (const button of screen.getAllByRole("button", {
      name: /^Choose a new position for /u,
    })) {
      expect(button).toBeDisabled();
    }
  });
});
