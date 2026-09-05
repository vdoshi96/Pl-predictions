import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoringExample } from "@/components/scoring-example";

afterEach(cleanup);

describe("worked table scoring", () => {
  it("explains exact, across-half near, same-half, and missed predictions using real scoring", () => {
    render(<ScoringExample />);
    const predicted = screen.getByLabelText("Predicted position");
    const actual = screen.getByLabelText("Actual position");
    for (const [prediction, position, points] of [
      [4, 4, 5],
      [9, 12, 3],
      [1, 8, 1],
      [1, 20, 0],
    ]) {
      fireEvent.change(predicted, { target: { value: String(prediction) } });
      fireEvent.change(actual, { target: { value: String(position) } });
      expect(screen.getByRole("status")).toHaveTextContent(`${points} point`);
    }
  });
  it("does not display a score for empty, fractional, or out-of-range positions", () => {
    render(<ScoringExample />);
    for (const value of ["", "0", "21", "2.5"]) {
      fireEvent.change(screen.getByLabelText("Predicted position"), {
        target: { value },
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Enter whole positions from 1 to 20.",
      );
    }
  });
});
