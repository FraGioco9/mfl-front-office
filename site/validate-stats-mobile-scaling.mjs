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

console.log("Stats mobile scrolling, fades, tooltip tap behavior, route reset, vertical wheel/touch page scrolling, canonical dependency loading, and view click-through validation passed.");
