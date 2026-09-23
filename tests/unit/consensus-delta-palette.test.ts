import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve("src/app/globals.css"), "utf8");

// The first declaration of a token is the light :root value. The last one is
// the dark override, or the light value again when the token does not change.
function tokenValues(name: string): { dark: string; light: string } {
  const pattern = new RegExp(String.raw`--${name}:\s*(#[\da-f]{6});`, "gi");
  const values = [...styles.matchAll(pattern)].map((match) => match[1]!);
  const light = values[0];
  const dark = values.at(-1);
  if (!light || !dark) throw new Error(`Missing --${name} token.`);
  return { dark, light };
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
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(left: string, right: string): number {
  const [light, dark] = [
    relativeLuminance(left),
    relativeLuminance(right),
  ].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

const gapPairs = [
  "gap-neutral",
  "gap-positive-slight",
  "gap-positive-clear",
  "gap-positive-far",
  "gap-negative-slight",
  "gap-negative-clear",
  "gap-negative-far",
] as const;

const scorePairs = [
  "score-exact",
  "score-within",
  "score-half",
  "score-miss",
] as const;

describe("score and gap palettes", () => {
  it.each([...gapPairs, ...scorePairs])(
    "keeps %s text at 4.5:1 or better in both themes",
    (pair) => {
      const background = tokenValues(`${pair}-bg`);
      const ink = tokenValues(`${pair}-ink`);
      expect(contrast(background.light, ink.light)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(background.dark, ink.dark)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["positive", "negative"] as const)(
    "darkens the light %s gap fill as the gap grows",
    (direction) => {
      const slight = relativeLuminance(
        tokenValues(`gap-${direction}-slight-bg`).light,
      );
      const clear = relativeLuminance(
        tokenValues(`gap-${direction}-clear-bg`).light,
      );
      const far = relativeLuminance(
        tokenValues(`gap-${direction}-far-bg`).light,
      );
      expect(clear).toBeLessThan(slight);
      expect(far).toBeLessThan(clear);
    },
  );

  it("styles every consensus-delta rule through gap tokens only", () => {
    const rules = [
      ...styles.matchAll(/\.consensus-delta\[[^{]+\{([^}]*)\}/gu),
    ].map((match) => match[1]!);
    expect(rules.length).toBeGreaterThanOrEqual(7);
    for (const body of rules) {
      expect(body).toContain("var(--gap-");
      expect(body).not.toMatch(/#[\da-f]{3,6}/iu);
    }
    expect(styles).toMatch(
      /\.consensus-delta\[data-band="neutral"\]\s*\{[^}]*var\(--gap-neutral-bg\)/u,
    );
  });

  it("styles every score tier through score tokens", () => {
    for (const [tier, token] of [
      ["exact", "score-exact"],
      ["within-three", "score-within"],
      ["correct-half", "score-half"],
      ["miss", "score-miss"],
    ] as const) {
      expect(styles).toMatch(
        new RegExp(
          String.raw`\.score-pill\[data-tier="${tier}"\]\s*\{[^}]*background:\s*var\(--${token}-bg\);[^}]*color:\s*var\(--${token}-ink\);`,
          "u",
        ),
      );
    }
  });
});
