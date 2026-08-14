import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
} from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

export const GENERATOR_ID = "scripts/generate-docs-html.mjs";
export const CURRENT_OWNER_MARKER = `<meta name="generated-by" content="${GENERATOR_ID}" />`;

const PRIVATE_ROOTS = new Set([
  ".agents",
  ".codex",
  ".git",
  ".next",
  ".playwright-cli",
  ".vercel",
  "Premier League 2026-27 PNG Assets",
  "References",
  "coverage",
  "node_modules",
  "out",
  "output",
  "playwright-report",
  "test-results",
]);

const PRIVATE_PREFIXES = ["premier-league-players-"];
const PRIVATE_PATH_PREFIXES = ["docs/assets/"];

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function displayPath(file) {
  return JSON.stringify(file);
}

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function htmlUnescape(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function metaContent(html, name) {
  const escapedName = name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(
    new RegExp(`<meta\\s+[^>]*name=["']${escapedName}["'][^>]*>`, "i"),
  )?.[0];
  if (!tag) return null;

  const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
  return content === undefined ? null : htmlUnescape(content);
}

function ownershipFor(html) {
  const generator = metaContent(html, "generated-by");
  const canonicalSource = metaContent(html, "canonical-source");
  const sourceHash = metaContent(html, "canonical-source-sha256");

  if (generator === GENERATOR_ID) {
    return { kind: "current", canonicalSource, sourceHash };
  }

  if (canonicalSource !== null && /^[a-f0-9]{64}$/.test(sourceHash ?? "")) {
    return { kind: "legacy", canonicalSource, sourceHash };
  }

  return null;
}

function splitNulBuffer(buffer) {
  const values = [];
  let start = 0;

  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) continue;
    values.push(buffer.subarray(start, index).toString("utf8"));
    start = index + 1;
  }

  if (start !== buffer.length) {
    throw new Error("Git returned a non-NUL-terminated file inventory.");
  }

  return values.filter(Boolean);
}

function gitInventory(projectRoot) {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: projectRoot, encoding: "buffer" },
  );
  return splitNulBuffer(output);
}

function isPrivatePath(file) {
  const normalized = file.replaceAll("\\", "/");
  const root = normalized.split("/", 1)[0];
  return (
    PRIVATE_ROOTS.has(root) ||
    PRIVATE_PREFIXES.some((prefix) => root.startsWith(prefix)) ||
    PRIVATE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function validateInventoryPath(file) {
  if (
    file.length === 0 ||
    isAbsolute(file) ||
    file.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(
      `Git returned an unsafe documentation path: ${displayPath(file)}`,
    );
  }
}

function lstatIfPresent(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function requireRegularFile(absolutePath, relativePath, kind) {
  const stats = lstatIfPresent(absolutePath);
  if (!stats) return null;
  if (stats.isSymbolicLink()) {
    throw new Error(
      `Refusing ${kind} symlink ${displayPath(relativePath)}; documentation sources and peers must be regular files.`,
    );
  }
  if (!stats.isFile()) {
    throw new Error(
      `Refusing non-file ${kind} path ${displayPath(relativePath)}.`,
    );
  }
  return stats;
}

function titleFor(markdown, file) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(file, ".md");
}

function slugBase(value) {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replaceAll(/[\u0300-\u036f]/g, "")
      .replaceAll(/[^a-z0-9\s_-]/g, "")
      .trim()
      .replaceAll(/[\s_]+/g, "-")
      .replaceAll(/-+/g, "-") || "section"
  );
}

function renderMarkdown(markdown) {
  const slugCounts = new Map();
  const renderer = {
    heading({ tokens, depth }) {
      const headingHtml = this.parser.parseInline(tokens);
      const headingText = this.parser.parseInline(
        tokens,
        this.parser.textRenderer,
      );
      const base = slugBase(headingText);
      const count = (slugCounts.get(base) ?? 0) + 1;
      slugCounts.set(base, count);
      const slug = count === 1 ? base : `${base}-${count}`;
      return `<h${depth} id="${htmlEscape(slug)}">${headingHtml}</h${depth}>\n`;
    },
  };
  const parser = new Marked({ gfm: true, breaks: false, renderer });
  const parsed = parser.parse(markdown);
  if (typeof parsed !== "string") {
    throw new Error(
      "The Markdown renderer unexpectedly returned async output.",
    );
  }
  return rewriteMarkdownLinks(parsed);
}

function rewriteMarkdownLinks(html) {
  return html.replaceAll(/href="([^"]*)"/g, (match, href) => {
    if (
      href.startsWith("#") ||
      href.startsWith("?") ||
      href.startsWith("/") ||
      href.startsWith("//") ||
      /^[a-z][a-z0-9+.-]*:/i.test(href)
    ) {
      return match;
    }

    const parts = href.match(/^([^?#]*)([?#].*)?$/);
    if (!parts?.[1].toLowerCase().endsWith(".md")) return match;
    return `href="${parts[1].slice(0, -3)}.html${parts[2] ?? ""}"`;
  });
}

function render(file, sourceBytes) {
  const markdown = sourceBytes.toString("utf8");
  const digest = createHash("sha256").update(sourceBytes).digest("hex");
  const title = titleFor(markdown, file);
  const sourceLink = basename(file);
  const sourceHref = encodeURIComponent(sourceLink);
  const rendered = renderMarkdown(markdown);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${CURRENT_OWNER_MARKER}
    <meta name="canonical-source" content="${htmlEscape(sourceLink)}" />
    <meta name="canonical-source-sha256" content="${digest}" />
    <title>${htmlEscape(title)}</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #f5f5f0; color: #18201c; }
      main { box-sizing: border-box; width: min(100% - 2rem, 880px); margin: 2rem auto; padding: clamp(1.25rem, 4vw, 3rem); background: #fff; border: 1px solid #d9ddd8; border-radius: 1rem; box-shadow: 0 18px 60px rgb(22 31 26 / 8%); }
      h1, h2, h3 { line-height: 1.15; color: #102d22; }
      h1 { font-size: clamp(2rem, 5vw, 3.25rem); letter-spacing: -.04em; }
      h2 { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #e2e6e2; }
      p, li { line-height: 1.7; }
      a { color: #087854; text-underline-offset: .2em; }
      code { padding: .12rem .35rem; border-radius: .3rem; background: #edf1ed; font-size: .92em; }
      pre { overflow-x: auto; padding: 1rem; border-radius: .65rem; background: #111a16; color: #edf8f2; }
      pre code { padding: 0; background: transparent; }
      table { display: block; overflow-x: auto; width: 100%; border-collapse: collapse; }
      th, td { padding: .65rem .8rem; border: 1px solid #d9ddd8; text-align: left; vertical-align: top; }
      th { background: #edf4ef; }
      img { max-width: 100%; height: auto; border-radius: .75rem; }
      blockquote { margin-left: 0; padding-left: 1rem; border-left: .25rem solid #1b9a6c; color: #49564f; }
      .source { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #d9ddd8; color: #627069; font-size: .85rem; }
      @media (prefers-color-scheme: dark) {
        body { background: #0e1512; color: #e5ebe7; }
        main { background: #16201b; border-color: #34423a; }
        h1, h2, h3 { color: #f2fff8; }
        h2, .source { border-color: #34423a; }
        a { color: #58ddb0; }
        code, th { background: #24322b; }
        th, td { border-color: #3b4b42; }
        blockquote { color: #b5c2bb; }
      }
    </style>
  </head>
  <body>
    <main>
      ${rendered}
      <p class="source">Generated deterministically from <a href="${htmlEscape(sourceHref)}">${htmlEscape(file)}</a>. Canonical SHA-256: <code>${digest}</code>.</p>
    </main>
  </body>
</html>
`;
}

function htmlPathFor(source) {
  return join(dirname(source), `${basename(source, extname(source))}.html`);
}

function atomicWrite(absolutePath, contents, counter) {
  const temporaryPath = join(
    dirname(absolutePath),
    `.${basename(absolutePath)}.tmp-${process.pid}-${counter}`,
  );

  try {
    writeFileSync(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o644,
    });
    renameSync(temporaryPath, absolutePath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (
        !cleanupError ||
        typeof cleanupError !== "object" ||
        cleanupError.code !== "ENOENT"
      ) {
        throw cleanupError;
      }
    }
    throw error;
  }
}

export function generateDocumentation({
  projectRoot = process.cwd(),
  checkOnly = false,
} = {}) {
  const inventory = gitInventory(projectRoot);
  inventory.forEach(validateInventoryPath);

  const scopedInventory = inventory
    .filter((file) => !isPrivatePath(file))
    .sort(comparePaths);
  const markdownFiles = scopedInventory.filter((file) => {
    if (extname(file).toLowerCase() !== ".md") return false;
    return requireRegularFile(join(projectRoot, file), file, "source") !== null;
  });
  const markdownSet = new Set(markdownFiles);
  const expectedByHtml = new Map();
  const changes = [];

  for (const file of markdownFiles) {
    const htmlPath = htmlPathFor(file);
    const existingTarget = expectedByHtml.get(htmlPath);
    if (existingTarget) {
      throw new Error(
        `Refusing documentation peer collision at ${displayPath(htmlPath)} because both ${displayPath(existingTarget.file)} and ${displayPath(file)} map to it.`,
      );
    }

    const absoluteSource = join(projectRoot, file);
    const sourceStats = requireRegularFile(absoluteSource, file, "source");
    if (!sourceStats) {
      throw new Error(
        `Git-listed Markdown source is missing: ${displayPath(file)}`,
      );
    }

    const absoluteHtml = join(projectRoot, htmlPath);
    const expected = render(file, readFileSync(absoluteSource));
    const htmlStats = requireRegularFile(absoluteHtml, htmlPath, "HTML peer");
    let current = null;

    if (htmlStats) {
      current = readFileSync(absoluteHtml, "utf8");
      const ownership = ownershipFor(current);
      if (!ownership) {
        throw new Error(
          `Refusing unmanaged HTML collision at ${displayPath(htmlPath)}.`,
        );
      }
      if (
        ownership.canonicalSource !== null &&
        ownership.canonicalSource !== basename(file)
      ) {
        throw new Error(
          `Refusing generated HTML collision at ${displayPath(htmlPath)} because it names ${displayPath(ownership.canonicalSource)} as its canonical source.`,
        );
      }
    }

    expectedByHtml.set(htmlPath, { file, absoluteHtml, expected });
    if (current !== expected) {
      changes.push({
        kind: current === null ? "missing" : "stale",
        path: htmlPath,
        absoluteHtml,
        expected,
      });
    }
  }

  const orphans = [];
  const htmlFiles = scopedInventory.filter(
    (file) => extname(file).toLowerCase() === ".html",
  );

  for (const htmlFile of htmlFiles) {
    if (expectedByHtml.has(htmlFile)) continue;

    const absoluteHtml = join(projectRoot, htmlFile);
    const stats = requireRegularFile(absoluteHtml, htmlFile, "HTML file");
    if (!stats) continue;
    const ownership = ownershipFor(readFileSync(absoluteHtml, "utf8"));
    if (!ownership) continue;
    if (ownership.canonicalSource === null) {
      throw new Error(
        `Generated HTML ${displayPath(htmlFile)} is missing canonical-source metadata.`,
      );
    }
    if (
      basename(ownership.canonicalSource) !== ownership.canonicalSource ||
      extname(ownership.canonicalSource).toLowerCase() !== ".md"
    ) {
      throw new Error(
        `Generated HTML ${displayPath(htmlFile)} has an unsafe canonical source ${displayPath(ownership.canonicalSource)}.`,
      );
    }

    const source = join(dirname(htmlFile), ownership.canonicalSource);
    if (!markdownSet.has(source) || htmlPathFor(source) !== htmlFile) {
      orphans.push({ path: htmlFile, absoluteHtml });
    }
  }

  if (checkOnly && (changes.length > 0 || orphans.length > 0)) {
    const details = [
      ...changes.map(({ kind, path }) => `${kind}: ${displayPath(path)}`),
      ...orphans.map(({ path }) => `orphan: ${displayPath(path)}`),
    ];
    throw new Error(
      `Documentation HTML is stale, missing, or orphaned:\n${details.join("\n")}`,
    );
  }

  if (!checkOnly) {
    changes.forEach(({ absoluteHtml, expected }, index) => {
      atomicWrite(absoluteHtml, expected, index);
    });
    orphans.forEach(({ absoluteHtml }) => unlinkSync(absoluteHtml));
  }

  return {
    markdownCount: markdownFiles.length,
    changedCount: changes.length,
    orphanCount: orphans.length,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    throw new Error(`Usage: node ${GENERATOR_ID} [--check]`);
  }

  const checkOnly = args[0] === "--check";
  const result = generateDocumentation({ checkOnly });
  process.stdout.write(
    checkOnly
      ? `Documentation parity verified for ${result.markdownCount} Markdown files.\n`
      : `Generated ${result.markdownCount} HTML documentation peers (${result.changedCount} written, ${result.orphanCount} orphaned peers removed).\n`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
