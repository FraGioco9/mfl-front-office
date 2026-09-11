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
const myClubs = read("./modules/core-sources/my-clubs.js");
const myClubsCss = read("./my-clubs.css");
const evaluationSearch = read("./evaluation-search-state-runtime.js");
const evaluationHtml = read("./html-sources/evaluation.html");
const playerHtml = read("./html-sources/player.html");
const appConfig = read("./modules/app-config.js");
const myClubsCssSource = read("./my-clubs.css");

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
assert.match(
  styles,
  /--mfl-loading-text-placeholder-surface:\s*color-mix\(in srgb, var\(--mfl-loading-placeholder-surface\) 60%, var\(--border\)\);/u,
  "Text skeletons must use a slightly stronger theme-aware surface now that placeholder borders are removed.",
);
assert.match(
  loading,
  /\.mflDataPlaceholder\s*\{[\s\S]*?border:\s*0;/u,
  "Shared skeleton placeholders must be borderless while loaded components retain their own borders.",
);
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
  /\.mflSkeletonTextFill\s*\{[\s\S]*inline-size: 100%;[\s\S]*block-size: 0\.68em;[\s\S]*background: var\(--mfl-loading-text-placeholder-surface\);/u,
  "The text mask must inherit representative geometry while using the stronger borderless text-placeholder surface.",
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
  stylesBase,
  /\.mflStatsHistogramFill\s*\{/u,
  "Loaded Stats CSS must retain the real histogram fill geometry and animation.",
);
assert.match(
  bootstrap,
  /createDataPlaceholder\("mflStatsHistogramFill mflStatsHistogramSkeletonFill"\)/u,
  "Stats skeleton columns must reuse the real histogram fill geometry.",
);
assert.match(
  bootstrap,
  /Math\.exp\(-0\.5 \* distance \* distance\)/u,
  "Cold Stats loading must present several bell-shaped columns instead of one generic block.",
);
assert.match(
  bootstrap,
  /fill\.style\.setProperty\("--bar-height", `\$\{bellHeight\}%`\);/u,
  "Stats skeleton sample data must flow through the same --bar-height contract as loaded data.",
);
assert.match(
  responsive,
  /\.mflStatsHistogram\s*\{[\s\S]*min-width:/u,
  "Stats skeletons must inherit responsive histogram sizing from the loaded histogram.",
);

assert.doesNotMatch(
  databaseStats + mflStats,
  /mflStatsHistogramLayout/u,
  "Stats loaded renderers must not maintain a parallel histogram geometry class.",
);
for (const inlineGeometry of ["style.display", "style.gridTemplateColumns", "style.alignItems", "style.gap", "style.width", "style.height", "style.paddingTop", "style.minWidth"]) {
  assert.doesNotMatch(
    databaseStats + mflStats,
    new RegExp(`histogram\\.${inlineGeometry.replace(".", "\\.")}`, "u"),
    `Stats histogram geometry must come from .mflStatsHistogram CSS, not inline ${inlineGeometry}.`,
  );
}
assert.doesNotMatch(
  bootstrap,
  /const heights = \[/u,
  "Stats loading must not own a separate hard-coded bar-height array.",
);
assert.match(
  bootstrap,
  /previousLabels\.length > 1[\s\S]*\["55", "58", "61", "64", "67", "70", "73", "76", "79", "82", "85", "88", "91", "94", "97"\]/u,
  "Stats cold loading must reserve several representative columns while revisits reuse the previous loaded column count.",
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

assert.equal(
  myClubs.split('countryFlagElement(club?.nation, "clubLocationFlag")').length - 1,
  1,
  "My Clubs must render the real country flag only in the fully loaded card.",
);
assert.match(
  myClubs,
  /function skeletonCard\(club\)[\s\S]*flag\.className = "clubLocationFlag mflDataPlaceholder";[\s\S]*flag\.setAttribute\("aria-hidden", "true"\);[\s\S]*locationLine\.appendChild\(flag\);/u,
  "My Clubs loading cards must reserve the flag's loaded geometry with the shared skeleton placeholder until enrichment completes.",
);
assert.match(
  myClubsCssSource,
  /\.myClubLocation\s*\{[\s\S]*display: inline-flex;[\s\S]*align-items: center;[\s\S]*gap: 6px;/u,
  "My Clubs location flags must share one loaded/loading inline geometry with the city text.",
);
assert.match(
  myClubsCssSource,
  /\.myClubLocation \.clubLocationFlag\s*\{[\s\S]*width: 16px;[\s\S]*height: 16px;/u,
  "My Clubs country flag size must be CSS-owned and stable across loaded/loading cards.",
);

assert.doesNotMatch(
  bootstrap,
  /<h2 class="tablePageTitle playerTitle">/u,
  "Bootstrap fallback Player title must use the exact hydrated title class structure.",
);
assert.match(
  bootstrap,
  /<h2 class="playerTitle"><span class="playerTitleName">/u,
  "Bootstrap fallback Player title must retain the hydrated Player title classes.",
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
assert.match(
  stylesBase,
  /\.stats > div > span\s*\{[\s\S]*font-size: 20px;[\s\S]*font-weight: 700;/u,
  "Header Players/Wallets values must own their typography without restyling nested skeleton spans.",
);
assert.doesNotMatch(
  stylesBase,
  /\.stats span\s*\{/u,
  "Header Stats must not use a descendant span selector that overrides skeleton alignment.",
);
assert.match(
  stylesBase,
  /\.mflStatsCards article > span\s*\{[\s\S]*font-size: var\(--mfl-metadata-compact-font-size\);/u,
  "Stats card labels must target only the direct label span so value skeletons inherit <strong> typography.",
);
assert.doesNotMatch(
  stylesBase,
  /\.mflStatsCards span\s*\{/u,
  "Stats cards must not restyle nested value skeleton spans as metadata labels.",
);
assert.match(
  stylesBase,
  /\.mflStatsCards article\s*\{[\s\S]*min-height: 68px;[\s\S]*padding: 8px 10px;/u,
  "Stats card box size must remain owned by the loaded article geometry during loading.",
);
assert.match(stylesBase, /\.settingsIdentity strong\s*\{[\s\S]*margin-top: 4px;/u, "Settings identity must retain ownership of its real text layout.");

assert.match(
  myClubs,
  /const MIN_COMPETITION_ROWS = 2;/u,
  "My Clubs loading and loaded competition rows must share one minimum-row contract.",
);
assert.match(
  myClubs,
  /for \(let index = 0; index < MIN_COMPETITION_ROWS; index \+= 1\)/u,
  "My Clubs loading competition rows must consume the shared minimum-row contract.",
);
assert.match(
  myClubs,
  /while \(list\.children\.length < MIN_COMPETITION_ROWS\)/u,
  "My Clubs loaded competition rows must consume the same minimum-row contract.",
);
assert.match(
  myClubs,
  /const card = document\.createElement\("a"\);[\s\S]*card\.className = "myClubCard myClubCardLoading";/u,
  "My Clubs skeleton cards must use the same anchor element as loaded cards.",
);
assert.match(
  myClubs,
  /const nameLine = document\.createElement\("h3"\);[\s\S]*nameLine\.className = "myClubName";/u,
  "My Clubs skeleton club names must use the same semantic heading as loaded cards.",
);
assert.match(
  myClubs,
  /Reflect\.get\(window, "__mflCreateTextSkeleton"\)/u,
  "My Clubs text placeholders must use the shared representative-text skeleton foundation.",
);
for (const retiredLoadingGeometry of [
  "myClubLoadingLine",
  "myClubLoadingId",
  "myClubLoadingName",
  "myClubLoadingDivision",
  "myClubLoadingLocation",
  "myClubLoadingCompetitionName",
  "myClubLoadingCompetitionStanding",
  "myClubLoadingLogo",
  "myClubMetaLoading",
]) {
  assert.doesNotMatch(myClubs + myClubsCss, new RegExp(retiredLoadingGeometry, "u"), `My Clubs must not retain independent loading geometry via ${retiredLoadingGeometry}.`);
}
for (const match of myClubsCss.matchAll(/\.(?:myClub[^\s,{]*Loading[^\s,{]*)\s*\{([\s\S]*?)\n\}/gu)) {
  assert.doesNotMatch(
    match[1],
    /\b(?:width|height|min-width|max-width|min-height|max-height|aspect-ratio|align-items|justify-content|gap|padding|margin|border-radius|display|grid-template-columns|flex-direction)\s*:/u,
    `My Clubs loading-only selector must not own geometry: ${match[0].split("{", 1)[0].trim()}.`,
  );
}
assert.match(bootstrap, /LOADING_TEXT_SAMPLES/u, "Scalar loaded elements must use representative content while inheriting their existing CSS.");

assert.doesNotMatch(bootstrap, /!important/u, "Bootstrap loading must not introduce CSS priority overrides.");
assert.doesNotMatch(bootstrap, /document\.createElement\("style"\)/u, "Bootstrap loading must not inject a second style owner.");

console.log("Data-shaped loading follows loaded component typography, alignment, wrappers, and responsive geometry across every async route family.");
