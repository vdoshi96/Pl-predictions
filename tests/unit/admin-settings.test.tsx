import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../../src/app/admin/settings/actions", () => ({
  closeSeasonPermanently: vi.fn(async () => ({
    changed: true,
    message: "Season closed.",
    ok: true,
  })),
}));

import {
  DeadlineTimeZones,
  formatDeadlineInTimeZone,
} from "../../src/app/admin/settings/deadline-timezones";
import { IrreversibleSeasonAction } from "../../src/app/admin/settings/irreversible-season-action";

const kickoffIso = "2026-08-21T19:00:00.000Z";

describe("admin deadline display", () => {
  it("uses IANA daylight-saving labels for the same kickoff instant", () => {
    expect(formatDeadlineInTimeZone(kickoffIso, "America/Chicago")).toContain(
      "2:00 PM CDT",
    );
    expect(
      formatDeadlineInTimeZone(kickoffIso, "America/Los_Angeles"),
    ).toContain("12:00 PM PDT");
    expect(formatDeadlineInTimeZone(kickoffIso, "UTC")).toContain(
      "7:00 PM UTC",
    );
    expect(
      formatDeadlineInTimeZone("2026-12-21T19:00:00.000Z", "America/Chicago"),
    ).toContain("1:00 PM CST");
  });

  it("keeps Central visible while converting the selected view", () => {
    render(
      <DeadlineTimeZones
        deadlineIso={kickoffIso}
        initialRemainingSeconds={60}
      />,
    );

    expect(screen.getByText("Central Time baseline")).toBeVisible();
    expect(screen.getAllByText(/2:00 PM CDT/u)).toHaveLength(2);

    fireEvent.change(
      screen.getByLabelText("View kickoff in another time zone"),
      { target: { value: "America/Los_Angeles" } },
    );

    expect(screen.getByText(/12:00 PM PDT/u)).toBeVisible();
    expect(screen.getByText("Central Time baseline")).toBeVisible();
  });
});

describe("irreversible season action", () => {
  it("requires the exact typed phrase before enabling submission", () => {
    render(
      <IrreversibleSeasonAction
        confirmationPhrase="LOCK"
        description="Close and reveal."
        disabled={false}
        intent="lock"
        title="Lock submissions now"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Lock submissions now" }),
    );
    const confirm = screen.getByRole("button", { name: "Confirm LOCK" });
    const input = screen.getByLabelText("Type LOCK to confirm");

    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "lock" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "LOCK" } });
    expect(confirm).toBeEnabled();
  });

  it("does not expose an actionable trigger after closure", () => {
    render(
      <IrreversibleSeasonAction
        confirmationPhrase="REVEAL"
        description="Close and reveal."
        disabled
        intent="reveal"
        title="Reveal predictions early"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Season permanently closed" }),
    ).toBeDisabled();
  });

  it("cancels without submitting and clears a typed phrase", async () => {
    render(
      <IrreversibleSeasonAction
        confirmationPhrase="LOCK"
        description="Close and reveal."
        disabled={false}
        intent="lock"
        title="Lock submissions now"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Lock submissions now" }),
    );
    fireEvent.change(screen.getByLabelText("Type LOCK to confirm"), {
      target: { value: "LOCK" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Lock submissions now" }),
    );
    expect(screen.getByLabelText("Type LOCK to confirm")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirm LOCK" })).toBeDisabled();
  });
});
