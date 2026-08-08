import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChampionPick } from "@/features/leaderboard/champion-pick";

const champion = {
  actualPosition: null,
  assetPath: "/team-marks/arsenal.png",
  displayName: "Arsenal",
  shortName: "Arsenal",
};

describe("ChampionPick", () => {
  it("shows only the predicted champion before scoring starts", () => {
    render(<ChampionPick champion={champion} />);

    expect(
      screen.getByLabelText("Predicted champion: Arsenal"),
    ).toBeInTheDocument();
    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.queryByText(/track/u)).not.toBeInTheDocument();
  });

  it("labels a first-place champion as on track", () => {
    render(<ChampionPick champion={{ ...champion, actualPosition: 1 }} />);

    expect(screen.getByText("On track · 1st")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Arsenal is on track, currently 1st"),
    ).toBeInTheDocument();
  });

  it("shows the current position when a champion is off track", () => {
    render(<ChampionPick champion={{ ...champion, actualPosition: 12 }} />);

    expect(screen.getByText("Off track · 12th")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Arsenal is off track, currently 12th"),
    ).toBeInTheDocument();
  });
});
