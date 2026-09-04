import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MFL_STATS_OVERALL_FILTERS,
  TABLE_VIEW_CONFIG,
  VIEW_BY_SLUG,
} from "./modules/app-config.js";

const DEFAULT_SITE_ROOT = dirname(fileURLToPath(import.meta.url));
// Keep this projection inline in index.html so route/view state remains zero-request before first paint.
const FIRST_PAINT_CONFIG_START = "        // BEGIN GENERATED FIRST-PAINT ROUTE CONFIG";
const FIRST_PAINT_CONFIG_END = "        // END GENERATED FIRST-PAINT ROUTE CONFIG";
const MOBILE_WATCHLIST_FIRST_PAINT_START = "          <!-- BEGIN GENERATED MOBILE WATCHLIST FIRST PAINT -->";
const MOBILE_WATCHLIST_FIRST_PAINT_END = "          <!-- END GENERATED MOBILE WATCHLIST FIRST PAINT -->";
const MOBILE_TABLE_FIRST_PAINT_CASCADE_START = "    <!-- BEGIN GENERATED MOBILE TABLE FIRST PAINT CASCADE -->";
const MOBILE_TABLE_FIRST_PAINT_CASCADE_END = "    <!-- END GENERATED MOBILE TABLE FIRST PAINT CASCADE -->";
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
    "        const mobileTableFirstPaintStyle = document.createElement(\"style\");",
    '        mobileTableFirstPaintStyle.id = "mflInitialMobileTableStyle";',
    "        mobileTableFirstPaintStyle.textContent = `",
    "@media (max-width: 900px) {",
    "  #progressionPage { --mfl-table-header-height: 30px; --mfl-table-row-height: 26px; --mfl-table-row-outer-height: 30px; --mfl-table-col-listing: 4%; --mfl-table-col-positions: 9.89924379593141%; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .views > #openFiltersButton { order: -2; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .views > #viewControlsSeparator { order: -1; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell { position: relative; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::before, html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after { content: \"\"; position: absolute; top: var(--mfl-table-header-height); bottom: 0; z-index: 2; width: 54px; opacity: 0; visibility: hidden; pointer-events: none; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::before { left: 0; background: linear-gradient(90deg, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 92%, transparent) 34%, color-mix(in srgb, var(--page-bg) 55%, transparent) 68%, transparent 100%); }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after { right: 0; background: linear-gradient(270deg, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 92%, transparent) 34%, color-mix(in srgb, var(--page-bg) 55%, transparent) 68%, transparent 100%); }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell.mflPlayerTableCanScrollLeft::before, html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell.mflPlayerTableCanScrollRight::after { opacity: 0.94; visibility: visible; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller { display: block; width: 100%; max-width: 100%; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; touch-action: auto; -webkit-mask-image: none; mask-image: none; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller table { min-width: 760px; max-width: none; }",
    "  #progressionPage .playerTableScroller th { font-size: 10px; }",
    "  #progressionPage #tableHead th > span:first-child { font-size: 10px; }",
    "  #progressionPage #tableHead .selectionCell input:disabled { opacity: 0.45; }",
    "  #appShell #progressionPage .playerTableScroller :is(th, td).selectionCell input, #appShell #progressionPage .quickFilters input[type=\"checkbox\"] { box-sizing: border-box; flex: 0 0 13px; width: 13px; min-width: 13px; max-width: 13px; height: 13px; min-height: 13px; max-height: 13px; aspect-ratio: 1 / 1; background-size: 8px 6px; border-radius: 3px; }",
    "  #progressionPage #tableBody :is(.tableControlCellContent, .tableOverallCellContent) { align-items: center; }",
    "  #progressionPage #tableBody :is(.tableControlCellContent, .tableOverallCellContent) > * { align-self: center; }",
    "  #progressionPage .playerTableScroller td.col-age .tableControlCellContent { gap: 1px; }",
    "  #progressionPage .playerTableScroller td.col-age .playerAgeValue { flex: 0 0 auto; min-width: 0; }",
    "  #progressionPage .playerTableScroller .playerTableActionsButton { width: 18px; min-width: 18px; max-width: 18px; height: 18px; min-height: 18px; max-height: 18px; padding: 0; }",
    "  #progressionPage .playerTableScroller .playerTableActionsButton svg { width: 12px; height: 12px; }",
    "  #progressionPage .playerTableScroller .flagImage { width: 14px; height: 14px; }",
    "  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) { flex: 0 0 11px; width: 11px; min-width: 11px; max-width: 11px; height: 11px; min-height: 11px; max-height: 11px; margin: 0; transform: none; }",
    "  #progressionPage .playerTableScroller .retirementMarker::before, #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img, #progressionPage .playerTableScroller .newMintMarker .newMintIcon { width: 11px; height: 11px; }",
    "  #progressionPage .playerTableScroller .playerNoteIcon { font-size: 9px; line-height: 1; }",
    "  #progressionPage .playerTableScroller .listingCellContent { width: 18px; min-width: 18px; max-width: 18px; height: 18px; min-height: 18px; max-height: 18px; }",
    "  #progressionPage .playerTableScroller .listingCellIcon { flex: 0 0 9px; width: 9px; height: 9px; }",
    "  #progressionPage #tableBody .tableOverallRarityCircle { flex: 0 0 5px; width: 5px; height: 5px; margin-right: 1px; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller .sortArrow { transform: scale(0.75); transform-origin: center; }",
    "}",
    "@media (min-width: 521px) and (max-width: 900px) {",
    "  #progressionPage #tableHead th > span:first-child { font-size: 10px; }",
    "  #progressionPage #tableHead th > span:first-child::after { content: none; display: none; }",
    "}",
    "@media (max-width: 700px) {",
    "  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) { flex-basis: 10px; width: 10px; min-width: 10px; max-width: 10px; height: 10px; min-height: 10px; max-height: 10px; }",
    "  #progressionPage .playerTableScroller .retirementMarker::before, #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img, #progressionPage .playerTableScroller .newMintMarker .newMintIcon { width: 10px; height: 10px; }",
    "}",
    "@media (max-width: 520px) {",
    "  #progressionPage { --mfl-table-header-height: 26px; --mfl-table-row-height: 22px; --mfl-table-row-outer-height: 26px; --mfl-table-col-listing: 3.5%; --mfl-table-col-positions: 10.39924379593141%; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::before, html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after { width: 46px; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller table { min-width: 760px; }",
    "  #appShell #progressionPage .playerTableScroller :is(th, td).selectionCell input, #appShell #progressionPage .quickFilters input[type=\"checkbox\"] { flex-basis: 11px; width: 11px; min-width: 11px; max-width: 11px; height: 11px; min-height: 11px; max-height: 11px; background-size: 7px 5px; }",
    "  #progressionPage .playerTableScroller th { font-size: 9px; }",
    "  #progressionPage #tableHead th > span:first-child { font-size: 9px; }",
    "  #progressionPage #tableHead th > span:first-child::after { content: none; display: none; }",
    "  #progressionPage .playerTableScroller .playerTableActionsButton { width: 15px; min-width: 15px; max-width: 15px; height: 15px; min-height: 15px; max-height: 15px; }",
    "  #progressionPage .playerTableScroller .playerTableActionsButton svg { width: 9px; height: 9px; }",
    "  #progressionPage .playerTableScroller .flagImage { width: 11px; height: 11px; }",
    "  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) { flex-basis: 9px; width: 9px; min-width: 9px; max-width: 9px; height: 9px; min-height: 9px; max-height: 9px; }",
    "  #progressionPage .playerTableScroller .retirementMarker::before, #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img, #progressionPage .playerTableScroller .newMintMarker .newMintIcon { width: 9px; height: 9px; }",
    "  #progressionPage .playerTableScroller .playerNoteIcon { font-size: 7px; }",
    "  #progressionPage .playerTableScroller .listingCellContent { width: 15px; min-width: 15px; max-width: 15px; height: 15px; min-height: 15px; max-height: 15px; }",
    "  #progressionPage .playerTableScroller .listingCellIcon { flex-basis: 7px; width: 7px; height: 7px; }",
    "  #progressionPage #tableBody .tableOverallRarityCircle { margin-right: 3px; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller .sortArrow { transform: scale(0.62); }",
    "}",
    "@media (max-width: 380px) {",
    "  #progressionPage { --mfl-table-header-height: 24px; --mfl-table-row-height: 20px; --mfl-table-row-outer-height: 24px; --mfl-table-col-listing: 3%; --mfl-table-col-positions: 10.89924379593141%; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::before, html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after { width: 40px; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller table { min-width: 760px; }",
    "  #appShell #progressionPage .playerTableScroller :is(th, td).selectionCell input, #appShell #progressionPage .quickFilters input[type=\"checkbox\"] { flex-basis: 10px; width: 10px; min-width: 10px; max-width: 10px; height: 10px; min-height: 10px; max-height: 10px; background-size: 6px 4px; }",
    "  #progressionPage .playerTableScroller th { font-size: 8px; }",
    "  #progressionPage #tableHead th > span:first-child { font-size: 8px; }",
    "  #progressionPage .playerTableScroller .playerTableActionsButton { width: 13px; min-width: 13px; max-width: 13px; height: 13px; min-height: 13px; max-height: 13px; }",
    "  #progressionPage .playerTableScroller .playerTableActionsButton svg { width: 8px; height: 8px; }",
    "  #progressionPage .playerTableScroller .flagImage { width: 10px; height: 10px; }",
    "  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) { flex-basis: 8px; width: 8px; min-width: 8px; max-width: 8px; height: 8px; min-height: 8px; max-height: 8px; }",
    "  #progressionPage .playerTableScroller .retirementMarker::before, #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img, #progressionPage .playerTableScroller .newMintMarker .newMintIcon { width: 8px; height: 8px; }",
    "  #progressionPage .playerTableScroller .listingCellContent { width: 13px; min-width: 13px; max-width: 13px; height: 13px; min-height: 13px; max-height: 13px; }",
    "  #progressionPage .playerTableScroller .listingCellIcon { flex-basis: 6px; width: 6px; height: 6px; }",
    "  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .playerTableScroller .sortArrow { transform: scale(0.54); }",
    "}",
    "`;",
    "        document.head.appendChild(mobileTableFirstPaintStyle);",
    FIRST_PAINT_CONFIG_END,
  ].join("\n");
}

export function mobileTableFirstPaintCascadeProjectionSource() {
  return [
    MOBILE_TABLE_FIRST_PAINT_CASCADE_START,
    "    <script>",
    "      (() => {",
    '        const style = document.getElementById("mflInitialMobileTableStyle");',
    "        if (style instanceof HTMLStyleElement) document.head.appendChild(style);",
    "      })();",
    "    </script>",
    MOBILE_TABLE_FIRST_PAINT_CASCADE_END,
  ].join("\n");
}

export function mobileWatchlistFirstPaintProjectionSource() {
  return [
    MOBILE_WATCHLIST_FIRST_PAINT_START,
    "          <script>",
    "            (() => {",
    "              const root = document.documentElement;",
    '              if (!window.matchMedia("(max-width: 900px)").matches) return;',
    '              if (root.dataset.initialTablePage !== "watchlist" || root.dataset.storedWalletOptIn !== "true") return;',
    '              const views = document.querySelector("#progressionPage > .views");',
    '              const switcher = document.getElementById("watchlistSwitcher");',
    "              if (!(views instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return;",
    "              switcher.hidden = false;",
    '              switcher.classList.add("mflMobileWatchlistSwitcher");',
    '              views.insertAdjacentElement("afterend", switcher);',
    "            })();",
    "          </script>",
    MOBILE_WATCHLIST_FIRST_PAINT_END,
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

export function normalizeBootstrapFirstPaintCompactLabels(source) {
  return replaceExactlyOnce(
    String(source || ""),
    /^  const FIRST_PAINT_COMPACT_COLUMN_LABELS = Object\.freeze\(\{[\s\S]*?^  \}\);$/gm,
    `  const FIRST_PAINT_COMPACT_COLUMN_LABELS = Object.freeze({
    age: "AGE",
    positions: "POS",
    player_seasons: "SZN",
    overall: "OVR",
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
    wallet_name: "AGT",
    owned_since: "JOIN",
    active_contract_revenue_share: "REV",
    active_contract_club_name: "CLUB",
    active_contract_club_division: "DIV",
  });`,
    "bootstrap first-paint compact table labels",
  );
}

export function normalizeIndexReleaseProjection(source, version) {
  const releaseVersion = semanticVersion(version);
  return replaceExactlyOnce(
    String(source || ""),
    /<a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="\/changelog" data-page="changelog">MFL Front Office(?: v\d+\.\d+\.\d+)?<\/a>/g,
    `<a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="/changelog" data-page="changelog">MFL Front Office v${releaseVersion}</a>`,
    "index footer release projection",
  );
}

export function normalizeIndexPagerLoadingProjection(source) {
  return replaceExactlyOnce(
    String(source || ""),
    /^      html:not\(\[data-mfl-ready="true"\]\) #progressionPage nav\.pager(?:,\n      html\.mflDataLoading #progressionPage nav\.pager)? \{\n        display: none;\n      \}$/gm,
    `      html:not([data-mfl-ready="true"]) #progressionPage nav.pager {
        display: none;
      }`,
    "index pager data-render visibility projection",
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

export function normalizeIndexMobileTableFirstPaintCascadeProjection(source) {
  const input = String(source || "");
  const generatedPattern = /^    <!-- BEGIN GENERATED MOBILE TABLE FIRST PAINT CASCADE -->[\s\S]*?^    <!-- END GENERATED MOBILE TABLE FIRST PAINT CASCADE -->$/gm;
  const generatedMatches = input.match(generatedPattern) || [];
  if (generatedMatches.length > 1) {
    throw new Error(`index mobile table first-paint cascade projection expected exactly one owned projection, found ${generatedMatches.length}.`);
  }
  if (generatedMatches.length === 1) {
    return input.replace(generatedPattern, mobileTableFirstPaintCascadeProjectionSource());
  }

  return replaceExactlyOnce(
    input,
    /^    <link rel="stylesheet" href="\/responsive\.css" data-mfl-responsive-layout="true">$/m,
    (match) => `${match}\n${mobileTableFirstPaintCascadeProjectionSource()}`,
    "index mobile table first-paint cascade insertion point",
  );
}

export function normalizeIndexMobileWatchlistFirstPaintProjection(source) {
  const input = String(source || "");
  const generatedPattern = /^          <!-- BEGIN GENERATED MOBILE WATCHLIST FIRST PAINT -->[\s\S]*?^          <!-- END GENERATED MOBILE WATCHLIST FIRST PAINT -->$/gm;
  const generatedMatches = input.match(generatedPattern) || [];
  if (generatedMatches.length > 1) {
    throw new Error(`index mobile Watchlist first-paint projection expected exactly one owned projection, found ${generatedMatches.length}.`);
  }
  if (generatedMatches.length === 1) {
    return input.replace(generatedPattern, mobileWatchlistFirstPaintProjectionSource());
  }

  return replaceExactlyOnce(
    input,
    /^          <\/section>\n\n          <section class="quickFilters" aria-label="Quick filters">$/m,
    `          </section>\n${mobileWatchlistFirstPaintProjectionSource()}\n\n          <section class="quickFilters" aria-label="Quick filters">`,
    "index mobile Watchlist first-paint insertion point",
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

export function normalizeIndexTableConfigRuntimeProjection(source) {
  return replaceExactlyOnce(
    String(source || ""),
    /^    <script src="\/table-width-runtime\.js(?:\?mfl_config=[a-f0-9]+)?"><\/script>$/gm,
    '    <script src="/table-width-runtime.js"></script>',
    "index table config runtime projection",
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
    ["bootstrap.js", (source) => normalizeBootstrapFirstPaintCompactLabels(
      normalizeBootstrapReleaseProjection(source, version, "bootstrap.js"),
    )],
    ["bootstrap-core.js", (source) => normalizeBootstrapReleaseProjection(source, version, "bootstrap-core.js")],
    ["index.html", (source) => normalizeIndexPagerLoadingProjection(
      normalizeIndexTableConfigRuntimeProjection(
        normalizeIndexMobileTableFirstPaintCascadeProjection(
          normalizeIndexMflStatsFiltersProjection(
            normalizeIndexMobileWatchlistFirstPaintProjection(
              normalizeIndexFirstPaintConfigProjection(normalizeIndexReleaseProjection(source, version)),
            ),
          ),
        ),
      ),
    )],
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
  synchronizeReleaseProjections().then((results) => {
    results.forEach(({ path, changed }) => {
      console.log(`${changed ? "Generated" : "Unchanged"} ${path}`);
    });
  });
}
