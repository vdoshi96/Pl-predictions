import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResultsPastePanel } from "@/app/admin/results/results-paste-panel";

const subjects = [
  { id: "p-haaland", names: ["Haaland"] },
  { id: "p-salah", names: ["Salah"] },
];

afterEach(cleanup);

describe("ResultsPastePanel", () => {
  it("parses and applies only matched rows", () => {
    const onApply = vi.fn();
    render(
      <ResultsPastePanel
        datasetLabel="Top scorer"
        disabled={false}
        metricKind="integer"
        onApply={onApply}
        subjects={subjects}
      />,
    );
    fireEvent.change(screen.getByLabelText("Paste top scorer list"), {
      target: { value: "Haaland 27\nMystery Player 12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse list" }));
    expect(screen.getByText(/1 line needs attention/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 row" }));
    expect(onApply).toHaveBeenCalledWith([
      { metricValue: 27, subjectId: "p-haaland" },
    ]);
  });

  it("clears the textarea after applying", () => {
    const onApply = vi.fn();
    render(
      <ResultsPastePanel
        datasetLabel="Top scorer"
        disabled={false}
        metricKind="integer"
        onApply={onApply}
        subjects={subjects}
      />,
    );
    const textarea = screen.getByLabelText("Paste top scorer list");
    fireEvent.change(textarea, { target: { value: "Haaland 27" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse list" }));
    fireEvent.click(screen.getByRole("button", { name: /Apply 1 row/ }));
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("disables inputs when disabled is true", () => {
    render(
      <ResultsPastePanel
        datasetLabel="Top scorer"
        disabled
        metricKind="integer"
        onApply={vi.fn()}
        subjects={subjects}
      />,
    );
    expect(
      (screen.getByLabelText("Paste top scorer list") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });
});
