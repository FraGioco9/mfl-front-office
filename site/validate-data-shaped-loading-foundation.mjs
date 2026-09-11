import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");

const bootstrap = read("./bootstrap.js");
const loading = read("./loading.css");
const styles = read("./styles.css");
const stylesBase = read("./styles-base.css");
const responsive = read("./responsive.css");
const tableLoading = read("./table-loading-runtime.js");
const tableRender = read("./modules/core-sources/table-render-lifecycle.js");
const databaseStats = read("./database-stats-runtime.js");
const mflStats = read("./modules/core-sources/mfl-stats.js");
const evaluationSearch = read("./evaluation-search-state-runtime.js");
const evaluationHtml = read("./html-sources/evaluation.html");
const playerHtml = read("./html-sources/player.html");
const appConfig = read("./modules/app-config.js");

const tableRouteFamily = ["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"];
for (const pageName of tableRouteFamily) {
  assert.match(
    appConfig,
    new RegExp(`TABLE_INFRASTRUCTURE_PAGES[\\s\\S]*"${pageName}"`, "u"),
    `Every table-backed route must remain inside the shared loading infrastructure: ${pageName}.`,
  );
}

for (const [routeId, loadingMarker] of [
  ["homePage", 'setLoadingValue("homePlayers")'],
  ["playerPage", "primePlayerSkeleton()"],
  ["evaluationPage", "syncFirstPaintEvaluationRecentLoadingShell()"],
  ["settingsPage", "primeSettingsControls()"],
  ["databaseStatsPage", 'primeStatsHistogramSkeleton("databaseStatsDistribution")'],
  ["mflStatsPage", 'primeStatsHistogramSkeleton("mflStatsAgeDistribution")'],
]) {
  const routeStart = bootstrap.indexOf(`target.id === "${routeId}"`);
  assert.ok(routeStart >= 0, `Missing bootstrap loading inventory entry for ${routeId}.`);
  assert.ok(
    bootstrap.indexOf(loadingMarker, routeStart) > routeStart,
    `${routeId} must consume the shared data-shaped loading foundation through ${loadingMarker}.`,
  );
}

assert.match(styles, /--mfl-loading-placeholder-surface:/u, "Global loading placeholders must use one canonical surface token.");
assert.match(styles, /--mfl-loading-placeholder-border:/u, "Global loading placeholders must use one canonical border token.");
assert.match(styles, /--mfl-loading-placeholder-radius:/u, "Global loading placeholders must use one canonical radius token.");
assert.match(loading, /\.mflDataPlaceholder\s*\{/u, "Every data-shaped loader must share one canonical visual presentation class.");

assert.match(
  bootstrap,
  /function createTextSkeleton\(sampleText = "00", hostClass = ""\)/u,
  "Text skeletons must be sized by representative content instead of arbitrary width constants.",
);
assert.match(
  bootstrap,
  /sample\.className = "mflSkeletonTextSample";[\s\S]*sample\.textContent = String\(sampleText \|\| "00"\);/u,
  "Representative text must participate in layout before the visual mask is painted.",
);
assert.match(
  loading,
  /\.mflSkeletonText\s*\{[\s\S]*display: inline-grid;[\s\S]*max-width: 100%;/u,
  "Text skeletons must inherit their containing element's real typography and alignment.",
);
assert.match(
  loading,
  /\.mflSkeletonTextSample\s*\{[\s\S]*visibility: hidden;/u,
  "Representative content must remain in layout while visually hidden.",
);
assert.match(
  loading,
  /\.mflSkeletonText\.mflSkeletonText,[\s\S]*font: inherit;[\s\S]*line-height: inherit;[\s\S]*letter-spacing: inherit;[\s\S]*text-align: inherit;[\s\S]*text-transform: inherit;/u,
  "Skeleton internals must inherit loaded-value typography even inside broad descendant selectors such as Stats and Settings labels.",
);

assert.match(
  loading,
  /\.mflSkeletonTextFill\s*\{[\s\S]*inline-size: 100%;[\s\S]*block-size: 0\.68em;/u,
  "The mask width must come from representative text and its height must scale with the inherited font size.",
);
for (const forbidden of ["font-size:", "font-weight:", "line-height:", "text-align:", "letter-spacing:"]) {
  const textSkeletonRule = loading.match(/\.mflSkeletonText\s*\{([\s\S]*?)\n\}/u)?.[1] || "";
  assert.doesNotMatch(textSkeletonRule, new RegExp(forbidden, "u"), `Skeleton text must not duplicate loaded typography through ${forbidden}`);
}

assert.match(
  bootstrap,
  /function appendTableLoadingCellContent\(cell, renderedColumn\)/u,
  "Table skeletons must render through semantic loaded-cell wrappers.",
);
for (const loadedContract of [
  'cell.classList.add("selectionCell");',
  'cell.classList.add("rowActionsCell");',
  'cell.classList.add("flagCell");',
  'cell.classList.add("nameCell");',
  'content.className = "tableControlCellContent tableControlCellContentCentered";',
  'nameWrap.className = "playerNameCell";',
  'host.className = "listingCellTableHost";',
  'badge.className = "listingCellContent mflDataPlaceholder mflTableListingPlaceholder";',
  'content.className = centered ? "tableOverallCellContent" : "tableControlCellContent";',
]) {
  assert.match(bootstrap, new RegExp(loadedContract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"), `Table loading is missing loaded-layout contract: ${loadedContract}`);
}
for (const loadedRendererContract of [
  'selectionCell.className = "selectionCell";',
  'actionsCell.className = "rowActionsCell";',
  'selectionContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'actionsContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'nameWrap.className = "playerNameCell";',
  'host.className = "listingCellTableHost";',
]) {
  assert.match(tableRender, new RegExp(loadedRendererContract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"), `Loaded Table renderer must retain the skeleton-shared wrapper: ${loadedRendererContract}`);
}
assert.match(
  styles,
  /#progressionPage \.playerTableScroller col\.col-name \{ width: var\(--mfl-table-col-name\); \}/u,
  "Skeleton columns must keep using the real colgroup width source.",
);
assert.match(
  styles,
  /#progressionPage \.playerTableScroller tbody > tr \{\s*height: var\(--mfl-table-row-outer-height\);/u,
  "Skeleton rows must inherit the populated row-height contract.",
);
assert.doesNotMatch(
  loading,
  /mflTable[^}]*\b(?:font-size|line-height|text-align|height|width):\s*[0-9.]+px/u,
  "Table skeleton CSS must not create a parallel pixel typography/alignment/geometry contract.",
);
assert.match(
  tableLoading,
  /Reflect\.get\(window, "__mflPrimeTableRows"\)/u,
  "The existing Table loading lifecycle must continue delegating skeleton creation to bootstrap.",
);

assert.match(
  bootstrap,
  /function primeStatsHistogramSkeleton\(target\)/u,
  "Stats loading must mirror the histogram rather than paint one generic panel rectangle.",
);
assert.match(
  bootstrap,
  /delete element\.dataset\.mflStatsDistributionSignature;/u,
  "Priming a Stats skeleton must invalidate loaded-distribution memoization so cached data can repaint real columns on revisit.",
);
for (const [name, source] of [["Database Stats", databaseStats], ["MFL Stats", mflStats]]) {
  assert.match(
    source,
    /!renderedDistribution\.classList\.contains\("mflStatsHistogramSkeleton"\)/u,
    `${name} memoization must only reuse a real rendered distribution, never a loading skeleton.`,
  );
}


for (const histogramClass of ["mflStatsHistogram", "mflStatsHistogramItem", "mflStatsHistogramBar", "mflStatsHistogramFill", "mflStatsHistogramLabel"]) {
  assert.match(bootstrap, new RegExp(histogramClass, "u"), `Stats skeleton must consume the loaded histogram class ${histogramClass}.`);
  assert.match(stylesBase, new RegExp(`\\.${histogramClass}`, "u"), `Loaded Stats CSS must own ${histogramClass} geometry.`);
}
assert.match(
  responsive,
  /\.mflStatsHistogram\s*\{[\s\S]*min-width:/u,
  "Stats skeletons must inherit responsive histogram sizing from the loaded histogram.",
);

assert.match(
  bootstrap,
  /firstPaintTextSkeletonHtml\(index === 0 \? "85" : "82", "attributeValueText"\)/u,
  "Player Attributes skeletons must use the loaded value text class and representative values.",
);
assert.match(
  playerHtml,
  /playerHeroOverall isPending"><strong><span class="mflSkeletonText"/u,
  "Direct Player refresh must ship the same representative Overall text skeleton before bootstrap.",
);
assert.match(
  playerHtml,
  /playerTitleName"><span class="mflSkeletonText"/u,
  "Direct Player refresh must size the pending title from representative text in the real title element.",
);
assert.match(
  playerHtml,
  /const skeletonActive = Boolean\(titleName\.querySelector\(":scope > \.mflSkeletonText"\)\);/u,
  "Parser-time Player name hydration must distinguish skeleton sample text from real cached content.",
);

for (const sample of ["Name Surname", "CM, RW", "182 cm", "Agent Name", "Club Name · Diamond"]) {
  assert.match(bootstrap, new RegExp(sample.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"), `Player skeleton is missing representative loaded content: ${sample}`);
}
assert.doesNotMatch(
  loading,
  /mflPlayerValuePlaceholder/u,
  "Player skeletons must not retain independent generic width classes.",
);

assert.match(
  evaluationHtml,
  /evaluationSearchResult mflEvaluationRecentPlaceholder/u,
  "Evaluation parser skeleton must reuse the loaded result container.",
);
assert.match(
  evaluationHtml,
  /<strong><span class="mflSkeletonText"/u,
  "Evaluation player-name skeleton must live inside the real strong element.",
);
assert.match(
  evaluationHtml,
  /<span><span class="mflSkeletonText"/u,
  "Evaluation metadata skeleton must live inside the real metadata span.",
);
assert.match(
  evaluationSearch,
  /name\.appendChild\(createRecentTextSkeleton\("Player Name"\)\);/u,
  "Evaluation SPA skeleton must preserve the loaded name typography.",
);
assert.match(
  evaluationSearch,
  /metadata\.appendChild\(createRecentTextSkeleton\("CM · 24 · Overall 85"\)\);/u,
  "Evaluation SPA skeleton must preserve the loaded metadata typography.",
);
assert.doesNotMatch(evaluationSearch, /Loading…|Loading\.\.\./u, "Evaluation loading must not fall back to generic loading text.");

assert.match(stylesBase, /\.homeStats span\s*\{[\s\S]*font-size: 28px;/u, "Home must retain ownership of its real metric typography.");
assert.match(stylesBase, /\.mflStatsCards strong\s*\{[\s\S]*font-size: 22px;/u, "Stats cards must retain ownership of their real metric typography.");
assert.match(stylesBase, /\.settingsIdentity strong\s*\{[\s\S]*margin-top: 4px;/u, "Settings identity must retain ownership of its real text layout.");
assert.match(bootstrap, /LOADING_TEXT_SAMPLES/u, "Scalar loaded elements must use representative content while inheriting their existing CSS.");

assert.doesNotMatch(bootstrap, /!important/u, "Bootstrap loading must not introduce CSS priority overrides.");
assert.doesNotMatch(bootstrap, /document\.createElement\("style"\)/u, "Bootstrap loading must not inject a second style owner.");

console.log("Data-shaped loading follows loaded component typography, alignment, wrappers, and responsive geometry across every async route family.");
