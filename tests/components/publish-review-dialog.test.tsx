import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublishReviewDialog } from "@/app/admin/results/publish-review-dialog";

const diff = {
  addedCount: 1,
  changedCount: 1,
  entries: [
    {
      kind: "changed",
      label: "Haaland",
      newMetric: 30,
      newRank: 1,
      oldMetric: 27,
      oldRank: 1,
      subjectId: "a",
    },
    {
      kind: "added",
      label: "Wilson",
      newMetric: 12,
      newRank: 3,
      oldMetric: null,
      oldRank: null,
      subjectId: "c",
    },
  ],
  removedCount: 0,
} as const;

const base = {
  attestationSentence:
    "I attest that all rows through rank 5, including boundary ties, are present in this exact draft.",
  boundaryWarnings: [],
  busy: false,
  coveredThroughRank: 5,
  datasetLabel: "Top scorer",
  diff,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  requiredRank: 5,
  unresolvedAliasCount: 0,
};

afterEach(cleanup);

describe("PublishReviewDialog", () => {
  it("renders the diff and requires attestation before confirming", () => {
    render(<PublishReviewDialog {...base} />);
    expect(screen.getByText(/Haaland/)).toBeTruthy();
    const confirm = screen.getByRole("button", {
      name: "Publish provisional",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publish provisional",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("blocks when aliases are unresolved and shows the warning", () => {
    render(<PublishReviewDialog {...base} unresolvedAliasCount={2} />);
    expect(screen.getByText(/2 Other-player match(es)? pending/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publish provisional",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows boundary tie warnings without blocking", () => {
    render(
      <PublishReviewDialog
        {...base}
        boundaryWarnings={[
          {
            boundaryRank: 5,
            direction: "descending",
            tiedCount: 2,
            tiedValue: 14,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Tie at 14 spans rank 5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publish provisional",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("calls onCancel and onConfirm", () => {
    const onConfirm = vi.fn();
    render(<PublishReviewDialog {...base} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Publish provisional" }),
    );
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(base.onCancel).toHaveBeenCalled();
  });
});
