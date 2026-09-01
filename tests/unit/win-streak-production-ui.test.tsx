import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import {
  getWinStreakFixtureForTeam,
  getWinStreakRoundByMatchweek,
  getWinStreakTeam,
  type WinStreakTeamSlug,
} from "@/features/win-streak/fixtures";
import { WinStreakEntryPanel } from "@/features/win-streak/win-streak-entry-panel";
import { WinStreakLeaderboard } from "@/features/win-streak/win-streak-leaderboard";
import type {
  WinStreakActiveRoundView,
  WinStreakLeaderboardRow,
  WinStreakPublicPick,
  WinStreakViewerView,
} from "@/features/win-streak/view-model";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

type EntryPanelProps = ComponentProps<typeof WinStreakEntryPanel>;

const matchweekTwo = getWinStreakRoundByMatchweek(2);
if (!matchweekTwo) {
  throw new Error("Expected the canonical Matchweek 2 fixture round.");
}

const activeRound: WinStreakActiveRoundView = {
  deadlineAt: matchweekTwo.startsAt,
  fixtures: matchweekTwo.fixtures.map((fixture) => ({
    awayTeamSlug: fixture.awayTeamSlug,
    homeTeamSlug: fixture.homeTeamSlug,
    kickoffAt: fixture.kickoffAt,
  })),
  matchweek: matchweekTwo.matchweek,
  pickOpen: true,
};

function buildPublicPick(teamSlug: WinStreakTeamSlug): WinStreakPublicPick {
  const fixture = getWinStreakFixtureForTeam(2, teamSlug);
  const isHome = fixture.homeTeamSlug === teamSlug;

  return {
    isHome,
    matchweek: 2,
    opponentTeamSlug: isHome ? fixture.awayTeamSlug : fixture.homeTeamSlug,
    teamSlug,
  };
}

function buildViewer(
  overrides: Partial<WinStreakViewerView> = {},
): WinStreakViewerView {
  return {
    bestStreak: 2,
    currentPick: null,
    currentStreak: 1,
    displayName: "Ada",
    history: [],
    usedWinningTeamSlugs: [],
    ...overrides,
  };
}

function buildActions() {
  const createProfileAction = vi.fn<EntryPanelProps["createProfileAction"]>();
  const submitPickAction = vi.fn<EntryPanelProps["submitPickAction"]>();
  createProfileAction.mockResolvedValue({
    message: "Profile created.",
    ok: true,
  });
  submitPickAction.mockResolvedValue({
    message: "Pick locked.",
    ok: true,
  });
  return { createProfileAction, submitPickAction };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

beforeEach(() => {
  navigation.refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("production Win Streak public leaderboard", () => {
  it("keeps public picks visible before an anonymous visitor creates a profile", () => {
    const pick = buildPublicPick("arsenal");
    const team = getWinStreakTeam(pick.teamSlug);
    const opponent = getWinStreakTeam(pick.opponentTeamSlug);
    const entries: WinStreakLeaderboardRow[] = [
      {
        bestStreak: 3,
        currentPick: pick,
        currentStreak: 2,
        displayName: "Ada",
        isViewer: false,
        rank: 1,
      },
      {
        bestStreak: 1,
        currentPick: null,
        currentStreak: 0,
        displayName: "Liam",
        isViewer: false,
        rank: 2,
      },
    ];
    const actions = buildActions();

    render(
      <>
        <WinStreakLeaderboard entries={entries} />
        <WinStreakEntryPanel
          activeRound={activeRound}
          createProfileAction={actions.createProfileAction}
          submitPickAction={actions.submitPickAction}
          viewer={null}
        />
      </>,
    );

    expect(
      screen.getByRole("heading", { name: "Win Streak leaderboard" }),
    ).toBeVisible();
    expect(screen.getByText("Public")).toBeVisible();
    expect(screen.getAllByText(team.displayName)).not.toHaveLength(0);
    expect(
      screen.getAllByText(
        `MW2 · ${pick.isHome ? "Home vs" : "Away at"} ${opponent.displayName}`,
      ),
    ).not.toHaveLength(0);
    expect(screen.getAllByText("No pick yet")).not.toHaveLength(0);
    expect(screen.getByLabelText("Display name")).toBeVisible();
    expect(actions.createProfileAction).not.toHaveBeenCalled();
  });

  it("renders the empty public state", () => {
    render(<WinStreakLeaderboard entries={[]} />);

    expect(screen.getByText("No streaks yet")).toBeVisible();
    expect(
      screen.getByText(
        "The first confirmed Matchweek 2 pick will appear here.",
      ),
    ).toBeVisible();
  });

  it("renders a long display name in full in both responsive leaderboard views", () => {
    const longName = "Alexandria Verylongname United Forever";
    render(
      <WinStreakLeaderboard
        entries={[
          {
            bestStreak: 4,
            currentPick: buildPublicPick("liverpool"),
            currentStreak: 3,
            displayName: longName,
            isViewer: false,
            rank: 1,
          },
        ]}
      />,
    );

    const names = screen.getAllByText(longName, { exact: true });
    expect(names).toHaveLength(2);
    expect(names[0]).toHaveClass("[overflow-wrap:anywhere]");
    expect(names[1].closest("th")).toHaveClass("[overflow-wrap:anywhere]");
  });
});

describe("production Win Streak entry panel", () => {
  it("submits the account-free display-name gate through its action prop", async () => {
    const actions = buildActions();
    render(
      <WinStreakEntryPanel
        activeRound={activeRound}
        createProfileAction={actions.createProfileAction}
        submitPickAction={actions.submitPickAction}
        viewer={null}
      />,
    );

    expect(
      screen.getByRole("button", { name: /continue.*profile/iu }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Vishal" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue.*profile/iu }),
    );

    await waitFor(() =>
      expect(actions.createProfileAction).toHaveBeenCalledWith({
        displayName: "Vishal",
        website: "",
      }),
    );
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
  });

  it("keeps a failed pick actionable inside the open review dialog", async () => {
    const actions = buildActions();
    actions.submitPickAction.mockResolvedValue({
      message: "The pick deadline has passed.",
      ok: false,
    });
    render(
      <WinStreakEntryPanel
        activeRound={activeRound}
        createProfileAction={actions.createProfileAction}
        submitPickAction={actions.submitPickAction}
        viewer={buildViewer()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Arsenal/iu }));
    fireEvent.click(screen.getByRole("button", { name: "Review pick" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Arsenal" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The pick deadline has passed.",
      ),
    );
    expect(
      screen.getByRole("dialog", { name: "Review your pick" }),
    ).toBeVisible();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("renders one official club mark and native radio for every team", () => {
    const actions = buildActions();
    const { container } = render(
      <WinStreakEntryPanel
        activeRound={activeRound}
        createProfileAction={actions.createProfileAction}
        submitPickAction={actions.submitPickAction}
        viewer={buildViewer()}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(20);
    expect(radios.map((radio) => radio.getAttribute("value")).sort()).toEqual(
      PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug).sort(),
    );
    const marks = Array.from(container.querySelectorAll("img"));
    expect(marks).toHaveLength(20);

    for (const team of PREMIER_LEAGUE_2026_27_TEAMS) {
      expect(
        screen.getByRole("radio", {
          name: new RegExp(escapeRegex(team.displayName), "iu"),
        }),
      ).toBeVisible();
      expect(
        marks.some((mark) =>
          decodeURIComponent(mark.getAttribute("src") ?? "").includes(
            team.assetPath,
          ),
        ),
      ).toBe(true);
    }
  });

  it("keeps a used club visible, disabled, and textually explained without exposing internal IDs", () => {
    const actions = buildActions();
    const { container } = render(
      <WinStreakEntryPanel
        activeRound={activeRound}
        createProfileAction={actions.createProfileAction}
        submitPickAction={actions.submitPickAction}
        viewer={buildViewer({ usedWinningTeamSlugs: ["arsenal"] })}
      />,
    );

    const arsenal = screen.getByRole("radio", { name: /Arsenal/iu });
    expect(arsenal).toBeDisabled();
    expect(arsenal).toHaveAccessibleDescription("Used in this streak");
    expect(screen.getByText("Used in this streak")).toBeVisible();
    expect(
      screen.getByText(
        "1 winning club is unavailable until this streak resets.",
      ),
    ).toBeVisible();

    const markup = container.innerHTML;
    for (const fixture of matchweekTwo.fixtures) {
      expect(markup).not.toContain(fixture.id);
    }
    expect(markup).not.toMatch(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
    );
    expect(markup).not.toMatch(/participantId|profileId|sourceFixtureId/iu);
  });

  it("supports keyboard radio activation and confirms the immutable pick through its action prop", async () => {
    const actions = buildActions();
    render(
      <WinStreakEntryPanel
        activeRound={activeRound}
        createProfileAction={actions.createProfileAction}
        submitPickAction={actions.submitPickAction}
        viewer={buildViewer()}
      />,
    );

    const radio = screen.getByRole("radio", { name: /Liverpool/iu });
    const review = screen.getByRole("button", { name: "Review pick" });
    expect(review).toBeDisabled();

    radio.focus();
    expect(radio).toHaveFocus();
    fireEvent.keyDown(radio, { code: "Space", key: " " });
    fireEvent.click(radio, { detail: 0 });
    fireEvent.keyUp(radio, { code: "Space", key: " " });

    expect(radio).toBeChecked();
    expect(review).toBeEnabled();
    fireEvent.click(review);

    const dialog = screen.getByRole("dialog", { name: "Review your pick" });
    expect(dialog).toHaveAccessibleDescription(
      "Confirm only when you are ready. Your Matchweek 2 pick is immutable and will appear on the public leaderboard.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm Liverpool" }));

    await waitFor(() =>
      expect(actions.submitPickAction).toHaveBeenCalledWith({
        teamSlug: "liverpool",
      }),
    );
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  });

  it("states that a locked pick is public and immutable", () => {
    const actions = buildActions();
    const pick = buildPublicPick("arsenal");
    const team = getWinStreakTeam(pick.teamSlug);
    render(
      <WinStreakEntryPanel
        activeRound={activeRound}
        createProfileAction={actions.createProfileAction}
        submitPickAction={actions.submitPickAction}
        viewer={buildViewer({ currentPick: pick })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: `Pick locked: ${team.displayName}` }),
    ).toBeVisible();
    expect(
      screen.getByText(/This pick is now public and cannot be changed\./u),
    ).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
