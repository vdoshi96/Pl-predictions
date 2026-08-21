import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data";
import { buildTeamNameIndex } from "@/data/team-name-aliases";
import { describe, expect, it } from "vitest";

describe("buildTeamNameIndex", () => {
  const index = buildTeamNameIndex(PREMIER_LEAGUE_2026_27_TEAMS);

  it("resolves canonical display names case-insensitively", () => {
    expect(index.get("manchester city")).toBe("manchester-city");
    expect(index.get("brighton & hove albion")).toBe(
      "brighton-and-hove-albion",
    );
  });

  it("resolves short names and curated aliases", () => {
    expect(index.get("spurs")).toBe("tottenham-hotspur");
    expect(index.get("man utd")).toBe("manchester-united");
    expect(index.get("villa")).toBe("aston-villa");
    expect(index.get("palace")).toBe("crystal-palace");
  });

  it("never maps a key to two slugs and contains exactly the active clubs", () => {
    const slugs = new Set(index.values());
    expect(slugs.size).toBe(20);
    for (const slug of slugs) {
      expect(
        PREMIER_LEAGUE_2026_27_TEAMS.some((team) => team.slug === slug),
      ).toBe(true);
    }
  });

  it("returns undefined for unknown clubs", () => {
    expect(index.get("bayern munich")).toBeUndefined();
  });
});
