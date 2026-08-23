import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE_ROOT = dirname(fileURLToPath(import.meta.url));

function semanticVersion(value) {
  const version = String(value || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid release version: ${version || "<missing>"}.`);
  }
  return version;
}

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) {
    throw new Error(`${label} expected exactly one owned projection, found ${matches.length}.`);
  }
  return source.replace(pattern, replacement);
}

export function normalizeBootstrapReleaseProjection(source, version, label = "bootstrap") {
  const releaseVersion = semanticVersion(version);
  const replacement = label === "bootstrap-core.js"
    ? `  const STATIC_RELEASE_VERSION = String(window.__mflReleaseVersion || "${releaseVersion}");`
    : `  const STATIC_RELEASE_VERSION = "${releaseVersion}";`;
  return replaceExactlyOnce(
    String(source || ""),
    /^  const STATIC_RELEASE_VERSION = .*;$/gm,
    replacement,
    `${label} release projection`,
  );
}

export function normalizeIndexReleaseProjection(source, version) {
  const releaseVersion = semanticVersion(version);
  return replaceExactlyOnce(
    String(source || ""),
    /<a href="\/changelog" data-page="changelog">MFL Front Office(?: v\d+\.\d+\.\d+)?<\/a>/g,
    `<a href="/changelog" data-page="changelog">MFL Front Office v${releaseVersion}</a>`,
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
  const release = JSON.parse(await readFile(resolve(siteRoot, "release.json"), "utf8"));
  const version = semanticVersion(release?.version);
  const targets = [
    ["bootstrap.js", (source) => normalizeBootstrapReleaseProjection(source, version, "bootstrap.js")],
    ["bootstrap-core.js", (source) => normalizeBootstrapReleaseProjection(source, version, "bootstrap-core.js")],
    ["index.html", (source) => normalizeIndexReleaseProjection(source, version)],
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
    console.log(`${changed ? "Generated" : "Unchanged"} ${path}`);
  });
}
