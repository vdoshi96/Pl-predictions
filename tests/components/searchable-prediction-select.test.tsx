import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchablePredictionSelect } from "@/features/predictions/searchable-prediction-select";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
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
    vi.useFakeTimers();
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

    expect(screen.getByRole("listbox", { hidden: true })).toHaveClass(
      "is-closing",
    );
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);

    act(() => vi.advanceTimersByTime(150));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("marks the open listbox with the shared dropdown transition contract", () => {
    render(
      <SearchablePredictionSelect
        description="Choose a club"
        emptyMessage="No matching club."
        label="Most clean sheets"
        onChange={vi.fn()}
        options={playerOptions.slice(0, 2)}
        value={null}
      />,
    );

    fireEvent.focus(
      screen.getByRole("combobox", { name: "Most clean sheets" }),
    );
    expect(screen.getByRole("listbox")).toHaveClass("t-dropdown", "is-open");
  });

  it("commits a pointer choice before mobile scrolling can cancel click", async () => {
    const onChange = vi.fn();
    render(
      <SearchablePredictionSelect
        description="Choose a club"
        emptyMessage="No matching club."
        label="Most clean sheets"
        onChange={onChange}
        options={playerOptions.slice(0, 2)}
        value={null}
      />,
    );

    fireEvent.focus(
      screen.getByRole("combobox", { name: "Most clean sheets" }),
    );
    const option = screen.getByRole("option", { name: "Player 01" });
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenCalledWith("player-1");
    fireEvent.mouseUp(option);
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });
});
