import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const generatorPath = resolve("scripts/generate-docs-html.mjs");
const temporaryRepositories: string[] = [];
const currentMarker =
  '<meta name="generated-by" content="scripts/generate-docs-html.mjs" />';

function initializeRepository() {
  const root = mkdtempSync(join(tmpdir(), "dranx-docs-generator-"));
  temporaryRepositories.push(root);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

function write(root: string, file: string, contents: string) {
  const absolutePath = join(root, file);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}

function stage(root: string, ...files: string[]) {
  execFileSync("git", ["add", "--", ...files], { cwd: root });
}

function runGenerator(root: string, ...args: string[]) {
  return runGeneratorWithEnvironment(root, {}, ...args);
}

function runGeneratorWithEnvironment(
  root: string,
  environment: Partial<NodeJS.ProcessEnv>,
  ...args: string[]
) {
  return spawnSync(process.execPath, [generatorPath, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C", ...environment },
  });
}

function allFiles(root: string, prefix = ""): string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = join(prefix, entry.name);
      return entry.isDirectory()
        ? allFiles(root, relativePath)
        : [relativePath];
    },
  );
}

function ownedHtml(source: string) {
  return `<!doctype html><html><head>${currentMarker}<meta name="canonical-source" content="${source}" /><meta name="canonical-source-sha256" content="${"0".repeat(64)}" /></head><body></body></html>`;
}

afterEach(() => {
  for (const root of temporaryRepositories.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("documentation HTML generator", () => {
  it("uses NUL-safe Git discovery, excludes private handoffs, and renders deterministic hashes and links", () => {
    const root = initializeRepository();
    const newlineDocument = "docs/line\nbreak.md";
    const readme = `# Café & guide

[Local guide](docs/Guide%20One.md#part)

[Uppercase extension](docs/Upper.MD?view=compact#part)

[External Markdown](https://example.com/file.md)

## Repeat

## Repeat
`;

    write(root, "README.md", readme);
    write(root, "docs/Guide One.md", "# Part\n");
    write(root, "docs/Upper.MD", "# Upper\n");
    write(root, newlineDocument, "# Line break\n");
    write(
      root,
      "premier-league-players-2026-08-13/private.md",
      "# Private handoff\n",
    );
    stage(
      root,
      "README.md",
      "docs/Guide One.md",
      "docs/Upper.MD",
      newlineDocument,
    );

    const firstRun = runGenerator(root);
    expect(firstRun.status, firstRun.stderr).toBe(0);

    const generated = readFileSync(join(root, "README.html"), "utf8");
    const expectedHash = createHash("sha256").update(readme).digest("hex");
    expect(generated).toContain(currentMarker);
    expect(generated).toContain(
      `<meta name="canonical-source-sha256" content="${expectedHash}" />`,
    );
    expect(generated).toContain('href="docs/Guide%20One.html#part"');
    expect(generated).toContain('href="docs/Upper.html?view=compact#part"');
    expect(generated).toContain('href="https://example.com/file.md"');
    expect(generated).toContain('<h1 id="cafe-guide">');
    expect(generated).toContain('<h2 id="repeat">');
    expect(generated).toContain('<h2 id="repeat-2">');
    expect(existsSync(join(root, "docs/line\nbreak.html"))).toBe(true);
    expect(
      existsSync(join(root, "premier-league-players-2026-08-13/private.html")),
    ).toBe(false);
    expect(allFiles(root).some((file) => file.includes(".tmp-"))).toBe(false);

    const secondRun = runGenerator(root);
    expect(secondRun.status, secondRun.stderr).toBe(0);
    expect(readFileSync(join(root, "README.html"), "utf8")).toBe(generated);

    const checkRun = runGenerator(root, "--check");
    expect(checkRun.status, checkRun.stderr).toBe(0);
  });

  it("reports missing and stale peers without changing them in check mode", () => {
    const root = initializeRepository();
    write(root, "guide.md", "# Guide\n");
    stage(root, "guide.md");

    const missingCheck = runGenerator(root, "--check");
    expect(missingCheck.status).toBe(1);
    expect(missingCheck.stderr).toContain('missing: "guide.html"');
    expect(existsSync(join(root, "guide.html"))).toBe(false);

    expect(runGenerator(root).status).toBe(0);
    const generated = readFileSync(join(root, "guide.html"), "utf8");
    write(root, "guide.md", "# Changed guide\n");

    const staleCheck = runGenerator(root, "--check");
    expect(staleCheck.status).toBe(1);
    expect(staleCheck.stderr).toContain('stale: "guide.html"');
    expect(readFileSync(join(root, "guide.html"), "utf8")).toBe(generated);
  });

  it("upgrades legacy ownership metadata and recognizes the current marker", () => {
    const root = initializeRepository();
    write(root, "guide.md", "# Guide\n");
    write(
      root,
      "guide.html",
      `<!doctype html><meta name="canonical-source" content="guide.md" /><meta name="canonical-source-sha256" content="${"0".repeat(64)}" />`,
    );
    stage(root, "guide.md", "guide.html");

    const generate = runGenerator(root);
    expect(generate.status, generate.stderr).toBe(0);
    expect(readFileSync(join(root, "guide.html"), "utf8")).toContain(
      currentMarker,
    );
    expect(runGenerator(root, "--check").status).toBe(0);
  });

  it("refuses to overwrite an unmanaged same-basename HTML file", () => {
    const root = initializeRepository();
    write(root, "guide.md", "# Guide\n");
    write(root, "guide.html", "<p>Hand maintained</p>\n");
    stage(root, "guide.md", "guide.html");

    const generate = runGenerator(root);
    expect(generate.status).toBe(1);
    expect(generate.stderr).toContain("Refusing unmanaged HTML collision");
    expect(readFileSync(join(root, "guide.html"), "utf8")).toBe(
      "<p>Hand maintained</p>\n",
    );
  });

  it("refuses two Markdown sources that map to the same HTML peer", () => {
    const root = initializeRepository();
    const fakeBin = join(root, "fake-bin");
    const fakeGit = join(fakeBin, "git");
    write(root, "guide.md", "# Lowercase guide\n");
    write(root, "guide.MD", "# Uppercase guide\n");
    write(
      root,
      "fake-bin/git",
      `#!/usr/bin/env node
process.stdout.write(Buffer.from(["guide.md", "guide.MD", ""].join("\\0")));
`,
    );
    chmodSync(fakeGit, 0o755);

    const generate = runGeneratorWithEnvironment(root, {
      PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
    });
    expect(generate.status).toBe(1);
    expect(generate.stderr).toContain("Refusing documentation peer collision");
    expect(generate.stderr).toContain('"guide.md"');
    expect(generate.stderr).toContain('"guide.MD"');
    expect(existsSync(join(root, "guide.html"))).toBe(false);
  });

  it("rejects Markdown source and HTML peer symlinks", () => {
    const sourceRoot = initializeRepository();
    write(sourceRoot, "target.md", "# Target\n");
    symlinkSync("target.md", join(sourceRoot, "linked.md"));
    stage(sourceRoot, "linked.md");

    const sourceRun = runGenerator(sourceRoot);
    expect(sourceRun.status).toBe(1);
    expect(sourceRun.stderr).toContain("Refusing source symlink");

    const peerRoot = initializeRepository();
    write(peerRoot, "guide.md", "# Guide\n");
    write(peerRoot, "target.html", "<p>Target</p>\n");
    symlinkSync("target.html", join(peerRoot, "guide.html"));
    stage(peerRoot, "guide.md", "guide.html", "target.html");

    const peerRun = runGenerator(peerRoot);
    expect(peerRun.status).toBe(1);
    expect(peerRun.stderr).toContain("Refusing HTML peer symlink");
    expect(readFileSync(join(peerRoot, "target.html"), "utf8")).toBe(
      "<p>Target</p>\n",
    );
  });

  it("reports and removes only marker-owned orphans", () => {
    const root = initializeRepository();
    write(root, "active.md", "# Active\n");
    stage(root, "active.md");
    expect(runGenerator(root).status).toBe(0);

    write(root, "orphan.html", ownedHtml("orphan.md"));
    write(root, "manual.html", "<p>Manual</p>\n");
    write(
      root,
      "premier-league-players-2026-08-13/private.html",
      ownedHtml("private.md"),
    );

    const checkRun = runGenerator(root, "--check");
    expect(checkRun.status).toBe(1);
    expect(checkRun.stderr).toContain('orphan: "orphan.html"');
    expect(existsSync(join(root, "orphan.html"))).toBe(true);

    const generate = runGenerator(root);
    expect(generate.status, generate.stderr).toBe(0);
    expect(existsSync(join(root, "orphan.html"))).toBe(false);
    expect(readFileSync(join(root, "manual.html"), "utf8")).toBe(
      "<p>Manual</p>\n",
    );
    expect(
      existsSync(join(root, "premier-league-players-2026-08-13/private.html")),
    ).toBe(true);
  });

  it.each(["unstaged", "staged"])(
    "treats a missing %s tracked Markdown source as deleted",
    (deletionState) => {
      const root = initializeRepository();
      write(root, "retired.md", "# Retired\n");
      stage(root, "retired.md");
      expect(runGenerator(root).status).toBe(0);
      stage(root, "retired.html");

      rmSync(join(root, "retired.md"));
      if (deletionState === "staged") {
        execFileSync("git", ["add", "--update", "--", "retired.md"], {
          cwd: root,
        });
      }

      const checkRun = runGenerator(root, "--check");
      expect(checkRun.status).toBe(1);
      expect(checkRun.stderr).toContain('orphan: "retired.html"');
      expect(existsSync(join(root, "retired.html"))).toBe(true);

      const generate = runGenerator(root);
      expect(generate.status, generate.stderr).toBe(0);
      expect(existsSync(join(root, "retired.html"))).toBe(false);
    },
  );

  it("rejects unknown or duplicate CLI flags without writing", () => {
    const root = initializeRepository();
    write(root, "guide.md", "# Guide\n");
    stage(root, "guide.md");

    for (const args of [["--chec"], ["--check", "--check"]]) {
      const result = runGenerator(root, ...args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Usage: node scripts/generate-docs-html.mjs [--check]",
      );
      expect(existsSync(join(root, "guide.html"))).toBe(false);
    }
  });
});
