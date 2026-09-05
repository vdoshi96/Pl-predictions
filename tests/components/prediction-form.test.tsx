import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerMark } from "@/components/player-mark";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TeamMark } from "@/components/team-mark";
import { Card, CardContent } from "@/components/ui/card";
import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import { SpotlightPickGrid } from "@/features/leaderboard/spotlight-pick-grid";
import {
  PredictionForm,
  type PredictionSubmissionResult,
} from "@/features/predictions/prediction-form";
import { predictionDraftStorageKey } from "@/features/predictions/prediction-draft";
import {
  PredictionSorter,
  type PredictionTeam,
} from "@/features/predictions/prediction-sorter";
import {
  type PredictionPlayer,
  SpotlightPredictionsForm,
  type SpotlightPicksDraft,
} from "@/features/predictions/spotlight-predictions-form";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.localStorage.clear();
  stubPlayerCatalogue(playerFixtures);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("scrollTo", vi.fn());
});

const teams: PredictionTeam[] = PREMIER_LEAGUE_2026_27_TEAMS.map((team) => ({
  id: team.slug,
  displayName: team.displayName,
  shortName: team.shortName,
  sortName: team.sortName,
  assetPath: team.assetPath,
}));

const playerFixtures: PredictionPlayer[] = [
  {
    assetPath: "/player-faces/mohamed-salah.png",
    displayName: "Mohamed Salah",
    firstName: "Mohamed",
    id: "mohamed-salah",
    lastName: "Salah",
  },
  {
    displayName: "Bukayo Saka",
    firstName: "Bukayo",
    id: "bukayo-saka",
    lastName: "Saka",
  },
];

function stubPlayerCatalogue(
  players: readonly PredictionPlayer[],
  seasonSlug = "2026-27",
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ players, seasonSlug }),
      ok: true,
    }),
  );
}

function stubPlayerCatalogueFailure() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
}

function getSpotlightCategory(category: string) {
  const card = document.querySelector<HTMLElement>(
    `[data-category="${category}"]`,
  );
  if (!card) throw new Error(`Missing spotlight category ${category}`);
  return card;
}

function chooseOtherPlayer(
  category: string,
  label: string,
  playerName: string,
) {
  const card = getSpotlightCategory(category);
  fireEvent.focus(within(card).getByRole("combobox", { name: label }));
  fireEvent.click(within(card).getByRole("option", { name: "Other player" }));
  fireEvent.change(within(card).getByLabelText("Player’s full name"), {
    target: { value: playerName },
  });
}

function chooseClub(category: string, label: string, clubName: string) {
  const card = getSpotlightCategory(category);
  fireEvent.focus(within(card).getByRole("combobox", { name: label }));
  fireEvent.click(within(card).getByRole("option", { name: clubName }));
}

function completeSpotlightPicks() {
  chooseOtherPlayer("top_scorer", "Top scorer", "  Mohamed   Salah  ");
  chooseOtherPlayer("top_assister", "Top assister", "Bukayo Saka");
  chooseClub("most_clean_sheets", "Most clean sheets", "Arsenal");
  chooseClub("underdog_team", "Underdog team", "Brentford");
  chooseClub("overrated_team", "Overrated team", "Manchester United");
  chooseOtherPlayer("underdog_player", "Underdog player", "  Elliot Anderson");
  chooseOtherPlayer("overrated_player", "Overrated player", "Antony Matheus  ");
}

function acceptAlphabeticalPrediction() {
  const warning = screen.getByRole("dialog", {
    name: /this table is still alphabetical/i,
  });
  fireEvent.click(
    within(warning).getByRole("button", {
      name: /yes, use a–z/i,
    }),
  );
}

function continueWithAlphabeticalPrediction() {
  fireEvent.click(
    screen.getByRole("button", { name: /continue to spotlight picks/i }),
  );
  acceptAlphabeticalPrediction();
}

function SorterHarness({
  initialTeams = teams,
}: {
  initialTeams?: PredictionTeam[];
}) {
  const [orderedTeams, setOrderedTeams] = useState(initialTeams);

  return <PredictionSorter teams={orderedTeams} onChange={setOrderedTeams} />;
}

function SpotlightHarness() {
  const [picks, setPicks] = useState<SpotlightPicksDraft>({});

  return (
    <SpotlightPredictionsForm
      onChange={setPicks}
      picks={picks}
      players={playerFixtures}
      teams={teams}
    />
  );
}

describe("TeamMark", () => {
  it("renders a provided club mark with contain sizing", () => {
    render(
      <TeamMark initials="ARS" name="Arsenal" src="/team-marks/arsenal.png" />,
    );

    expect(screen.getByRole("img", { name: "Arsenal club mark" })).toHaveClass(
      "object-contain",
      "p-0.5",
    );
  });

  it("falls back to labelled initials when the image reports an error", () => {
    render(
      <TeamMark initials="ARS" name="Arsenal" src="/team-marks/arsenal.png" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Arsenal club mark" }));

    expect(
      screen.queryByRole("img", { name: "Arsenal club mark" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Arsenal initials" }),
    ).toHaveTextContent("ARS");
  });
});

describe("PlayerMark", () => {
  it("renders an accessible placeholder while player portraits are pending", () => {
    render(<PlayerMark name="Future roster player" />);

    const placeholder = screen.getByRole("img", {
      name: "Future roster player player portrait",
    });
    expect(placeholder).toBeVisible();
    expect(placeholder.querySelector("svg")).toBeInTheDocument();
    expect(placeholder.querySelector("img")).not.toBeInTheDocument();
  });

  it("falls back to the silhouette when a supplied portrait fails to load", () => {
    render(
      <PlayerMark
        name="Historical roster player"
        src="/player-faces/historical-roster-player.png"
      />,
    );

    const mark = screen.getByRole("img", {
      name: "Historical roster player player portrait",
    });
    const image = mark.querySelector("img");
    expect(image).toBeInTheDocument();
    if (!image) throw new Error("Expected a player portrait image.");

    fireEvent.error(image);

    expect(mark.querySelector("img")).not.toBeInTheDocument();
    expect(mark.querySelector("svg")).toBeInTheDocument();
  });

  it("renders an inactive historical player returned for a persisted pick", () => {
    render(
      <SpotlightPickGrid
        picks={[
          {
            assetPath: "/player-faces/historical-roster-player.png",
            category: "top_scorer",
            displayName: "Historical roster player",
            label: "Top scorer",
            subject: "player",
          },
        ]}
      />,
    );

    expect(screen.getByText("Historical roster player")).toBeVisible();
    const mark = screen.getByRole("img", {
      name: "Historical roster player player portrait",
    });
    expect(mark.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("historical-roster-player.png"),
    );
  });
});

describe("PredictionSorter", () => {
  it("renders all 20 positions with one direct-arrow announcement model", async () => {
    const { container } = render(<SorterHarness />);

    const rows = container.querySelectorAll("[data-team-id]");
    const touchActionElements = container.querySelectorAll(".touch-none");

    expect(rows).toHaveLength(20);
    expect(rows[0]).toHaveAttribute("data-team-id", "arsenal");
    expect(rows[0]).toHaveAttribute("data-position", "1");
    expect(rows[19]).toHaveAttribute("data-position", "20");
    expect(touchActionElements).toHaveLength(20);
    const arsenalHandle = screen.getByRole("button", {
      name: /move arsenal.*arrow keys.*page up or page down.*home or end.*drag this handle/i,
    });
    expect(arsenalHandle).toBeVisible();
    expect(arsenalHandle).not.toHaveAttribute("aria-describedby");
    expect(arsenalHandle).not.toHaveAttribute("aria-roledescription");
    await waitFor(() => {
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(
        document.querySelector("[id^='dnd-kit-announcement']"),
      ).not.toBeInTheDocument();
    });

    for (const element of touchActionElements) {
      expect(element.tagName).toBe("BUTTON");
      expect(element).toHaveClass("size-14");
    }

    for (const row of rows) {
      expect(row).toHaveClass("min-h-14");
      expect(row).not.toHaveClass("touch-none");
    }

    const brightonRow = container.querySelector<HTMLElement>(
      "[data-team-id='brighton-and-hove-albion']",
    );
    expect(brightonRow).not.toBeNull();
    const brightonName = within(brightonRow!).getByText(
      "Brighton & Hove Albion",
    );
    expect(brightonName).toHaveClass("break-words", "sm:truncate");
    expect(brightonName).not.toHaveClass("truncate");

    fireEvent.keyDown(arsenalHandle, { code: "Space", key: " " });
    fireEvent.keyDown(arsenalHandle, {
      code: "ArrowDown",
      key: "ArrowDown",
    });
    expect(container.querySelector("[data-position='1']")).toHaveAttribute(
      "data-team-id",
      "aston-villa",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Arsenal moved to position 2 of 20.",
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("resets a changed table to the presentation alphabetical order", () => {
    const { container } = render(
      <SorterHarness initialTeams={[...teams].reverse()} />,
    );

    expect(container.querySelector("[data-position='1']")).toHaveAttribute(
      "data-team-id",
      "tottenham-hotspur",
    );

    const resetButton = screen.getByRole("button", {
      name: /reset prediction table/i,
    });
    expect(resetButton).toHaveClass("min-h-11");
    fireEvent.click(resetButton);

    expect(container.querySelector("[data-position='1']")).toHaveAttribute(
      "data-team-id",
      "arsenal",
    );
    expect(container.querySelector("[data-position='3']")).toHaveAttribute(
      "data-team-id",
      "afc-bournemouth",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /reset to alphabetical/i,
    );
  });

  it("uses actual-position language when reused for manual standings", () => {
    render(
      <PredictionSorter teams={teams} onChange={vi.fn()} mode="standings" />,
    );

    expect(
      screen.getByRole("heading", { name: /current league table/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /move arsenal, currently actual position 1/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("list", {
        name: /premier league actual positions/i,
      }),
    ).toBeVisible();
  });
});

describe("PredictionForm", () => {
  it("asks for the display name before the A–Z blank-slate table", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);

    const nameHeading = screen.getByRole("heading", {
      name: /who is making this prediction/i,
    });
    const tableHeading = screen.getByRole("heading", {
      name: /your predicted table/i,
    });

    expect(
      nameHeading.compareDocumentPosition(tableHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: /table starts a–z as a blank slate/i,
      }),
    ).toBeVisible();
    expect(screen.getByText(/not last season’s table/i)).toBeVisible();
    expect(
      screen.getByText(/progress will be saved in this browser/i),
    ).toBeVisible();
    expect(screen.getByText(/^not submitted\./i)).toBeVisible();
    expect(screen.getByTestId("prediction-stage-panel")).toHaveClass(
      "t-panel-slide",
    );
  });

  it("remembers an intentional A–Z choice in page memory until Reset", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });

    continueWithAlphabeticalPrediction();
    fireEvent.click(screen.getByRole("button", { name: /back to table/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    expect(
      screen.queryByRole("dialog", {
        name: /this table is still alphabetical/i,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to table/i }));
    const arsenalHandle = screen.getByRole("button", {
      name: /move arsenal.*arrow keys.*page up or page down.*home or end.*drag this handle/i,
    });
    fireEvent.keyDown(arsenalHandle, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.click(
      screen.getByRole("button", { name: /reset prediction table/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    expect(
      screen.getByRole("dialog", {
        name: /this table is still alphabetical/i,
      }),
    ).toBeVisible();
  });

  it("discards a corrupt same-season browser draft", async () => {
    const storageKey = predictionDraftStorageKey("2026-27");
    window.localStorage.setItem(storageKey, "{not-json");

    render(
      <PredictionForm seasonSlug="2026-27" teams={teams} onSubmit={vi.fn()} />,
    );

    await waitFor(() =>
      expect(window.localStorage.getItem(storageKey)).toBeNull(),
    );
    expect(screen.getByLabelText(/your display name/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    ).toBeDisabled();
  });

  it("asks again before using A–Z from a restored browser draft", async () => {
    const seasonSlug = "2026-27";
    window.localStorage.setItem(
      predictionDraftStorageKey(seasonSlug),
      JSON.stringify({
        orderedTeamIds: teams.map((team) => team.id),
        participantName: "Alex",
        savedAt: "2026-08-14T12:00:00.000Z",
        seasonSlug,
        spotlightPicks: {},
        stage: "table",
        version: 1,
      }),
    );

    render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/draft restored from this browser/i),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );

    expect(
      screen.getByRole("dialog", {
        name: /this table is still alphabetical/i,
      }),
    ).toBeVisible();
  });

  it("warns about unsaved changes when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });

    expect(
      await screen.findByText(/this browser could not save a draft/i),
    ).toBeVisible();
    const beforeUnload = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
  });

  it("moves from table to spotlight to final review and emits all predictions", async () => {
    const storageKey = predictionDraftStorageKey("2026-27");
    const result: PredictionSubmissionResult = {
      ok: true,
      entryId: "entry-123",
      message: "Saved for the season.",
    };
    const onSubmit = vi.fn().mockResolvedValue(result);
    const onPendingChange = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();

    render(
      <PredictionForm
        seasonSlug="2026-27"
        teams={teams}
        onSubmit={onSubmit}
        onPendingChange={onPendingChange}
        onSuccess={onSuccess}
        onError={onError}
      />,
    );

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "  Vishal    Doshi  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );

    const alphabeticalWarning = screen.getByRole("dialog", {
      name: /this table is still alphabetical/i,
    });
    expect(alphabeticalWarning).toHaveAccessibleDescription(
      /only a blank slate, not last season’s table or a suggested prediction/i,
    );
    expect(
      screen.queryByRole("heading", { name: /make your spotlight picks/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(alphabeticalWarning).getByRole("button", {
        name: /yes, use a–z/i,
      }),
    );

    expect(
      screen.getByRole("heading", { name: /make your spotlight picks/i }),
    ).toBeVisible();
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();
    completeSpotlightPicks();
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );

    const dialog = await screen.findByRole("region", {
      name: "Review every prediction",
    });
    expect(within(dialog).getByText(/submitting as/i)).toHaveTextContent(
      "Vishal Doshi",
    );
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(20);
    expect(within(dialog).getAllByText("Arsenal")).toHaveLength(2);
    expect(within(dialog).getByText("Tottenham Hotspur")).toBeVisible();
    expect(within(dialog).getByText("7 spotlight picks")).toBeVisible();
    expect(within(dialog).getByText("Mohamed Salah")).toBeVisible();
    expect(within(dialog).getByText("Bukayo Saka")).toBeVisible();
    expect(within(dialog).getByText("Elliot Anderson")).toBeVisible();
    expect(within(dialog).getByText("Antony Matheus")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { level: 1 })).toHaveFocus();

    const brightonName = within(dialog).getByText("Brighton & Hove Albion");
    expect(brightonName).toHaveClass("break-words");
    expect(brightonName).not.toHaveClass("truncate");

    const mobileActionRow = within(dialog).getByRole("button", {
      name: /go back/i,
    }).parentElement;
    expect(mobileActionRow).toHaveClass("grid", "gap-2", "sm:grid-cols-2");
    expect(mobileActionRow).not.toHaveClass("grid-cols-2");

    fireEvent.click(
      within(dialog).getByRole("button", { name: /submit prediction/i }),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.participantName).toBe("Vishal Doshi");
    expect(submitted.honeypot).toBe("");
    expect(submitted.items).toHaveLength(20);
    expect(submitted.items[0]).toEqual({
      teamId: "arsenal",
      predictedPosition: 1,
    });
    expect(submitted.items[19]).toEqual({
      teamId: "tottenham-hotspur",
      predictedPosition: 20,
    });
    expect(submitted.categoryPicks).toEqual([
      { category: "top_scorer", customPlayerName: "Mohamed Salah" },
      { category: "top_assister", customPlayerName: "Bukayo Saka" },
      { category: "most_clean_sheets", teamId: "arsenal" },
      { category: "underdog_team", teamId: "brentford" },
      { category: "overrated_team", teamId: "manchester-united" },
      { category: "underdog_player", customPlayerName: "Elliot Anderson" },
      { category: "overrated_player", customPlayerName: "Antony Matheus" },
    ]);
    expect(onPendingChange).toHaveBeenNthCalledWith(1, true);
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
    expect(onSuccess).toHaveBeenCalledWith(result, submitted);
    expect(onError).not.toHaveBeenCalled();
    expect(await screen.findByText(/you’re in, Vishal Doshi/i)).toBeVisible();
    await waitFor(() =>
      expect(window.localStorage.getItem(storageKey)).toBeNull(),
    );
    expect(
      screen.getByRole("link", { name: /view confirmation/i }),
    ).toHaveAttribute("href", "/entries/entry-123");
    expect(
      screen.getByRole("link", { name: "View leaderboard" }),
    ).toHaveAttribute("href", "/leaderboard");
  });

  it("keeps a server rejection actionable in the review step", async () => {
    const storageKey = predictionDraftStorageKey("2026-27");
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      message: "That display name has already submitted.",
    });
    const onError = vi.fn();

    render(
      <PredictionForm
        seasonSlug="2026-27"
        teams={teams}
        onSubmit={onSubmit}
        onError={onError}
      />,
    );

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    completeSpotlightPicks();
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );

    const dialog = await screen.findByRole("region", {
      name: "Review every prediction",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /submit prediction/i }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That display name has already submitted.",
    );
    expect(onError).toHaveBeenCalledWith(
      "That display name has already submitted.",
      expect.objectContaining({ participantName: "Alex" }),
    );
    expect(
      within(dialog).getByRole("button", { name: /go back/i }),
    ).toBeEnabled();
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit table" }));
    expect(screen.getByLabelText(/your display name/i)).toHaveValue("Alex");
    expect(
      screen.queryByRole("region", { name: "Review every prediction" }),
    ).not.toBeInTheDocument();
  });

  it("clears a browser draft after the server verifies permanent season closure", async () => {
    const storageKey = predictionDraftStorageKey("2026-27");
    const view = render(
      <PredictionForm seasonSlug="2026-27" teams={teams} onSubmit={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    await waitFor(() =>
      expect(window.localStorage.getItem(storageKey)).not.toBeNull(),
    );

    view.rerender(
      <PredictionForm
        disabled
        disabledReason="Predictions are permanently closed."
        seasonSlug="2026-27"
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(window.localStorage.getItem(storageKey)).toBeNull(),
    );
    expect(screen.getByLabelText(/your display name/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    ).toBeDisabled();
  });

  it("closes an open alphabetical warning when the season permanently closes", async () => {
    const view = render(
      <PredictionForm seasonSlug="2026-27" teams={teams} onSubmit={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    expect(
      screen.getByRole("dialog", { name: /this table is still alphabetical/i }),
    ).toBeVisible();

    view.rerender(
      <PredictionForm
        disabled
        disabledReason="Predictions are permanently closed."
        seasonSlug="2026-27"
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: /this table is still alphabetical/i,
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    ).toBeDisabled();
  });

  it("closes an open final review when the season permanently closes", async () => {
    const view = render(
      <PredictionForm seasonSlug="2026-27" teams={teams} onSubmit={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    completeSpotlightPicks();
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );
    expect(
      screen.getByRole("region", { name: /review every prediction/i }),
    ).toBeVisible();

    view.rerender(
      <PredictionForm
        disabled
        disabledReason="Predictions are permanently closed."
        seasonSlug="2026-27"
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: /review every prediction/i }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/your display name/i)).toHaveValue("");
  });

  it("requires all seven categories and a complete Other player name", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "7 of 7 spotlight predictions are still incomplete",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    for (const combobox of screen.getAllByRole("combobox").slice(1)) {
      expect(combobox).not.toHaveAttribute("aria-invalid", "true");
    }

    chooseOtherPlayer("top_scorer", "Top scorer", "A");
    const topScorerCard = getSpotlightCategory("top_scorer");
    const otherPlayerInput =
      within(topScorerCard).getByLabelText("Player’s full name");
    expect(otherPlayerInput).toHaveClass("border-danger/35");
    expect(otherPlayerInput).toHaveAttribute("aria-invalid", "true");
    expect(otherPlayerInput).toHaveAccessibleDescription(
      /enter a valid player name/i,
    );
  });

  it("preserves the table, display name, and spotlight picks when going back", () => {
    const { container } = render(
      <PredictionForm teams={teams} onSubmit={vi.fn()} />,
    );

    const arsenalHandle = screen.getByRole("button", {
      name: /move arsenal.*arrow keys.*page up or page down.*home or end.*drag this handle/i,
    });
    fireEvent.keyDown(arsenalHandle, { code: "Space", key: " " });
    fireEvent.keyDown(arsenalHandle, {
      code: "ArrowDown",
      key: "ArrowDown",
    });
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "  Alex   Smith  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    chooseOtherPlayer("top_scorer", "Top scorer", "Alexander Isak");
    chooseClub("most_clean_sheets", "Most clean sheets", "Liverpool");

    fireEvent.click(screen.getByRole("button", { name: /back to table/i }));

    expect(screen.getByLabelText(/your display name/i)).toHaveValue(
      "Alex Smith",
    );
    expect(container.querySelector("[data-position='2']")).toHaveAttribute(
      "data-team-id",
      "arsenal",
    );

    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    const topScorerCard = getSpotlightCategory("top_scorer");
    expect(within(topScorerCard).getByRole("combobox")).toHaveValue(
      "Other player",
    );
    expect(
      within(topScorerCard).getByLabelText("Player’s full name"),
    ).toHaveValue("Alexander Isak");
    expect(
      within(getSpotlightCategory("most_clean_sheets")).getByRole("combobox"),
    ).toHaveValue("Liverpool");
  });

  it("restores a season-keyed draft and its selected-player display metadata", async () => {
    const seasonSlug = "2026-27";
    const storageKey = predictionDraftStorageKey(seasonSlug);
    const firstRender = render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    const arsenalHandle = screen.getByRole("button", {
      name: /move arsenal.*arrow keys.*page up or page down.*home or end.*drag this handle/i,
    });
    fireEvent.keyDown(arsenalHandle, { code: "Space", key: " " });
    fireEvent.keyDown(arsenalHandle, {
      code: "ArrowDown",
      key: "ArrowDown",
    });
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "  Alex   Smith  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/search 2 players by name/i)).toBeVisible(),
    );

    const topScorerCard = getSpotlightCategory("top_scorer");
    const topScorer = within(topScorerCard).getByRole("combobox", {
      name: "Top scorer",
    });
    fireEvent.focus(topScorer);
    fireEvent.change(topScorer, { target: { value: "salah" } });
    fireEvent.click(
      within(topScorerCard).getByRole("option", { name: "Mohamed Salah" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/draft saved in this browser until you submit/i),
      ).toBeVisible(),
    );
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
      expect.objectContaining({
        seasonSlug,
        version: 1,
        spotlightPicks: expect.objectContaining({
          top_scorer: {
            assetPath: "/player-faces/mohamed-salah.png",
            displayName: "Mohamed Salah",
            kind: "player",
            playerId: "mohamed-salah",
          },
        }),
      }),
    );

    firstRender.unmount();
    stubPlayerCatalogueFailure();
    const restoredRender = render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: /make your spotlight picks/i,
      }),
    ).toBeVisible();
    expect(screen.getByText(/draft restored from this browser/i)).toBeVisible();
    const restoredTopScorer = getSpotlightCategory("top_scorer");
    expect(within(restoredTopScorer).getByRole("combobox")).toHaveValue(
      "Mohamed Salah",
    );
    expect(
      within(restoredTopScorer).getByText(/selected: Mohamed Salah/i),
    ).toBeVisible();
    expect(restoredTopScorer.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("mohamed-salah.png"),
    );

    fireEvent.click(screen.getByRole("button", { name: /back to table/i }));
    expect(screen.getByLabelText(/your display name/i)).toHaveValue(
      "Alex Smith",
    );
    expect(
      restoredRender.container.querySelector("[data-position='2']"),
    ).toHaveAttribute("data-team-id", "arsenal");
  });

  it("clears a stale restored player only after a successful catalogue load", async () => {
    const seasonSlug = "2026-27";
    const firstRender = render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    await waitFor(() =>
      expect(screen.getByText(/search 2 players by name/i)).toBeVisible(),
    );
    const topScorerCard = getSpotlightCategory("top_scorer");
    fireEvent.focus(
      within(topScorerCard).getByRole("combobox", { name: "Top scorer" }),
    );
    fireEvent.change(
      within(topScorerCard).getByRole("combobox", { name: "Top scorer" }),
      { target: { value: "salah" } },
    );
    fireEvent.click(
      within(topScorerCard).getByRole("option", { name: "Mohamed Salah" }),
    );
    expect(within(topScorerCard).getByRole("combobox")).toHaveValue(
      "Mohamed Salah",
    );

    await waitFor(() =>
      expect(
        screen.getByText(/draft saved in this browser until you submit/i),
      ).toBeVisible(),
    );
    firstRender.unmount();
    stubPlayerCatalogue(playerFixtures.slice(1));
    render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/saved player selection is no longer/i),
    ).toBeVisible();
    expect(
      within(getSpotlightCategory("top_scorer")).getByRole("combobox"),
    ).toHaveValue("");
    expect(
      within(getSpotlightCategory("top_scorer")).queryByText(
        /selected: Mohamed Salah/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps restored player metadata while the catalogue is unavailable", async () => {
    const seasonSlug = "2026-27";
    window.localStorage.setItem(
      predictionDraftStorageKey(seasonSlug),
      JSON.stringify({
        orderedTeamIds: teams.map((team) => team.id),
        participantName: "Alex",
        savedAt: "2026-08-14T12:00:00.000Z",
        seasonSlug,
        spotlightPicks: {
          top_scorer: {
            assetPath: "/player-faces/mohamed-salah.png",
            displayName: "Mohamed Salah",
            kind: "player",
            playerId: "mohamed-salah",
          },
        },
        stage: "spotlight",
        version: 1,
      }),
    );
    stubPlayerCatalogueFailure();

    render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/player catalogue could not be loaded/i),
    ).toBeVisible();
    expect(
      within(getSpotlightCategory("top_scorer")).getByRole("combobox"),
    ).toHaveValue("Mohamed Salah");
    expect(
      within(getSpotlightCategory("top_scorer")).getByText(
        /selected: Mohamed Salah/i,
      ),
    ).toBeVisible();
  });

  it("recovers the player catalogue after Retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          players: playerFixtures,
          seasonSlug: "2026-27",
        }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();

    expect(
      await screen.findByText(/player catalogue could not be loaded/i),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /retry player catalogue/i }),
    );

    expect(await screen.findByText(/search 2 players by name/i)).toBeVisible();
    expect(
      screen.queryByText(/player catalogue could not be loaded/i),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a validated destination draft when season and team set change together", async () => {
    const destinationTeams = teams.map((team) => ({
      ...team,
      id: `next-${team.id}`,
    }));
    const destinationSlug = "2027-28";
    window.localStorage.setItem(
      predictionDraftStorageKey(destinationSlug),
      JSON.stringify({
        orderedTeamIds: [...destinationTeams].reverse().map((team) => team.id),
        participantName: "Jamie",
        savedAt: "2026-08-14T12:00:00.000Z",
        seasonSlug: destinationSlug,
        spotlightPicks: {
          top_scorer: {
            customPlayerName: "Next Season Scorer",
            kind: "custom-player",
          },
        },
        stage: "spotlight",
        version: 1,
      }),
    );
    stubPlayerCatalogue([], destinationSlug);

    const view = render(
      <PredictionForm seasonSlug="2026-27" teams={teams} onSubmit={vi.fn()} />,
    );
    view.rerender(
      <PredictionForm
        seasonSlug={destinationSlug}
        teams={destinationTeams}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: /make your spotlight picks/i,
      }),
    ).toBeVisible();
    expect(screen.getByText(/draft restored from this browser/i)).toBeVisible();
    const scorerCard = within(getSpotlightCategory("top_scorer"));
    expect(scorerCard.getByRole("combobox")).toHaveValue("Other player");
    expect(scorerCard.getByLabelText("Player’s full name")).toHaveValue(
      "Next Season Scorer",
    );

    fireEvent.click(screen.getByRole("button", { name: /back to table/i }));
    expect(screen.getByLabelText(/your display name/i)).toHaveValue("Jamie");
    expect(view.container.querySelector("[data-position='1']")).toHaveAttribute(
      "data-team-id",
      destinationTeams.at(-1)?.id,
    );
  });

  it("resets the draft and reloads the catalogue when the season changes without a remount", async () => {
    const nextSeasonPlayer: PredictionPlayer = {
      assetPath: null,
      displayName: "Next Season Player",
      firstName: "Next",
      id: "next-season-player",
      lastName: "Player",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          players: playerFixtures,
          seasonSlug: "2026-27",
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          players: [nextSeasonPlayer],
          seasonSlug: "2027-28",
        }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <PredictionForm seasonSlug="2026-27" teams={teams} onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    await screen.findByText(/search 2 players by name/i);

    view.rerender(
      <PredictionForm seasonSlug="2027-28" teams={teams} onSubmit={vi.fn()} />,
    );

    expect(await screen.findByLabelText(/your display name/i)).toHaveValue("");
    expect(
      window.localStorage.getItem(predictionDraftStorageKey("2027-28")),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Jamie" },
    });
    continueWithAlphabeticalPrediction();
    await screen.findByText(/search 1 player by name/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flushes the complete seventh pick on page exit and restores it on reload", async () => {
    const seasonSlug = "2026-27";
    const storageKey = predictionDraftStorageKey(seasonSlug);
    const firstRender = render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    completeSpotlightPicks();
    window.dispatchEvent(new Event("pagehide"));

    const storedImmediately = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}",
    ) as { spotlightPicks?: Record<string, unknown> };
    expect(Object.keys(storedImmediately.spotlightPicks ?? {})).toHaveLength(7);
    expect(storedImmediately.spotlightPicks).toEqual(
      expect.objectContaining({
        overrated_player: {
          customPlayerName: "Antony Matheus  ",
          kind: "custom-player",
        },
      }),
    );

    firstRender.unmount();
    render(
      <PredictionForm
        seasonSlug={seasonSlug}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: /make your spotlight picks/i,
      }),
    ).toBeVisible();
    expect(screen.getByText(/draft restored from this browser/i)).toBeVisible();
    expect(
      screen.getByText(/7 of 7 spotlight categories started/i),
    ).toBeVisible();
    expect(
      within(getSpotlightCategory("overrated_player")).getByLabelText(
        "Player’s full name",
      ),
    ).toHaveValue("Antony Matheus  ");
  });

  it("uses a safe-area-aware sticky action at mobile widths", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);

    const reviewButton = screen.getByRole("button", {
      name: /continue to spotlight picks/i,
    });
    const stickyAction = reviewButton.closest(".sticky");

    expect(stickyAction).toHaveClass("sticky", "bottom-0");
    expect(stickyAction?.className).toContain("safe-area-inset-bottom");
    expect(stickyAction).toHaveClass("bg-surface");
    expect(screen.getByText(/^not submitted\./i)).not.toHaveClass("truncate");
    expect(reviewButton).toHaveClass("w-full", "min-h-12");
  });

  it("removes fixed positioning from the closed-state action", () => {
    render(
      <PredictionForm
        disabled
        disabledReason="Predictions are permanently closed."
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    const reviewButton = screen.getByRole("button", {
      name: /continue to spotlight picks/i,
    });
    expect(reviewButton.closest("div.border-border\\/80")).not.toHaveClass(
      "sticky",
    );
  });

  it("hides the sticky review action while a selector popup is open", async () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    continueWithAlphabeticalPrediction();
    await screen.findByText(/search 2 players by name/i);

    const reviewButton = screen.getByRole("button", {
      name: /review all predictions/i,
    });
    const stickyAction = reviewButton.closest(".sticky");
    const topScorerCard = within(getSpotlightCategory("top_scorer"));
    const topAssisterCard = within(getSpotlightCategory("top_assister"));

    fireEvent.click(
      topScorerCard.getByRole("button", {
        name: "Open Top scorer options",
      }),
    );
    expect(stickyAction).toHaveClass("hidden");
    expect(screen.getAllByRole("listbox")).toHaveLength(1);

    fireEvent.click(
      topAssisterCard.getByRole("button", {
        name: "Open Top assister options",
      }),
    );
    expect(stickyAction).toHaveClass("hidden");
    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(
      topScorerCard.getByRole("combobox", { name: "Top scorer" }),
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(
      topAssisterCard.getByRole("button", {
        name: "Close Top assister options",
      }),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(stickyAction).not.toHaveClass("hidden");
  });
});

describe("SpotlightPredictionsForm", () => {
  it("emits composable updates when successive choices share a stale render", () => {
    const onChange = vi.fn();
    render(
      <SpotlightPredictionsForm
        onChange={onChange}
        picks={{}}
        players={playerFixtures}
        teams={teams}
      />,
    );

    chooseClub("underdog_team", "Underdog team", "Arsenal");
    chooseClub("overrated_team", "Overrated team", "Brentford");

    let combinedPicks: SpotlightPicksDraft = {};
    for (const [update] of onChange.mock.calls as Array<
      [(current: SpotlightPicksDraft) => SpotlightPicksDraft]
    >) {
      combinedPicks = update(combinedPicks);
    }
    expect(combinedPicks).toEqual({
      overrated_team: { kind: "team", teamId: "brentford" },
      underdog_team: { kind: "team", teamId: "arsenal" },
    });
  });

  it("filters the player fixture by first or last name", () => {
    render(<SpotlightHarness />);

    const topScorerCard = getSpotlightCategory("top_scorer");
    const combobox = within(topScorerCard).getByRole("combobox", {
      name: "Top scorer",
    });
    combobox.focus();
    fireEvent.change(combobox, { target: { value: "mohamed" } });

    expect(
      within(topScorerCard).getByRole("option", { name: "Mohamed Salah" }),
    ).toBeVisible();
    expect(
      within(topScorerCard).queryByRole("option", { name: "Bukayo Saka" }),
    ).not.toBeInTheDocument();

    fireEvent.change(combobox, { target: { value: "Saka" } });

    expect(
      within(topScorerCard).getByRole("option", { name: "Bukayo Saka" }),
    ).toBeVisible();
    expect(
      within(topScorerCard).queryByRole("option", { name: "Mohamed Salah" }),
    ).not.toBeInTheDocument();
  });

  it("supports input-focused keyboard navigation and selection", () => {
    render(<SpotlightHarness />);

    const topScorerCard = getSpotlightCategory("top_scorer");
    const combobox = within(topScorerCard).getByRole("combobox", {
      name: "Top scorer",
    });
    combobox.focus();
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "sa" } });

    const options = within(topScorerCard).getAllByRole("option");
    expect(options).toHaveLength(3);
    for (const option of options)
      expect(option).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(combobox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("bukayo-saka"),
    );
    fireEvent.keyDown(combobox, { key: "Enter" });

    expect(combobox).toHaveValue("Bukayo Saka");
    expect(combobox).toHaveFocus();
    expect(
      within(topScorerCard).queryByRole("listbox"),
    ).not.toBeInTheDocument();
  });

  it("preserves the prior selection when a replacement search is cancelled", () => {
    render(<SpotlightHarness />);

    const topScorerCard = getSpotlightCategory("top_scorer");
    const combobox = within(topScorerCard).getByRole("combobox", {
      name: "Top scorer",
    });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "saka" } });
    fireEvent.click(
      within(topScorerCard).getByRole("option", { name: "Bukayo Saka" }),
    );
    expect(combobox).toHaveValue("Bukayo Saka");

    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "Mohamed" } });
    fireEvent.keyDown(combobox, { key: "Escape" });

    expect(combobox).toHaveValue("Bukayo Saka");
  });
});

describe("shared site chrome", () => {
  it("provides a full-width mobile navigation and the rights disclaimer", () => {
    const { rerender } = render(<SiteHeader />);

    const navigation = screen.getByRole("navigation", { name: /primary/i });
    const homeLink = screen.getByRole("link", { name: /^season table$/i });

    expect(navigation).toHaveClass("site-nav");
    expect(homeLink).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: /^leaderboard$/i }),
    ).toHaveAttribute("href", "/leaderboard");
    expect(screen.getByRole("link", { name: /^spotlight$/i })).toHaveAttribute(
      "href",
      "/spotlight",
    );
    expect(screen.getByRole("link", { name: /^win streak$/i })).toHaveAttribute(
      "href",
      "/win-streak",
    );
    expect(screen.getByRole("link", { name: /^rules$/i })).toHaveAttribute(
      "href",
      "/rules",
    );
    expect(screen.queryByRole("link", { name: /^admin$/i })).toBeNull();
    expect(screen.getByText("2026 / 27")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Dranx.*Prediction League/ }),
    ).toBeVisible();

    rerender(<SiteFooter />);

    expect(
      screen.getByText(
        /Dranx Prediction League is an independent, private prediction competition/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        /club marks are displayed from owner-provided local assets/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Dranx Prediction League is an independent, private prediction competition/i,
      ).parentElement?.className,
    ).toContain("safe-area-inset-bottom");
  });

  it("allows card contents to shrink inside narrow grid columns", () => {
    render(
      <Card data-testid="responsive-card">
        <CardContent data-testid="responsive-card-content">
          Brighton &amp; Hove Albion
        </CardContent>
      </Card>,
    );

    expect(screen.getByTestId("responsive-card")).toHaveClass("min-w-0");
    expect(screen.getByTestId("responsive-card-content")).toHaveClass(
      "min-w-0",
    );
  });
});
