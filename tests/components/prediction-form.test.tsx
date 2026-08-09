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
import {
  PredictionForm,
  type PredictionSubmissionResult,
} from "@/features/predictions/prediction-form";
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
      name: /move arsenal.*arrow up or arrow down.*drag this handle/i,
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
      expect(row).toHaveClass("min-h-16");
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
  it("moves from table to spotlight to final review and emits all predictions", async () => {
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

    expect(
      screen.getByRole("heading", { name: /make your spotlight picks/i }),
    ).toBeVisible();
    completeSpotlightPicks();
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );

    const dialog = await screen.findByRole("dialog");
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
    expect(dialog).toHaveClass("bottom-2", "sm:bottom-auto", "sm:top-1/2");
    expect(dialog.className).toContain("safe-area-inset-top");

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
    expect(
      screen.getByRole("link", { name: /view confirmation/i }),
    ).toHaveAttribute("href", "/entries/entry-123");
    expect(
      screen.getByRole("link", { name: "View leaderboard" }),
    ).toHaveAttribute("href", "/leaderboard");
  });

  it("keeps a server rejection actionable in the review dialog", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      message: "That display name has already submitted.",
    });
    const onError = vi.fn();

    render(
      <PredictionForm teams={teams} onSubmit={onSubmit} onError={onError} />,
    );

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    completeSpotlightPicks();
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );

    const dialog = await screen.findByRole("dialog");
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
  });

  it("requires all seven categories and a complete Other player name", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /review all predictions/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose all seven spotlight predictions and complete every Other player name.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    for (const combobox of screen.getAllByRole("combobox")) {
      expect(combobox).toHaveAttribute("aria-invalid", "true");
    }

    chooseOtherPlayer("top_scorer", "Top scorer", "A");
    const topScorerCard = getSpotlightCategory("top_scorer");
    const otherPlayerInput =
      within(topScorerCard).getByLabelText("Player’s full name");
    expect(otherPlayerInput).toHaveClass("border-red-400");
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
      name: /move arsenal.*arrow up or arrow down.*drag this handle/i,
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

  it("clears a catalog pick when that player leaves the available roster", async () => {
    const { rerender } = render(
      <PredictionForm
        players={playerFixtures}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/your display name/i), {
      target: { value: "Alex" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue to spotlight picks/i }),
    );
    const topScorerCard = getSpotlightCategory("top_scorer");
    fireEvent.focus(
      within(topScorerCard).getByRole("combobox", { name: "Top scorer" }),
    );
    fireEvent.click(
      within(topScorerCard).getByRole("option", { name: "Mohamed Salah" }),
    );
    expect(within(topScorerCard).getByRole("combobox")).toHaveValue(
      "Mohamed Salah",
    );

    rerender(
      <PredictionForm
        players={playerFixtures.slice(1)}
        teams={teams}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        within(getSpotlightCategory("top_scorer")).getByRole("combobox"),
      ).toHaveValue(""),
    );
  });

  it("uses a safe-area-aware sticky action at mobile widths", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);

    const reviewButton = screen.getByRole("button", {
      name: /continue to spotlight picks/i,
    });
    const stickyAction = reviewButton.closest(".sticky");

    expect(stickyAction).toHaveClass("sticky", "bottom-0");
    expect(stickyAction?.className).toContain("safe-area-inset-bottom");
    expect(reviewButton).toHaveClass("w-full", "min-h-12");
  });
});

describe("SpotlightPredictionsForm", () => {
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
    const predictLink = screen.getByRole("link", { name: /^predict$/i });

    expect(navigation).toBeVisible();
    expect(navigation).toHaveClass("basis-full", "sm:basis-auto");
    expect(within(navigation).getByRole("list")).toHaveClass(
      "grid",
      "grid-cols-5",
      "sm:flex",
    );
    expect(predictLink).toHaveAttribute("href", "/");
    expect(predictLink).toHaveClass(
      "min-h-12",
      "w-full",
      "min-w-0",
      "sm:w-auto",
    );
    expect(screen.getByRole("link", { name: /^table$/i })).toHaveAttribute(
      "href",
      "/leaderboard",
    );
    expect(screen.getByRole("link", { name: /^spotlight$/i })).toHaveAttribute(
      "href",
      "/spotlight",
    );
    expect(
      screen.getByRole("link", { name: /^how to play$/i }),
    ).toHaveAttribute("href", "/rules");
    expect(screen.getByText("2026/27 Premier League")).toBeVisible();
    expect(screen.getByText("Dranx Prediction League")).toBeVisible();

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
