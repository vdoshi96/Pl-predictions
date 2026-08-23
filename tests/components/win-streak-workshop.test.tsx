import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import { WinStreakWorkshop } from "@/features/win-streak/win-streak-workshop";
import { WIN_STREAK_WORKSHOP_STORAGE_KEY } from "@/features/win-streak/workshop-state";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
});

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function renderHydratedWorkshop() {
  const view = render(<WinStreakWorkshop />);
  await screen.findByLabelText("Display name");
  return view;
}

async function createOrResumeProfile(displayName: string) {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: displayName },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Create or resume profile" }),
  );
  await screen.findByRole("heading", { name: `${displayName}'s streak` });
}

function chooseTeam(displayName: string) {
  const radio = screen.getByRole("radio", {
    name: new RegExp(escaped(displayName), "iu"),
  });
  radio.focus();
  fireEvent.keyDown(radio, { key: " ", code: "Space" });
  fireEvent.click(radio);
  fireEvent.keyUp(radio, { key: " ", code: "Space" });
  expect(radio).toBeChecked();
}

function reviewAndConfirm(displayName: string) {
  fireEvent.click(screen.getByRole("button", { name: "Review pick" }));
  const dialog = screen.getByRole("dialog", { name: "Review your pick" });
  expect(dialog).toBeVisible();
  expect(within(dialog).getByText(displayName, { exact: true })).toBeVisible();
  fireEvent.click(
    within(dialog).getByRole("button", { name: `Confirm ${displayName}` }),
  );
  expect(
    screen.getByRole("heading", { name: `Pick locked: ${displayName}` }),
  ).toBeVisible();
}

function switchToProfile(displayName: string) {
  fireEvent.click(screen.getByRole("button", { name: "Switch profile" }));
  return createOrResumeProfile(displayName);
}

describe("WinStreakWorkshop", () => {
  it("gates fixtures behind validated local profiles", async () => {
    await renderHydratedWorkshop();

    expect(
      screen.getByRole("heading", { level: 1, name: "Win Streak" }),
    ).toBeVisible();
    expect(screen.getByText("Local workshop")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Choose a display name" }),
    ).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Create or resume profile" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "at least 2 characters",
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "A".repeat(41) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create or resume profile" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "40 characters or fewer",
    );
  });

  it("shows all 20 canonical marks in ten semantic fixture rows and locks a reviewed keyboard pick", async () => {
    const { container, unmount } = await renderHydratedWorkshop();
    await createOrResumeProfile("Alex Morgan");

    expect(
      screen.getByRole("region", { name: "Choose one club to win" }),
    ).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(20);
    expect(container.querySelectorAll("img")).toHaveLength(20);
    for (const team of PREMIER_LEAGUE_2026_27_TEAMS) {
      expect(
        screen.getByRole("radio", {
          name: new RegExp(escaped(team.displayName), "iu"),
        }),
      ).toBeEnabled();
    }

    chooseTeam("Arsenal");
    reviewAndConfirm("Arsenal");
    expect(screen.queryByRole("radio", { name: /Arsenal/iu })).toBeNull();
    expect(
      window.localStorage.getItem(WIN_STREAK_WORKSHOP_STORAGE_KEY),
    ).toEqual(expect.any(String));

    unmount();
    render(<WinStreakWorkshop />);
    expect(
      await screen.findByRole("heading", { name: "Alex Morgan's streak" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Pick locked: Arsenal" }),
    ).toBeVisible();
  });

  it("applies one shared fixture result to opposing picks and disables winning clubs", async () => {
    await renderHydratedWorkshop();
    await createOrResumeProfile("Avery");
    chooseTeam("Arsenal");
    reviewAndConfirm("Arsenal");

    await switchToProfile("Blair");
    chooseTeam("Brentford");
    reviewAndConfirm("Brentford");

    const fixture = screen.getByRole("group", {
      name: "Arsenal v Brentford",
    });
    fireEvent.click(within(fixture).getByRole("radio", { name: "Home win" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply results and advance" }),
    );

    expect(screen.getByText("Current streak 0")).toBeVisible();
    expect(screen.getByText("Loss · streak reset")).toBeVisible();

    await switchToProfile("Avery");
    expect(screen.getByText("Current streak 1")).toBeVisible();
    expect(screen.getByText("Best streak 1")).toBeVisible();
    expect(screen.getByText("Win", { exact: true })).toBeVisible();

    const arsenal = screen.getByRole("radio", { name: /Arsenal/iu });
    expect(arsenal).toBeDisabled();
    expect(screen.getByText("Used in this streak")).toBeVisible();

    const leaderboard = screen.getByRole("table", {
      name: "Win Streak leaderboard",
    });
    const rows = within(leaderboard).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Avery");
    expect(rows[1]).toHaveTextContent("1");
    expect(rows[2]).toHaveTextContent("Blair");
    expect(rows[2]).toHaveTextContent("2");
  });

  it("preserves missed and void rounds without consuming a voided club", async () => {
    await renderHydratedWorkshop();
    await createOrResumeProfile("Casey");

    fireEvent.click(
      screen.getByRole("button", { name: "Advance without picks" }),
    );
    expect(screen.getByRole("heading", { name: "Matchweek 21" })).toBeVisible();
    expect(screen.getByText("Missed · streak held")).toBeVisible();

    chooseTeam("Arsenal");
    reviewAndConfirm("Arsenal");
    const fixture = screen.getByRole("group", { name: "Hull City v Arsenal" });
    fireEvent.click(within(fixture).getByRole("radio", { name: "Void" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply results and advance" }),
    );

    expect(screen.getByText("Void · streak held")).toBeVisible();
    expect(screen.getByText("Current streak 0")).toBeVisible();
    expect(screen.getByRole("radio", { name: /Arsenal/iu })).toBeEnabled();
  });

  it("rejects corrupt stored data and clears the complete workshop after confirmation", async () => {
    window.localStorage.setItem(WIN_STREAK_WORKSHOP_STORAGE_KEY, "{bad-json");
    await renderHydratedWorkshop();

    await waitFor(() =>
      expect(
        window.localStorage.getItem(WIN_STREAK_WORKSHOP_STORAGE_KEY),
      ).toBeNull(),
    );

    await createOrResumeProfile("Dana");
    fireEvent.click(
      screen.getByRole("button", { name: "Clear all workshop data" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Clear all workshop data?",
    });
    expect(dialog).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear all workshop data",
      }),
    );

    expect(await screen.findByLabelText("Display name")).toBeVisible();
    expect(screen.queryByText("Dana", { exact: true })).toBeNull();
    expect(
      window.localStorage.getItem(WIN_STREAK_WORKSHOP_STORAGE_KEY),
    ).toBeNull();
  });
});
