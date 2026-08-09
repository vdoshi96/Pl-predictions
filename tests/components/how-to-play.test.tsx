import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HowToPlay } from "@/components/how-to-play";

afterEach(cleanup);

describe("HowToPlay", () => {
  it("shows three annotated steps backed by live mobile screenshots", () => {
    render(<HowToPlay />);

    expect(
      screen.getByRole("heading", { name: "How to play in three steps" }),
    ).toBeVisible();
    expect(
      screen.getByText(/captured from the live mobile site/iu),
    ).toBeVisible();

    for (const heading of [
      "Build your 1–20 table",
      "Make seven spotlight picks",
      "Review once, then submit",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }

    const screenshots = screen.getAllByRole("img");
    expect(screenshots).toHaveLength(3);
    expect(screenshots.map((image) => image.getAttribute("src"))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("step-1-table-mobile.png"),
        expect.stringContaining("step-2-spotlight-mobile.png"),
        expect.stringContaining("step-3-review-mobile.png"),
      ]),
    );

    expect(
      screen.getByText(/Use the six-dot handles to drag clubs/iu),
    ).toBeVisible();
    expect(screen.getByText(/Complete all seven categories/iu)).toBeVisible();
    expect(
      screen.getByText(/Confirm the review shows 20 clubs/iu),
    ).toBeVisible();
  });
});
