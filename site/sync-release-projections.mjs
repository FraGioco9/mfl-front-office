import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE_ROOT = dirname(fileURLToPath(import.meta.url));
const RELEASE_EXPRESSION = 'String(window.__mflAppConfig?.release?.version || window.__mflReleaseVersion || "dev")';

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) {
    throw new Error(`${label} expected exactly one owned projection, found ${matches.length}.`);
  }
  return source.replace(pattern, replacement);
}

export function normalizeBootstrapReleaseProjection(source, label = "bootstrap") {
  return replaceExactlyOnce(
    String(source || ""),
    /^  const STATIC_RELEASE_VERSION = .*;$/gm,
    `  const STATIC_RELEASE_VERSION = ${RELEASE_EXPRESSION};`,
    `${label} release projection`,
  );
}

export function normalizeIndexReleaseProjection(source) {
  return replaceExactlyOnce(
    String(source || ""),
    /<a href="\/changelog" data-page="changelog">MFL Front Office(?: v\d+\.\d+\.\d+)?<\/a>/g,
    '<a href="/changelog" data-page="changelog">MFL Front Office</a>',
    "index footer release projection",
  );
}

async function writeIfChanged(path, content) {
  const current = await readFile(path, "utf8");
  if (current === content) return false;
  await writeFile(path, content, "utf8");
  return true;
}

export async function synchronizeReleaseProjections(siteRoot = DEFAULT_SITE_ROOT) {
  const targets = [
    ["bootstrap.js", (source) => normalizeBootstrapReleaseProjection(source, "bootstrap.js")],
    ["bootstrap-core.js", (source) => normalizeBootstrapReleaseProjection(source, "bootstrap-core.js")],
    ["index.html", normalizeIndexReleaseProjection],
  ];

  const results = [];
  for (const [relativePath, normalize] of targets) {
    const path = resolve(siteRoot, relativePath);
    const current = await readFile(path, "utf8");
    const next = normalize(current);
    results.push([relativePath, await writeIfChanged(path, next)]);
  }
  return Object.freeze(results.map(([path, changed]) => Object.freeze({ path, changed })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await synchronizeReleaseProjections();
  results.forEach(({ path, changed }) => {
    console.log(`${changed ? "Normalized" : "Unchanged"} ${path}`);
  });
}
