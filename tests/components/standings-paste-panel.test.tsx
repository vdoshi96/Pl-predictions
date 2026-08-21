import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandingsPastePanel } from "@/features/standings/standings-paste-panel";

const teams = [
  { displayName: "Liverpool", id: "t-liv", slug: "liverpool" },
  { displayName: "Arsenal", id: "t-ars", slug: "arsenal" },
];

const activeItems = [
  {
    actualPosition: 1,
    leaguePoints: 19,
    playedGames: 7,
    teamSlug: "liverpool",
  },
  {
    actualPosition: 2,
    leaguePoints: 16,
    playedGames: 7,
    teamSlug: "arsenal",
  },
];

afterEach(cleanup);

function renderPanel(
  onSubmit = vi.fn().mockResolvedValue({ ok: true, message: "Saved." }),
) {
  render(
    <StandingsPastePanel
      activeItems={activeItems}
      disabled={false}
      onSubmit={onSubmit}
      teams={teams}
    />,
  );
  return onSubmit;
}

describe("StandingsPastePanel", () => {
  it("parses pasted text and shows a preview with statuses", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Liverpool 8 20\n2 Arsenal 8 18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    expect(screen.getByText("Liverpool")).toBeTruthy();
    expect(
      screen.getAllByRole("cell", { name: "Check numbers" }),
    ).toHaveLength(2);
  });

  it("blocks confirm while clubs are missing and lists problems", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Liverpool 8 20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    expect(screen.getByText(/Parsed 1 of 20 clubs/)).toBeTruthy();
    const confirm = screen.getByRole("button", {
      name: "Save pasted table",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks confirm on unknown club lines", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Bayern Munich 8 20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    expect(screen.getAllByText(/Unknown club/)).toHaveLength(2);
  });

  it("submits the validated payload through onSubmit and clears on success", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: true,
      message: "The validated provisional table is now active.",
    });
    render(
      <StandingsPastePanel
        activeItems={activeItems}
        disabled={false}
        onSubmit={onSubmit}
        teams={[
          ...teams,
          {
            displayName: "Aston Villa",
            id: "t-avl",
            slug: "aston-villa",
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: {
        value: "1 Liverpool 8 20\n2 Arsenal 8 18\n3 Aston Villa 8 15",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save pasted table" }),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].standings[0]).toEqual({
      teamSlug: "liverpool",
      actualPosition: 1,
      playedGames: 8,
      leaguePoints: 20,
    });
    await waitFor(() =>
      expect(screen.getByText(/validated provisional table/)).toBeTruthy(),
    );
  });

  it("disables everything when disabled is true", () => {
    render(
      <StandingsPastePanel
        activeItems={activeItems}
        disabled
        onSubmit={vi.fn()}
        teams={teams}
      />,
    );
    expect(
      (screen.getByLabelText("Pasted table text") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });
});
