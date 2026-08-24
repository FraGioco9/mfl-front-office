import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MFL_STATS_OVERALL_FILTERS, TABLE_VIEW_CONFIG, VIEW_BY_SLUG } from "./modules/app-config.js";

const DEFAULT_SITE_ROOT = dirname(fileURLToPath(import.meta.url));
// Keep this projection inline in index.html so route/view state remains zero-request before first paint.
const FIRST_PAINT_CONFIG_START = "        // BEGIN GENERATED FIRST-PAINT ROUTE CONFIG";
const FIRST_PAINT_CONFIG_END = "        // END GENERATED FIRST-PAINT ROUTE CONFIG";
const MFL_STATS_FILTERS_START = "              <!-- BEGIN GENERATED MFL STATS FILTERS -->";
const MFL_STATS_FILTERS_END = "              <!-- END GENERATED MFL STATS FILTERS -->";

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

function javascriptPropertyKey(value) {
  const key = String(value || "");
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function javascriptArray(values) {
  return `[${Array.from(values, (value) => JSON.stringify(value)).join(", ")}]`;
}

export function firstPaintRouteConfigProjectionSource() {
  const tableViewLines = Object.entries(TABLE_VIEW_CONFIG).map(([page, config]) => (
    `          ${javascriptPropertyKey(page)}: Object.freeze({ order: ${javascriptArray(config.order)}, fallback: ${JSON.stringify(config.fallback)} }),`
  ));
  const viewSlugLines = Object.entries(VIEW_BY_SLUG).map(([slug, view]) => (
    `          ${javascriptPropertyKey(slug)}: ${JSON.stringify(view)},`
  ));

  return [
    FIRST_PAINT_CONFIG_START,
    "        const TABLE_VIEW_CONFIG = Object.freeze({",
    ...tableViewLines,
    "        });",
    "        const VIEW_BY_SLUG = Object.freeze({",
    ...viewSlugLines,
    "        });",
    FIRST_PAINT_CONFIG_END,
  ].join("\n");
}

export function mflStatsFilterButtonsProjectionSource() {
  const buttons = MFL_STATS_OVERALL_FILTERS.map((filter, index) => (
    `              <button class="mflStatsFilterButton${index === 0 ? " active" : ""}" type="button" data-static-value="${filter.id}">${filter.label}</button>`
  ));
  return [MFL_STATS_FILTERS_START, ...buttons, MFL_STATS_FILTERS_END].join("\n");
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

export function normalizeIndexFirstPaintConfigProjection(source) {
  const input = String(source || "");
  const generatedPattern = /^        \/\/ BEGIN GENERATED FIRST-PAINT ROUTE CONFIG[\s\S]*?^        \/\/ END GENERATED FIRST-PAINT ROUTE CONFIG$/gm;
  const generatedMatches = input.match(generatedPattern) || [];
  if (generatedMatches.length > 1) {
    throw new Error(`index first-paint route config projection expected exactly one owned projection, found ${generatedMatches.length}.`);
  }
  if (generatedMatches.length === 1) {
    return input.replace(generatedPattern, firstPaintRouteConfigProjectionSource());
  }

  return replaceExactlyOnce(
    input,
    /^        const TABLE_VIEW_CONFIG = Object\.freeze\(\{[\s\S]*?^        const VIEW_BY_SLUG = Object\.freeze\(\{[\s\S]*?^        \}\);$/gm,
    firstPaintRouteConfigProjectionSource(),
    "index legacy first-paint route config projection",
  );
}

export function normalizeIndexMflStatsFiltersProjection(source) {
  const input = String(source || "");
  const generatedPattern = /^              <!-- BEGIN GENERATED MFL STATS FILTERS -->[\s\S]*?^              <!-- END GENERATED MFL STATS FILTERS -->$/gm;
  const generatedMatches = input.match(generatedPattern) || [];
  if (generatedMatches.length > 1) {
    throw new Error(`index MFL Stats filter projection expected exactly one owned projection, found ${generatedMatches.length}.`);
  }
  if (generatedMatches.length === 1) {
    return input.replace(generatedPattern, mflStatsFilterButtonsProjectionSource());
  }

  return replaceExactlyOnce(
    input,
    /^              <button class="mflStatsFilterButton active" type="button" data-static-value="all">All<\/button>[\s\S]*?^              <button class="mflStatsFilterButton" type="button" data-static-value="common">Common<\/button>$/gm,
    mflStatsFilterButtonsProjectionSource(),
    "index legacy MFL Stats filter projection",
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
    ["index.html", (source) => normalizeIndexMflStatsFiltersProjection(normalizeIndexFirstPaintConfigProjection(normalizeIndexReleaseProjection(source, version)))],
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
