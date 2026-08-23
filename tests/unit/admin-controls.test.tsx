import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/admin/actions", () => ({
  logoutAction: vi.fn(),
}));

import { AdminNav } from "../../src/app/admin/admin-nav";
import { isFinalStandingsCandidate } from "../../src/features/admin/finalization";

describe("administrator navigation", () => {
  it("shows every destination without a horizontal-scroll-only interaction", () => {
    render(<AdminNav current="/admin/settings" />);

    expect(
      screen.getByRole("navigation", { name: "Admin navigation" }),
    ).toBeVisible();
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute(
      "href",
      "/admin/results",
    );
    expect(screen.getByRole("link", { name: "Win Streak" })).toHaveAttribute(
      "href",
      "/admin/win-streak",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveClass(
      "min-h-11",
    );
  });
});

describe("standings finalization eligibility", () => {
  it("requires exactly 20 clubs with 38 played games each", () => {
    const complete = Array.from({ length: 20 }, () => ({ playedGames: 38 }));

    expect(isFinalStandingsCandidate(complete)).toBe(true);
    expect(isFinalStandingsCandidate(complete.slice(0, 19))).toBe(false);
    expect(
      isFinalStandingsCandidate(
        complete.map((item, index) =>
          index === 5 ? { playedGames: 37 } : item,
        ),
      ),
    ).toBe(false);
    expect(
      isFinalStandingsCandidate(
        complete.map((item, index) =>
          index === 5 ? { playedGames: null } : item,
        ),
      ),
    ).toBe(false);
  });
});
