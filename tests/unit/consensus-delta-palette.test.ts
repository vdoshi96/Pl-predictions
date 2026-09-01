import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve("src/app/globals.css"), "utf8");

function lastBackground(
  direction: "negative" | "positive",
  band: "far" | "slight",
) {
  const pattern = new RegExp(
    String.raw`\.consensus-delta\[data-direction="${direction}"\]\[data-band="${band}"\]\s*\{[^}]*background:\s*(#[\da-f]+);`,
    "gi",
  );
  const colors = [...styles.matchAll(pattern)].map((match) => match[1]);
  const color = colors.at(-1);
  if (!color) throw new Error(`Missing ${direction} ${band} delta color.`);
  return color;
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  if (!channels || channels.length !== 3)
    throw new Error("Expected an RGB hex color.");
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

describe("dark consensus delta palette", () => {
  it.each(["negative", "positive"] as const)(
    "keeps the far %s band darker than the slight band",
    (direction) => {
      expect(relativeLuminance(lastBackground(direction, "far"))).toBeLessThan(
        relativeLuminance(lastBackground(direction, "slight")),
      );
    },
  );
});
