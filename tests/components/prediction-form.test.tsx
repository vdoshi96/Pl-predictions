import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});

const teams: PredictionTeam[] = PREMIER_LEAGUE_2026_27_TEAMS.map((team) => ({
  id: team.slug,
  displayName: team.displayName,
  shortName: team.shortName,
  sortName: team.sortName,
  assetPath: team.assetPath,
}));

function SorterHarness({
  initialTeams = teams,
}: {
  initialTeams?: PredictionTeam[];
}) {
  const [orderedTeams, setOrderedTeams] = useState(initialTeams);

  return <PredictionSorter teams={orderedTeams} onChange={setOrderedTeams} />;
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
  it("normalizes the name, reviews all 20 rows, and emits a complete submission", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: /review your 1–20/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/submitting as/i)).toHaveTextContent(
      "Vishal Doshi",
    );
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(20);
    expect(within(dialog).getByText("Arsenal")).toBeVisible();
    expect(within(dialog).getByText("Tottenham Hotspur")).toBeVisible();
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
    fireEvent.click(screen.getByRole("button", { name: /review your 1–20/i }));

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

  it("uses a safe-area-aware sticky action at mobile widths", () => {
    render(<PredictionForm teams={teams} onSubmit={vi.fn()} />);

    const reviewButton = screen.getByRole("button", {
      name: /review your 1–20/i,
    });
    const stickyAction = reviewButton.parentElement;

    expect(stickyAction).toHaveClass("sticky", "bottom-0");
    expect(stickyAction?.className).toContain("safe-area-inset-bottom");
    expect(reviewButton).toHaveClass("w-full", "min-h-12");
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
      "grid-cols-3",
      "sm:flex",
    );
    expect(predictLink).toHaveAttribute("href", "/");
    expect(predictLink).toHaveClass(
      "min-h-12",
      "w-full",
      "min-w-0",
      "sm:w-auto",
    );
    expect(screen.getByRole("link", { name: /leaderboard/i })).toHaveAttribute(
      "href",
      "/leaderboard",
    );
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
