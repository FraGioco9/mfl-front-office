import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, label) => invariant(source.includes(value), `${label}: missing ${value}`);
const excludes = (source, value, label) => invariant(!source.includes(value), `${label}: forbidden ${value}`);

const [coreSource, playerSplitter, stylesBase] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-player-chunk.js"),
  read("./styles-base.css"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const playerCore = String(artifacts.routeChunks?.player || "");

const required = [
  'const PLAYER_PENDING_OVERALL_BACKGROUND = "var(--surface)";',
  'primary.style.color = unavailable ? "var(--text-soft)" : "#ffffff";',
  'const PLAYER_LOADED_OVERALL_BACKGROUND = "linear-gradient(',
  "function hasLoadedOverall(overall) {",
  "return Number.isFinite(value) && value > 0;",
  "function applyLoadedOverallBackground(box, complete = false) {",
  "box.style.background = PLAYER_LOADED_OVERALL_BACKGROUND;",
  'box.style.backgroundColor = "var(--surface)";',
  'box.style.backgroundSize = complete ? "100% 100%, 100% 100%" : "100% 0%, 100% 0%";',
  "function overallRarityPaintComplete(box) {",
  'detail.classList.contains("playerOverallRarityPaintComplete")',
  "function applyOverallBoxAppearance(box, overall) {",
  'box.classList.toggle("isPending", !loaded);',
  'box.style.removeProperty("--rarity-color");',
  "box.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;",
  'box.style.setProperty("--rarity-color", rarityColor(overall));',
  "if (overallRarityPaintComplete(box)) {",
  "applyLoadedOverallBackground(box, true);",
  "overall.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;",
  "const overallLoaded = applyOverallBoxAppearance(overall, context.overall);",
  "overallValue.textContent = overallLoaded ? context.overall : loadingBlank();",
  'if (column === "overall") applyOverallBoxAppearance(card, context.overall);',
  'let rarityPaintPlayerId = "";',
  'detail.classList.remove("playerOverallRarityPaintComplete");',
  'detail.removeAttribute("data-player-overall-rarity-painted");',
  "function animateReadyOverallBoxes(container = document) {",
  "if (rarityPaintPlayerId === playerId || detail.dataset.playerOverallRarityPainted === playerId) return false;",
  'detail.dataset.playerOverallRarityPainted = playerId;',
  'const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);',
  "applyLoadedOverallBackground(box, reduceMotion);",
  'box.classList.add("rarityPaintOnce");',
  'detail.classList.add("playerOverallRarityPaintComplete");',
  "function animateReadyControls(container = document) {",
  "if (playerAttributeLoadingActive(playerId)) {",
  "scheduleReadyControlsAfterLoading(playerId);",
  "const rarityPainted = animateReadyOverallBoxes(container);",
  "if (!controls.length) return rarityPainted;",
  "function createPendingAttributesPanel(context) {",
  'heading.textContent = "Attributes";',
  "value.textContent = pendingAttributeValue(context, column) || loadingBlank();",
  "const routeContext = { playerId: routePlayerId };",
  "beginDetailNavigation(routeContext);",
  "renderPending(routeContext);",
];

for (const [label, source] of [
  ["Player splitter", playerSplitter],
  ["Generated Player core", playerCore],
]) {
  for (const value of required) includes(source, value, label);
  excludes(source, 'overall.classList.toggle("isPending", !overallLoaded);', label);
  excludes(source, 'overall.style.setProperty("--rarity-color", rarityColor(context.overall));', label);
  excludes(source, 'if (column === "overall") card.style.setProperty("--rarity-color", rarityColor(context.overall));', label);
  excludes(
    source,
    'else if (routePlayerId) {\n    renderPending({ playerId: routePlayerId });',
    `${label}: hard refresh must enter the pending gate before a cached selected-view row can render`,
  );
  const matchingRowIndex = source.indexOf("const matchingRow = payload.rows.find");
  const readyIndex = source.indexOf("readyDetailPlayerId = routePlayerId;");
  invariant(
    matchingRowIndex >= 0 && readyIndex > matchingRowIndex,
    `${label}: detail readiness must only be granted after the authoritative matching row is validated`,
  );

  const appearanceStart = source.indexOf("function applyOverallBoxAppearance(box, overall) {");
  const appearanceEnd = source.indexOf("function storedWalletOptIn() {", appearanceStart);
  const appearanceBody = source.slice(appearanceStart, appearanceEnd);
  const raritySetIndex = appearanceBody.indexOf('box.style.setProperty("--rarity-color", rarityColor(overall));');
  const neutralIndex = appearanceBody.lastIndexOf("box.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;");
  invariant(
    raritySetIndex >= 0 && neutralIndex > raritySetIndex,
    `${label}: a loaded Overall must remain on the theme surface (white in light mode) until the rarity paint is explicitly started`,
  );

  const readyControlsStart = source.indexOf("function animateReadyControls(container = document) {");
  const readyControlsEnd = source.indexOf('document.addEventListener("pointerdown"', readyControlsStart);
  const readyControlsBody = source.slice(readyControlsStart, readyControlsEnd);
  const primeIndex = readyControlsBody.indexOf('control.style.transition = "none";');
  const loadingGateIndex = readyControlsBody.indexOf("if (playerAttributeLoadingActive(playerId)) {");
  const releaseIndex = readyControlsBody.indexOf("window.requestAnimationFrame(() => {");
  invariant(
    readyControlsStart >= 0 && primeIndex >= 0 && loadingGateIndex > primeIndex && releaseIndex > loadingGateIndex,
    `${label}: Player ready controls must be frozen in their grey start state before loading ends, then released exactly once afterward`,
  );

  const placeHeroStart = source.indexOf("function placeHeroMedia(hero, context) {");
  const placeHeroEnd = source.indexOf("function createPendingHeroActions(context) {", placeHeroStart);
  const placeHeroBody = source.slice(placeHeroStart, placeHeroEnd);
  const insertMediaIndex = placeHeroBody.indexOf("hero.insertBefore(media, identity instanceof HTMLElement ? identity : hero.firstChild);");
  const refreshAppearanceIndex = placeHeroBody.lastIndexOf("updateHeroMedia(media, context);");
  invariant(
    placeHeroStart >= 0 && insertMediaIndex >= 0 && refreshAppearanceIndex > insertMediaIndex,
    `${label}: Player hero Overall appearance must be refreshed after newly created media is attached so view rerenders preserve the completed rarity colour`,
  );
}

for (const value of [
  "#playerDetail:not(.playerOverallRarityPaintComplete) .playerHeroOverall:not(.isPending),",
  "#playerDetail:not(.playerOverallRarityPaintComplete) .playerAttributeCard.featured:not(.isPending) {",
  "background: var(--surface);",
  "@keyframes playerOverallRarityPaint {",
  "background-size: 100% 0%, 100% 0%;",
  "background-size: 100% 100%, 100% 100%;",
  ".playerHeroOverall.rarityPaintOnce,",
  ".playerAttributeCard.featured.rarityPaintOnce {",
  "background-position: center bottom, center;",
  "background-repeat: no-repeat;",
  "animation: playerOverallRarityPaint 420ms cubic-bezier(0.22, 1, 0.36, 1) both;",
  "@media (prefers-reduced-motion: reduce) {",
  "animation: none;",
]) {
  includes(stylesBase, value, "Player Overall rarity paint stylesheet");
}

const prePaintStart = stylesBase.indexOf("#playerDetail:not(.playerOverallRarityPaintComplete) .playerHeroOverall:not(.isPending),");
const keyframesStart = stylesBase.indexOf("@keyframes playerOverallRarityPaint", prePaintStart);
const prePaintCss = stylesBase.slice(prePaintStart, keyframesStart);
const rarityKeyframesStart = stylesBase.indexOf("@keyframes playerOverallRarityPaint", prePaintStart);
const rarityRulesStart = stylesBase.indexOf(".playerHeroOverall.rarityPaintOnce,", rarityKeyframesStart);
const rarityKeyframesCss = stylesBase.slice(rarityKeyframesStart, rarityRulesStart);
includes(rarityKeyframesCss, "background-size: 100% 0%, 100% 0%;", "Player Overall rarity paint must start with both gradient layers collapsed so the theme surface is the first visible frame");
excludes(rarityKeyframesCss, "background-size: 100% 0%, 100% 100%;", "Player Overall rarity paint must not expose the dark overlay layer on its first frame");
includes(prePaintCss, "background: var(--surface);", "Player Overall pre-paint stylesheet");
excludes(prePaintCss, "background-size:", "Player Overall pre-paint stylesheet must not arm a loaded gradient before transition start");
excludes(prePaintCss, "background: #1d252c;", "Player Overall pre-paint stylesheet must not hardcode the dark muted surface");
excludes(prePaintCss, "background: var(--surface-muted);", "Player Overall pre-paint stylesheet must start from the theme surface, not the muted surface");

console.log("Rebased Player loading keeps one rarity paint and exactly one ready-control grey-to-normal release.");
