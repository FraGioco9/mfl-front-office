import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, label) => invariant(source.includes(value), `${label}: missing ${value}`);
const excludes = (source, value, label) => invariant(!source.includes(value), `${label}: forbidden ${value}`);

const [coreSource, stylesBase] = await Promise.all([
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
  read("./styles-base.css"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const playerCore = String(artifacts.routeChunks?.player || "");

for (const value of [
  'const PLAYER_PENDING_OVERALL_BACKGROUND = "var(--surface)";',
  'primary.style.color = unavailable ? "var(--text-soft)" : "#ffffff";',
  'const PLAYER_LOADED_OVERALL_BACKGROUND = "linear-gradient(',
  "function hasLoadedOverall(overall) {",
  "function applyLoadedOverallBackground(box, complete = false) {",
  "function overallRarityPaintComplete(box) {",
  "function applyOverallBoxAppearance(box, overall) {",
  'box.classList.toggle("isPending", !loaded);',
  'box.style.setProperty("--rarity-color", rarityColor(overall));',
  "applyLoadedOverallBackground(box, true);",
  "overall.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;",
  "const overallLoaded = applyOverallBoxAppearance(overall, context.overall);",
  "function animateReadyOverallBoxes(container = document) {",
  'detail.classList.add("playerOverallRarityPaintComplete");',
  "function animateReadyControls(container = document) {",
  "if (playerAttributeLoadingActive(playerId)) {",
]) includes(playerCore, value, "Canonical Player core");

excludes(playerCore, 'overall.classList.toggle("isPending", !overallLoaded);', "Canonical Player core");
excludes(playerCore, 'overall.style.setProperty("--rarity-color", rarityColor(context.overall));', "Canonical Player core");

const matchingRowIndex = playerCore.indexOf("const matchingRow = payload.rows.find");
const readyIndex = playerCore.indexOf("readyDetailPlayerId = routePlayerId;");
invariant(matchingRowIndex >= 0 && readyIndex > matchingRowIndex, "Player detail readiness must only be granted after the authoritative matching row is validated.");

const appearanceStart = playerCore.indexOf("function applyOverallBoxAppearance(box, overall) {");
const appearanceEnd = playerCore.indexOf("function storedWalletOptIn() {", appearanceStart);
const appearanceBody = playerCore.slice(appearanceStart, appearanceEnd);
const raritySetIndex = appearanceBody.indexOf('box.style.setProperty("--rarity-color", rarityColor(overall));');
const neutralIndex = appearanceBody.lastIndexOf("box.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;");
invariant(raritySetIndex >= 0 && neutralIndex > raritySetIndex, "A loaded Overall must remain on the theme surface until the rarity paint explicitly starts.");

for (const value of [
  "#playerDetail:not(.playerOverallRarityPaintComplete) .playerHeroOverall:not(.isPending),",
  "#playerDetail:not(.playerOverallRarityPaintComplete) .playerAttributeCard.featured:not(.isPending) {",
  "background: var(--surface);",
  "@keyframes playerOverallRarityPaint {",
  "background-size: 100% 0%, 100% 0%;",
  "background-size: 100% 100%, 100% 100%;",
  ".playerHeroOverall.rarityPaintOnce,",
  ".playerAttributeCard.featured.rarityPaintOnce {",
  "animation: playerOverallRarityPaint 420ms cubic-bezier(0.22, 1, 0.36, 1) both;",
  "@media (prefers-reduced-motion: reduce) {",
  "animation: none;",
]) includes(stylesBase, value, "Player Overall rarity paint stylesheet");

excludes(stylesBase.slice(stylesBase.indexOf("@keyframes playerOverallRarityPaint"), stylesBase.indexOf(".playerHeroOverall.rarityPaintOnce,")), "background-size: 100% 0%, 100% 100%;", "Player Overall rarity paint must not expose the dark overlay on its first frame.");

console.log("Canonical Player loading keeps one rarity paint and exactly one ready-control grey-to-normal release.");
