import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  AdminStatusBoard,
  buildAdminStatusRows,
  type AdminStatusInput,
} from "@/features/admin/status-board";

afterEach(cleanup);

const input: AdminStatusInput = {
  datasets: [
    {
      active: {
        capturedAt: new Date("2026-09-20T18:13:00.000Z"),
        coveredThroughRank: 14,
      },
      dataset: "goals",
      hasUnpublishedDraft: false,
      isFinal: false,
    },
    {
      active: {
        capturedAt: new Date("2026-09-20T18:13:00.000Z"),
        coveredThroughRank: 14,
      },
      dataset: "assists",
      hasUnpublishedDraft: true,
      isFinal: false,
    },
    {
      active: null,
      dataset: "clean_sheets",
      hasUnpublishedDraft: false,
      isFinal: false,
    },
    {
      active: {
        capturedAt: new Date("2026-09-20T18:13:00.000Z"),
        coveredThroughRank: null,
      },
      dataset: "player_ratings",
      hasUnpublishedDraft: false,
      isFinal: true,
    },
  ],
  standings: {
    capturedAt: new Date("2026-09-20T18:13:00.000Z"),
    isFinal: false,
  },
  winStreak: { matchweek: 5, readyToResolve: true },
};

describe("buildAdminStatusRows", () => {
  it("summarises every owner dataset in a fixed order", () => {
    expect(buildAdminStatusRows(input)).toEqual([
      {
        actionLabel: "Import standings",
        attention: false,
        draft: "—",
        href: "/admin/standings",
        key: "standings",
        label: "Standings",
        publicVersion: "Sun 20 Sep, 1:13 pm CDT",
      },
      {
        actionLabel: "Update",
        attention: false,
        draft: "—",
        href: "/admin/results",
        key: "goals",
        label: "Goals",
        publicVersion: "Sun 20 Sep, 1:13 pm CDT · to rank 14",
      },
      {
        actionLabel: "Review & publish",
        attention: true,
        draft: "Saved draft not published",
        href: "/admin/results",
        key: "assists",
        label: "Assists",
        publicVersion: "Sun 20 Sep, 1:13 pm CDT · to rank 14",
      },
      {
        actionLabel: "Enter results",
        attention: true,
        draft: "—",
        href: "/admin/results",
        key: "clean_sheets",
        label: "Clean sheets",
        publicVersion: "Not published",
      },
      {
        actionLabel: "Update",
        attention: false,
        draft: "—",
        href: "/admin/results",
        key: "player_ratings",
        label: "Player ratings",
        publicVersion: "Sun 20 Sep, 1:13 pm CDT · Final",
      },
      {
        actionLabel: "Resolve round",
        attention: true,
        draft: "—",
        href: "/admin/win-streak",
        key: "win-streak",
        label: "Win Streak MW5",
        publicVersion: "Unresolved",
      },
    ]);
  });

  it("describes empty standings and a finished or waiting Win Streak", () => {
    const rows = buildAdminStatusRows({
      ...input,
      standings: null,
      winStreak: { matchweek: 6, readyToResolve: false },
    });
    expect(rows[0]).toMatchObject({
      attention: true,
      publicVersion: "None",
    });
    expect(rows.at(-1)).toMatchObject({
      actionLabel: "Waiting for kickoffs",
      attention: false,
      label: "Win Streak MW6",
    });

    expect(
      buildAdminStatusRows({ ...input, winStreak: null }).at(-1),
    ).toMatchObject({
      actionLabel: "Open",
      attention: false,
      label: "Win Streak",
      publicVersion: "All rounds resolved",
    });
  });
});

describe("AdminStatusBoard", () => {
  it("renders one row per dataset with an action link and attention marker", () => {
    render(<AdminStatusBoard rows={buildAdminStatusRows(input)} />);
    const table = screen.getByRole("table", { name: "Dataset status" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Dataset", "Public version", "Draft", "Action"]);

    const assists = rows[3]!;
    expect(
      within(assists).getByRole("rowheader", { name: "Assists" }),
    ).toBeVisible();
    expect(
      within(assists).getByRole("link", { name: "Review & publish" }),
    ).toHaveAttribute("href", "/admin/results");
    expect(within(assists).getByText("Needs attention")).toHaveClass("sr-only");
    expect(within(rows[2]!).queryByText("Needs attention")).toBeNull();
  });
});
