import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, appConfig, routeLoader, buildCore, bootstrap, walletPreferencesApi, stylesBase, generatedPlayer] = await Promise.all([
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
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./bootstrap.js"),
  read("./api/wallet-preferences.js"),
  read("./styles-base.css"),
  read("./modules/app-core-player-runtime.js"),
]);
const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const playerCore = String(artifacts.routeChunks?.player || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Player split.");
invariant(playerCore.length > 12_000, "The Player core is too small to represent Player-detail ownership.");
new Function(sharedCore);
new Function(playerCore);

for (const required of [
  "function renderPlayerPage(playerId) {",
  "const owner = window.__mflRenderPlayerPageOwner;",
  "function primaryPreciseOverall(row) {",
  "async function copyPlayerId(id) {",
  "window.__mflPlayerFirstPaintPendingContext = pendingContext;",
  "function playerFirstPaintNavigationContext(playerId) {",
  "window.__mflBuildPlayerFirstPaintContext = playerFirstPaintNavigationContext;",
  'await window.__mflEnsureRouteRuntime("player", { ...incomingOptions, playerId });',
  "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});",
]) includes(sharedCore, required, `Shared Player handoff is missing ${required}`);

for (const forbidden of [
  "function renderPitch(row) {",
  "function playerTrainingKey(row) {",
  "function playerAttributeColumns(row) {",
  "function nextOverallDetailHtml(row, column) {",
  "function renderPlayerAttributePanel(row) {",
  "const infoCardsData = [",
]) excludes(sharedCore, forbidden, `Player-only ownership leaked into shared core: ${forbidden}`);

for (const required of [
  "function renderPitch(row) {",
  "function playerTrainingKey(row) {",
  "function adjustTrainingStat(playerId, column, delta) {",
  "function playerAttributeColumns(row) {",
  "function nextOverallDetailHtml(row, column) {",
  "function renderPlayerAttributePanel(row) {",
  "function contractClubId(playerId, teamName) {",
  "function bindContractTeamLink(playerId) {",
  "function renderPlayerPageOwner(playerId) {",
  "function renderPlayerPageWithStableContractLinkOwner(playerId) {",
  "window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;",
  "const infoCardsData = [",
  'document.documentElement.dataset.initialEntityVerified = "player";',
  "function beginDetailNavigation(value) {",
  "function renderPending(value = {}) {",
  "function detailDataReady(row, playerIdValue) {",
  "function createPendingPlayerGrid(context) {",
  "function pendingPitchHtml() {",
  "function playerAttributeLoadingActive(playerIdValue = playerIdFromLocation()) {",
  "function attributeViewForRender(selectedView, playerIdValue = playerIdFromLocation()) {",
]) includes(playerCore, required, `Canonical Player core is missing ${required}`);

includes(playerCore, 'const PLAYER_DETAIL_REQUIRED_COLUMNS = ["height", "preferred_foot", "goalkeeping", "retirement_years"]', "Player detail readiness must require authoritative detail columns.");
includes(playerCore, "if (pendingDetailPlayerId === playerId && readyDetailPlayerId !== playerId) return false;", "Pending Player detail must not render before authoritative detail readiness.");
includes(playerCore, "const PLAYER_NOTE_MAX_LENGTH = 100;", "Player note limit must remain 100 characters.");
includes(playerCore, "input.maxLength = PLAYER_NOTE_MAX_LENGTH;", "Player note input must enforce the canonical note limit.");
includes(bootstrap, ">0/100</span>", "Bootstrap Player notes shell must reserve the 100-character counter.");
includes(walletPreferencesApi, "const PLAYER_NOTE_MAX_LENGTH = 100;", "Wallet preferences API must enforce the 100-character Player note limit.");

includes(playerCore, 'return "\\u00A0";', "Pending Player values must remain blank rather than legacy dashes.");
includes(playerCore, "pitch.innerHTML = pendingPitchHtml();", "Static pitch geometry must exist during pending Player paint.");
includes(playerCore, 'if (storedWalletOptIn()) stack.appendChild(createPendingNotesPanel(context));', "Pending Player notes must respect wallet opt-in.");
includes(playerCore, 'views.style.visibility = "visible";', "Player views must remain visible during the stable pending shell.");

includes(playerCore, "const PLAYER_HERO_OVERALL_SIZE_PX = 100;", "Player hero Overall geometry must remain canonical.");
includes(playerCore, "const PLAYER_HERO_IDENTITY_WIDTH_PX = 360;", "Player hero identity width must remain canonical.");
includes(playerCore, "const PLAYER_HERO_IDENTITY_OVERALL_GAP_PX = 220;", "Player hero identity gap must remain stable.");
includes(stylesBase, ".playerHero {\n  box-sizing: border-box;\n  display: flex;", "Render-blocking CSS must own Player hero geometry before route JavaScript runs.");
excludes(playerCore, "!important", "Player route core must not use CSS priority overrides.");

includes(appConfig, 'player: "/modules/app-core-player-runtime.js"', "Canonical app config must map Player to its generated core.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "Route-core loader must consume canonical core paths.");
includes(buildCore, 'Object.freeze({ source: "player.js", runtime: "app-core-player-runtime.js"', "Core build must generate Player directly from its canonical source.");
excludes(buildCore, "app-core-player-chunk.js", "Core build must not depend on the retired Player splitter.");

const banner = "// Generated Player core from modules/core-sources/player.js. Do not edit directly.\n";
invariant(
  generatedPlayer.startsWith(banner) && generatedPlayer.slice(banner.length).replace(/\s*$/, "") === playerCore.replace(/\s*$/, ""),
  "Generated Player runtime must exactly match its canonical source.",
);

console.log("Player route core validation passed: source-owned pending/detail rendering, stable hero geometry, note limits, lazy route ownership, and deterministic generated output.");
