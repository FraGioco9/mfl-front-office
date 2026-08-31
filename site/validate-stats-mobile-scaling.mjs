import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");
const responsive = read("responsive.css");
const statsUi = read("stats-mobile-ui-runtime.js");
const staticUi = read("static-ui-runtime.js");
const routeCoreLoader = read("route-core-loader-runtime.js");
const appConfig = read("modules/app-config.js");
const appCore = [
  "modules/core-sources/shared.js",
  "modules/core-sources/evaluation.js",
  "modules/core-sources/mfl-stats.js",
  "modules/core-sources/club.js",
  "modules/core-sources/settings.js",
  "modules/core-sources/player.js",
  "modules/core-sources/table.js",
  "modules/core-sources/wallet.js",
  "modules/core-sources/watchlist.js",
].map(read).join("\n");
const mflStatsRuntime = read("modules/app-core-mfl-stats-runtime.js");
const databaseStats = read("database-stats-runtime.js");

const media520Start = responsive.indexOf("@media (max-width: 520px)");
const media380Start = responsive.indexOf("@media (max-width: 380px)");
const coarsePointerStart = responsive.indexOf("@media (hover: none)", media380Start);
assert.ok(media520Start >= 0 && media380Start > media520Start && coarsePointerStart > media380Start);
const mobile = responsive.slice(media520Start, media380Start);
const narrow = responsive.slice(media380Start, coarsePointerStart);

assert.match(mobile, /#databaseStatsPage \.databaseStatsCards,\s*\.mflStatsCards \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
assert.match(mobile, /\.mflStatsFilterButtons \{\s*grid-template-columns: repeat\(auto-fit, minmax\(68px, 1fr\)\);/);
assert.match(mobile, /\.mflStatsFilterButton \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?height: 24px;/);
assert.match(mobile, /#databaseStatsPage \.databaseStatsCustomFilter \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
assert.match(mobile, /\.mflStatsAgeDistribution \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
assert.match(mobile, /\.mflStatsHistogram \{[\s\S]*?width: 100%;[\s\S]*?min-width: 520px;[\s\S]*?padding-top: 24px;/);
assert.match(narrow, /\.mflStatsHistogram \{[\s\S]*?width: 100%;[\s\S]*?min-width: 460px;[\s\S]*?padding-top: 20px;/);
assert.match(responsive, /\.mflStatsAgeDistribution \{[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: hidden;[\s\S]*?overscroll-behavior-y: auto;[\s\S]*?touch-action: pan-x;/);
assert.doesNotMatch(responsive, /\.advancedPlayerTableSection,\s*\.mflStatsAgeDistribution,/);
assert.match(responsive, /\.mflStatsAgeDistribution\.mflStatsCanScrollRight:not\(\.mflStatsCanScrollLeft\)/);
assert.match(responsive, /\.mflStatsAgeDistribution\.mflStatsCanScrollLeft\.mflStatsCanScrollRight/);

assert.match(statsUi, /const MOBILE_HISTOGRAM_COLUMN_MIN_WIDTH = 12;/);
assert.match(statsUi, /const MOBILE_HISTOGRAM_COLUMN_MAX_WIDTH = 96;/);
assert.match(statsUi, /const MOBILE_HISTOGRAM_REFERENCE_WIDTH = 384;/);
assert.match(statsUi, /const DEFAULT_HISTOGRAM_GRID_COLUMNS = "repeat\(var\(--mfl-stats-bars, 1\), minmax\(0, 1fr\)\)";/);
assert.match(statsUi, /const MOBILE_HISTOGRAM_GRID_COLUMNS = `repeat\(var\(--mfl-stats-bars, 1\), minmax\(\$\{MOBILE_HISTOGRAM_COLUMN_MIN_WIDTH\}px, 1fr\)\)`;/);
assert.match(statsUi, /function histogramForScroller\(scroller\)/);
assert.match(statsUi, /function mobileHistogramColumnMaxWidth\(labelCount\)/);
assert.match(statsUi, /const count = Math\.max\(1, Number\(labelCount\) \|\| 1\);/);
assert.match(statsUi, /const scaledWidth = Math\.floor\(MOBILE_HISTOGRAM_REFERENCE_WIDTH \/ count\);/);
assert.match(statsUi, /return Math\.max\(MOBILE_HISTOGRAM_COLUMN_MIN_WIDTH, Math\.min\(MOBILE_HISTOGRAM_COLUMN_MAX_WIDTH, scaledWidth\)\);/);
assert.match(statsUi, /function syncHistogramColumns\(scroller\)/);
assert.match(statsUi, /const mobile = MOBILE_MEDIA\.matches;/);
assert.match(statsUi, /const gridColumns = mobile \? MOBILE_HISTOGRAM_GRID_COLUMNS : DEFAULT_HISTOGRAM_GRID_COLUMNS;/);
assert.match(statsUi, /const items = histogram\.querySelectorAll\(":scope > \.mflStatsHistogramItem"\);/);
assert.match(statsUi, /const maxWidth = `\$\{mobileHistogramColumnMaxWidth\(items\.length\)\}px`;/);
assert.match(statsUi, /item\.style\.maxWidth = maxWidth;\s*item\.style\.justifySelf = "center";/);
assert.match(statsUi, /item\.style\.removeProperty\("max-width"\);\s*item\.style\.removeProperty\("justify-self"\);/);
assert.match(statsUi, /syncHistogramColumns\(scroller\);\s*if \(!MOBILE_MEDIA\.matches \|\| scroller\.getClientRects\(\)\.length === 0\)/);
assert.match(statsUi, /const FADE_LEFT_CLASS = "mflStatsCanScrollLeft";/);
assert.match(statsUi, /const FADE_RIGHT_CLASS = "mflStatsCanScrollRight";/);
assert.match(statsUi, /document\.getElementById\("databaseStatsDistribution"\)/);
assert.match(statsUi, /document\.getElementById\("mflStatsAgeDistribution"\)/);
assert.match(statsUi, /function reset\(\)/);
assert.match(statsUi, /if \(scroller\.scrollLeft\) scroller\.scrollLeft = 0;/);
assert.match(statsUi, /scrollContainer\.scrollTop \+= wheelPixels\(event, scrollContainer\);\s*event\.preventDefault\(\);/);
assert.match(statsUi, /function touchHandlers\(\)/);
assert.match(statsUi, /axis = Math\.abs\(totalY\) > Math\.abs\(totalX\) \? "vertical" : "horizontal";/);
assert.match(statsUi, /scrollContainer\.scrollTop -= deltaY;\s*event\.preventDefault\(\);/);
assert.match(statsUi, /addEventListener\("touchmove", touch\.move, \{ passive: false \}\)/);
assert.match(statsUi, /removeEventListener\("touchcancel", handlers\.touch\.end\)/);
assert.doesNotMatch(statsUi, /MutationObserver/);
assert.match(statsUi, /:scope > \.mflStatsHistogram, :scope > \.mflStatsHistogramLayout/);
assert.match(statsUi, /resetStatsHistogramScroll: reset/);
assert.match(statsUi, /Object\.defineProperty\(window, "__mflSharedTableUiRuntime"/);
assert.match(statsUi, /window\.__mflStatsMobileUiRuntime = Object\.freeze\(\{ sync, reset, destroy \}\)/);

assert.doesNotMatch(routeCoreLoader, /stats-mobile-ui-runtime\.js/);
assert.match(routeCoreLoader, /resources\(\)\.load\(path, \{ versioned: true \}\)/);
assert.match(appConfig, /statsPre: Object\.freeze\(\[\s*"\/shared-table-ui-runtime\.js",\s*"\/stats-mobile-ui-runtime\.js",\s*\]\)/);
assert.match(appConfig, /const stats = databaseStats \|\| page === "mflstats" \|\| \(page === "mfl" && view === "stats"\);/);
assert.match(appConfig, /if \(stats\) preCore\.push\(\.\.\.data\.routes\.runtimeScripts\.statsPre\);/);

assert.match(staticUi, /window\.__mflSharedTableUiRuntime\?\.resetStatsHistogramScroll\?\.\(\);/);
assert.match(staticUi, /window\.__mflSharedTableUiRuntime\?\.syncRouteHorizontalCuesNow\?\.\(\);/);
assert.match(staticUi, /const MOBILE_TOOLTIP_MEDIA = window\.matchMedia/);
assert.match(staticUi, /function onTooltipClick\(event\)/);
assert.match(staticUi, /document\.addEventListener\("click", onTooltipClick, true\);/);

assert.match(appCore, /mflStatsHistogramFill" data-tooltip=/);
assert.match(mflStatsRuntime, /mflStatsAgeDistribution\.replaceChildren\(fragment\);\s*window\.__mflSharedTableUiRuntime\?\.syncRouteHorizontalCuesNow\?\.\(\);/);
assert.match(databaseStats, /container\.replaceChildren\(histogram\);\s*window\.__mflSharedTableUiRuntime\?\.syncRouteHorizontalCuesNow\?\.\(\);/);
assert.match(statsUi, /function suppressPointerCommittedViewClick\(event\)/);
assert.match(statsUi, /event\.stopImmediatePropagation\(\);\s*clearPointerCommit\(\);/);
assert.match(statsUi, /document\.addEventListener\("click", suppressPointerCommittedViewClick, true\);/);

console.log("Stats mobile scrolling, label-count-scaled histogram columns with a 12px floor, fades, tooltip tap behavior, route reset, vertical wheel/touch page scrolling, canonical dependency loading, and view click-through validation passed.");
