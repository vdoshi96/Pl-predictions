import { describe, expect, it } from "vitest";

import { normalizeForMatch } from "@/shared/text-normalization";

describe("normalizeForMatch", () => {
  it("lowercases and strips punctuation and diacritics", () => {
    expect(normalizeForMatch("Man City")).toBe("man city");
    expect(normalizeForMatch("Brighton & Hove Albion")).toBe(
      "brighton and hove albion",
    );
    expect(normalizeForMatch("Nott'm Forest")).toBe("nott m forest");
    expect(normalizeForMatch("  Crystal---Palace! ")).toBe("crystal palace");
  });

  it("collapses whitespace and returns empty for symbols only", () => {
    expect(normalizeForMatch("--- *** ---")).toBe("");
    expect(normalizeForMatch("A  B")).toBe("a b");
  });
});
