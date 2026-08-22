import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { importCanonicalStandings } from "@/features/standings/importer";

export {
  importCanonicalStandings,
  snapshotContentHash,
  standingsActivationGuard,
} from "@/features/standings/importer";

async function readInput(path: string | undefined): Promise<string> {
  if (path) return readFile(path, "utf8");

  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main(): Promise<void> {
  const rawInput = await readInput(process.argv[2]);
  const parsed: unknown = JSON.parse(rawInput);
  const result = await importCanonicalStandings(parsed);
  process.stdout.write(`Standings import ${result.status}: ${result.runId}.\n`);
  if (result.status === "failed") process.exitCode = 1;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown standings import error";
    process.stderr.write(`Standings import failed: ${message}\n`);
    process.exitCode = 1;
  });
}
