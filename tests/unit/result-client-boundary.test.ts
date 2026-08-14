import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const resultsDeskPath = resolve(
  process.cwd(),
  "src/app/admin/results/results-desk.tsx",
);
const resultsIndexPath = resolve(
  process.cwd(),
  "src/features/results/index.ts",
);

describe("manual-results client boundary", () => {
  it("keeps the client desk off the server-only results barrel", async () => {
    const [resultsDesk, resultsIndex] = await Promise.all([
      readFile(resultsDeskPath, "utf8"),
      readFile(resultsIndexPath, "utf8"),
    ]);

    expect(resultsDesk).toContain('from "@/features/results/types";');
    expect(resultsDesk).not.toContain('from "@/features/results";');
    expect(resultsIndex).toMatch(/^import "server-only";/u);
  });
});
