import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaderboardEntryLink } from "@/features/leaderboard/entry-link";

describe("LeaderboardEntryLink", () => {
  it("keeps long participant names wrapped with a persistent touch affordance", () => {
    const participantName = "A".repeat(40);

    render(
      <LeaderboardEntryLink
        entryId="00000000-0000-4000-8000-000000000001"
        participantName={participantName}
      />,
    );

    const link = screen.getByRole("link", { name: participantName });
    expect(link).toHaveAttribute(
      "href",
      "/entries/00000000-0000-4000-8000-000000000001",
    );
    expect(link).toHaveClass(
      "[overflow-wrap:break-word]",
      "underline",
      "decoration-2",
    );
    expect(link).not.toHaveClass("[overflow-wrap:anywhere]");
    expect(link).not.toHaveClass("truncate");
  });
});
