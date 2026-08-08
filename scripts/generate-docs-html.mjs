import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import process from "node:process";
import { marked } from "marked";

const projectRoot = process.cwd();
const checkOnly = process.argv.includes("--check");

const markdownFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "*.md", "**/*.md"],
  { cwd: projectRoot, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.startsWith(".agents/"))
  .sort();

marked.use({ gfm: true, breaks: false });

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function titleFor(markdown, file) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(file, ".md");
}

function render(file) {
  const absoluteSource = join(projectRoot, file);
  const markdown = readFileSync(absoluteSource, "utf8");
  const digest = createHash("sha256").update(markdown).digest("hex");
  const title = titleFor(markdown, file);
  const sourceLink = basename(file);
  const rendered = marked
    .parse(markdown)
    .replaceAll(/href="([^"#?]+)\.md((?:[?#][^"]*)?)"/g, 'href="$1.html$2"');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
      <p class="source">Generated deterministically from <a href="${htmlEscape(sourceLink)}">${htmlEscape(file)}</a>. Canonical SHA-256: <code>${digest}</code>.</p>
    </main>
  </body>
</html>
`;
}

const changed = [];

for (const file of markdownFiles) {
  const htmlPath = join(dirname(file), `${basename(file, extname(file))}.html`);
  const absoluteHtml = join(projectRoot, htmlPath);
  const expected = render(file);
  let current = null;

  try {
    current = readFileSync(absoluteHtml, "utf8");
  } catch {
    // Missing peers are handled below.
  }

  if (current !== expected) {
    changed.push(relative(projectRoot, absoluteHtml));
    if (!checkOnly) writeFileSync(absoluteHtml, expected);
  }
}

if (changed.length > 0 && checkOnly) {
  process.stderr.write(
    `Documentation HTML is stale or missing:\n${changed.join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  checkOnly
    ? `Documentation parity verified for ${markdownFiles.length} Markdown files.\n`
    : `Generated ${markdownFiles.length} HTML documentation peers.\n`,
);
