import { describe, expect, it } from "vitest";

import {
  HOME_SPOTLIGHT_MESSAGE,
  RULES_PENDING_RESULTS_MESSAGE,
  SPOTLIGHT_SCORING_MESSAGE,
} from "@/content/public-copy";

describe("participant-facing result copy", () => {
  it("uses the approved home and spotlight explanations verbatim", () => {
    expect(HOME_SPOTLIGHT_MESSAGE).toBe(
      "Spotlight picks have a separate just-for-fun score. The owner will add the five remaining result lists after they have been reviewed.",
    );
    expect(SPOTLIGHT_SCORING_MESSAGE).toBe(
      "Your pick earns more spotlight points the higher that player or club finishes in its result list. Only ready result lists count.",
    );
  });

  it("keeps pending semantics plain and excludes internal process language", () => {
    expect(RULES_PENDING_RESULTS_MESSAGE).toContain(
      "pending and do not count against anyone",
    );
    for (const message of [
      HOME_SPOTLIGHT_MESSAGE,
      SPOTLIGHT_SCORING_MESSAGE,
      RULES_PENDING_RESULTS_MESSAGE,
    ]) {
      expect(message).not.toMatch(/Codex|automation|scraper|cron|formula/iu);
    }
  });
});
