import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchablePredictionSelect } from "@/features/predictions/searchable-prediction-select";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const playerOptions = Array.from({ length: 25 }, (_, index) => ({
  displayName: `Player ${String(index + 1).padStart(2, "0")}`,
  id: `player-${index + 1}`,
  searchText: `Player ${String(index + 1).padStart(2, "0")}`,
}));

describe("SearchablePredictionSelect result limits", () => {
  it("waits for two characters, caps rendered matches, and keeps Other available", () => {
    const onExpandedChange = vi.fn();
    render(
      <SearchablePredictionSelect
        allowOther
        description="Choose a player"
        emptyMessage="No matching player."
        label="Top scorer"
        maximumResults={20}
        minimumQueryLength={2}
        minimumQueryMessage="Type at least 2 letters to search players."
        onChange={vi.fn()}
        onExpandedChange={onExpandedChange}
        options={playerOptions}
        value={null}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Top scorer" });
    fireEvent.focus(combobox);

    expect(
      screen.getByText("Type at least 2 letters to search players."),
    ).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Other player" })).toBeVisible();
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(combobox, { target: { value: "p" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);

    fireEvent.change(combobox, { target: { value: "pl" } });
    const listbox = screen.getByRole("listbox", { name: "Top scorer options" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(21);
    expect(
      screen.getByText(
        "25 matching options. Showing the first 20, plus Other player.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("20 of 25 matches")).toBeVisible();
    expect(
      within(listbox).queryByRole("option", { name: "Player 21" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: "Escape" });
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });

  it("closes when focus leaves the selector", () => {
    const onExpandedChange = vi.fn();
    render(
      <>
        <SearchablePredictionSelect
          allowOther
          description="Choose a player"
          emptyMessage="No matching player."
          label="Top scorer"
          maximumResults={20}
          minimumQueryLength={2}
          onChange={vi.fn()}
          onExpandedChange={onExpandedChange}
          options={playerOptions}
          value={null}
        />
        <button type="button">Outside control</button>
      </>,
    );

    const combobox = screen.getByRole("combobox", { name: "Top scorer" });
    const outsideControl = screen.getByRole("button", {
      name: "Outside control",
    });
    fireEvent.focus(combobox);
    expect(screen.getByRole("listbox")).toBeVisible();

    fireEvent.blur(combobox, { relatedTarget: outsideControl });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });
});
