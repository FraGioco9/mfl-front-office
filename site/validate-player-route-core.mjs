import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, playerSplitter, appConfig, routeLoader, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const playerCore = String(artifacts.routeChunks?.player || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Player split.");
invariant(playerCore.length > 12_000, "The Player core chunk is too small to represent the Player-detail renderer owner.");
new Function(sharedCore);
new Function(playerCore);

includes(playerSplitter, '"Player pitch renderer"', "The Player splitter must extract pitch rendering.");
includes(playerSplitter, '"Player training and attribute configuration"', "The Player splitter must extract training and attribute configuration.");
includes(playerSplitter, '"Player attribute panel renderer"', "The Player splitter must extract Player attribute-card rendering.");
includes(playerSplitter, '"Player page renderer owner"', "The Player splitter must extract the heavy Player page renderer.");
includes(playerSplitter, '"Player contract-link helper"', "The Player splitter must extract contract-link helpers.");
includes(playerSplitter, '"Player contract-link shared wrapper"', "The Player splitter must remove the eager contract-link wrapper.");
includes(playerSplitter, "finalizeSplitArtifacts(", "The Player splitter must use canonical split-result finalization.");
includes(playerSplitter, '"player"', "The Player splitter must publish the Player chunk through canonical finalization.");

includes(sharedCore, "function renderPlayerPage(playerId) {", "The shared core must retain the stable Player page renderer facade called by shared refresh paths.");
includes(sharedCore, "const owner = window.__mflRenderPlayerPageOwner;", "The stable shared Player renderer must dispatch to the route-owned implementation.");
includes(sharedCore, "function primaryPreciseOverall(row) {", "Shared table/Evaluation overall math must remain universal.");
includes(sharedCore, "async function copyPlayerId(id) {", "Shared clipboard behavior must remain universal.");
includes(sharedCore, "renderPlayerPageWithNoteLimit", "The Player note-limit wrapper must remain shared around the stable renderer facade.");
excludes(sharedCore, "renderPlayerPageWithStableContractLink", "The Player contract-link wrapper must not remain eager in shared core.");
excludes(sharedCore, "function contractClubId(playerId, teamName) {", "Player contract-link club resolution must not remain eager in shared core.");
excludes(sharedCore, "function bindContractTeamLink(playerId) {", "Player contract-link DOM binding must not remain eager in shared core.");
excludes(sharedCore, "function renderPitch(row) {", "Player pitch rendering must not remain in the shared core.");
excludes(sharedCore, "function playerTrainingKey(row) {", "Player training state helpers must not remain in the shared core.");
excludes(sharedCore, "function playerAttributeColumns(row) {", "Player attribute configuration must not remain in the shared core.");
excludes(sharedCore, "function nextOverallDetailHtml(row, column) {", "Player Next Overall card rendering must not remain in the shared core.");
excludes(sharedCore, "function renderPlayerAttributePanel(row) {", "Player attribute-panel rendering must not remain in the shared core.");
excludes(sharedCore, "const infoCardsData = [", "Heavy Player page DOM construction must not remain in the shared core.");

includes(playerCore, "function renderPitch(row) {", "The Player chunk must own pitch rendering.");
includes(playerCore, "function playerTrainingKey(row) {", "The Player chunk must own training state helpers.");
includes(playerCore, "function adjustTrainingStat(playerId, column, delta) {", "The Player chunk must own training interaction behavior.");
includes(playerCore, "function playerAttributeColumns(row) {", "The Player chunk must own attribute configuration.");
includes(playerCore, "function nextOverallDetailHtml(row, column) {", "The Player chunk must own Next Overall detail rendering.");
includes(playerCore, "function renderPlayerAttributePanel(row) {", "The Player chunk must own attribute-panel rendering.");
includes(playerCore, "function contractClubId(playerId, teamName) {", "The Player chunk must own contract-link club resolution.");
includes(playerCore, "function bindContractTeamLink(playerId) {", "The Player chunk must own contract-link DOM binding.");
includes(playerCore, "function renderPlayerPageOwner(playerId) {", "The Player chunk must own the heavy Player page renderer implementation.");
includes(playerCore, "function renderPlayerPageWithStableContractLinkOwner(playerId) {", "The Player chunk must own stable contract-link rendering.");
includes(playerCore, "window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;", "The Player chunk must install its final renderer behind the shared facade.");
includes(playerCore, "const infoCardsData = [", "The Player chunk must contain Player page DOM construction.");
includes(playerCore, 'window.__mflStaticUiRuntime?.showNotFound?.("Player");', "Missing Player IDs must use the shared not-found surface.");
includes(playerCore, 'document.documentElement.dataset.initialEntityVerified = "player";', "A confirmed Player must release the guarded first-paint Player shell.");
excludes(playerCore, "function primaryPreciseOverall(row) {", "Shared overall math must not become Player-only.");
excludes(playerCore, "async function copyPlayerId(id) {", "Shared copy behavior must not become Player-only.");
excludes(playerCore, "function renderPlayerPage(playerId) {", "The stable Player renderer name must remain shared for existing wrappers and refresh owners.");

includes(appConfig, 'player: "/modules/app-core-player-runtime.js"', "Canonical app config must map Player to its generated chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
includes(coreSource, "const playerMatch = cleanPath.match(", "Canonical app-core source must recognize /players/<id> routes directly.");
includes(coreSource, "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});", "Direct Player startup must load route dependencies before startApp.");

includes(buildCore, 'const playerRuntimePath = resolve(siteRoot, "modules/app-core-player-runtime.js");', "The build must emit a generated Player runtime.");
includes(buildCore, "artifacts.routeChunks?.player", "The build must consume the Player artifact.");
includes(coreSource, 'icon: "calendar-x-2"', "Canonical app-core source must own the retired-player marker contract directly.");
includes(coreSource, 'icon: "calendar-clock"', "Canonical app-core source must own the retiring-player marker contract directly.");
excludes(buildCore, "normalizeRetirementMarkerContract", "The build must not restore retirement-marker source rewriting.");
excludes(buildCore, "normalizeTooltipHeightOwnership", "The build must not restore post-split tooltip rewriting.");

const generatedPlayer = await read("./modules/app-core-player-runtime.js");
const playerBanner = "// Generated Player core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedPlayer.startsWith(playerBanner), "Generated Player runtime must carry the build ownership banner.");
const generatedPlayerBody = generatedPlayer.slice(playerBanner.length).replace(/\s*$/, "");
invariant(generatedPlayerBody.length > 12_000, "Generated Player runtime is unexpectedly small.");
new Function(generatedPlayerBody);
for (const owner of [
  "function renderPitch(row) {",
  "function playerTrainingKey(row) {",
  "function renderPlayerAttributePanel(row) {",
  "function contractClubId(playerId, teamName) {",
  "function bindContractTeamLink(playerId) {",
  "function renderPlayerPageOwner(playerId) {",
  "function renderPlayerPageWithStableContractLinkOwner(playerId) {",
  "window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;",
]) {
  includes(generatedPlayerBody, owner, `Generated Player runtime must retain route owner ${owner}.`);
}
includes(generatedPlayerBody, 'retirementMarker--${escapeHtml(ageMarker.status || "default")}', "Generated Player runtime must contain the build-time retirement marker contract.");
includes(generatedPlayerBody, 'document.documentElement.dataset.initialEntityVerified = "player";', "Generated Player runtime must preserve first-paint identity verification.");

console.log("Player route-core splitting and guarded first-paint identity validation passed.");
