import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("theme contract", () => {
  it("publishes light and dark browser colors backed by a complete dark token set", async () => {
    const [css, layout] = await Promise.all([
      readFile(path.join(root, "src/app/globals.css"), "utf8"),
      readFile(path.join(root, "src/app/layout.tsx"), "utf8"),
    ]);

    expect(css).toContain("color-scheme: light dark");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toMatch(/--background:\s*#17041a/u);
    expect(css).toMatch(/--surface:\s*#23102a/u);
    expect(css).toMatch(/--foreground:\s*#f3e9f5/u);
    expect(css).toMatch(/--accent-ink:\s*#26002d/u);
    expect(layout).toContain('media: "(prefers-color-scheme: dark)"');
    expect(layout).toContain('color: "#17041a"');
  });
});
