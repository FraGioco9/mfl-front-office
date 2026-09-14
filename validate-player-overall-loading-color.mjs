import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const includes = (source, value, label) => invariant(source.includes(value), `${label}: missing ${value}`);
const excludes = (source, value, label) => invariant(!source.includes(value), `${label}: forbidden ${value}`);

const [coreSource, stylesBase, playerHtml] = await Promise.all([
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./styles-base.css"),
  read("./html-sources/player.html"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const playerCore = String(artifacts.routeChunks?.player || "");

for (const value of [
  'const PLAYER_PENDING_OVERALL_BACKGROUND = "var(--surface)";',
  'const PLAYER_LOADED_OVERALL_BACKGROUND = "linear-gradient(',
  "function hasLoadedOverall(overall) {",
  "function applyLoadedOverallBackground(box) {",
  'box.style.backgroundSize = "100% 100%, 100% 100%";',
  "function applyOverallBoxAppearance(box, overall) {",
  'box.classList.toggle("isPending", !loaded);',
  'box.style.setProperty("--rarity-color", rarityColor(overall));',
  "applyLoadedOverallBackground(box);",
  "const overallLoaded = applyOverallBoxAppearance(overall, context.overall);",
  "function animateReadyControls(container = document) {",
]) includes(playerCore, value, "Canonical Player core");

for (const value of [
  "function animateReadyOverallBoxes(",
  "rarityPaintPlayerId",
  "playerOverallRarityPaintComplete",
  "playerOverallRarityPainted",
  "rarityPaintOnce",
  "@keyframes playerOverallRarityPaint",
  "animation: playerOverallRarityPaint",
]) {
  excludes(playerCore, value, "Canonical Player core");
  excludes(stylesBase, value, "Player Overall stylesheet");
}

const appearanceStart = playerCore.indexOf("function applyOverallBoxAppearance(box, overall) {");
const appearanceEnd = playerCore.indexOf("function storedWalletOptIn() {", appearanceStart);
const appearanceBody = playerCore.slice(appearanceStart, appearanceEnd);
const raritySetIndex = appearanceBody.indexOf('box.style.setProperty("--rarity-color", rarityColor(overall));');
const loadedBackgroundIndex = appearanceBody.indexOf("applyLoadedOverallBackground(box);");
invariant(
  raritySetIndex >= 0 && loadedBackgroundIndex > raritySetIndex,
  "Loaded Overall boxes must receive their rarity colour and final background immediately in one render pass.",
);

for (const value of [
  "const playerFirstPaintRarityColor = (overallValue) => {",
  'const playerFirstPaintOverallBackground = "linear-gradient(',
  "const applyCachedOverallAppearance = (box, overallValue) => {",
  'box.classList.remove("isPending");',
  'box.style.setProperty("--rarity-color", playerFirstPaintRarityColor(overallValue));',
  'box.style.backgroundSize = "100% 100%, 100% 100%";',
  'applyCachedOverallAppearance(overall?.closest(".playerHeroOverall"), overallValue);',
  "applyCachedOverallAppearance(overallCard, overallValue);",
  "if (index === 0) applyCachedOverallAppearance(card, cachedValue);",
]) includes(playerHtml, value, "Player first-paint Overall rarity");

console.log("Canonical Player Overall boxes render their final rarity colour immediately, including cached first paint, with no rarity transition.");
