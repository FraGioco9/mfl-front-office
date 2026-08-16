import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, playerSplitter, routeLoader, routeNormalizer, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-player-chunk.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
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
includes(playerSplitter, "routeChunks: Object.freeze({ ...routeChunks, player })", "The artifact map must expose the Player chunk.");

includes(sharedCore, "function renderPlayerPage(playerId) {", "The shared core must retain the stable Player page renderer facade called by shared refresh paths.");
includes(sharedCore, "const owner = window.__mflRenderPlayerPageOwner;", "The stable shared Player renderer must dispatch to the route-owned implementation.");
includes(sharedCore, "function primaryPreciseOverall(row) {", "Shared table/Evaluation overall math must remain universal.");
includes(sharedCore, "async function copyPlayerId(id) {", "Shared clipboard behavior must remain universal.");
includes(sharedCore, "renderPlayerPageWithNoteLimit", "The Player note-limit wrapper must remain shared around the stable renderer facade.");
includes(sharedCore, "renderPlayerPageWithStableContractLink", "The Player contract-link wrapper must remain shared around the stable renderer facade.");
excludes(sharedCore, "function renderPitch(row) {", "Player pitch rendering must not remain in the shared core.");
excludes(sharedCore, "function playerTrainingKey(row) {", "Player training state helpers must not remain in the shared core.");
excludes(sharedCore, "function playerAttributeColumns(row) {", "Player attribute configuration must not remain in the shared core.");
excludes(sharedCore, "function nextOverallDetailHtml(row, column) {", "Player Next Overall card rendering must not remain in the shared core.");
excludes(sharedCore, "function renderPlayerAttributePanel(row) {", "Player attribute-panel rendering must not remain in the shared core.");
excludes(sharedCore, 'const playerName = formatCellValue(row, "name");', "Heavy Player page DOM construction must not remain in the shared core.");

includes(playerCore, "function renderPitch(row) {", "The Player chunk must own pitch rendering.");
includes(playerCore, "function playerTrainingKey(row) {", "The Player chunk must own training state helpers.");
includes(playerCore, "function adjustTrainingStat(playerId, column, delta) {", "The Player chunk must own training interaction behavior.");
includes(playerCore, "function playerAttributeColumns(row) {", "The Player chunk must own attribute configuration.");
includes(playerCore, "function nextOverallDetailHtml(row, column) {", "The Player chunk must own Next Overall detail rendering.");
includes(playerCore, "function renderPlayerAttributePanel(row) {", "The Player chunk must own attribute-panel rendering.");
includes(playerCore, "function renderPlayerPageOwner(playerId) {", "The Player chunk must own the heavy Player page renderer implementation.");
includes(playerCore, "window.__mflRenderPlayerPageOwner = renderPlayerPageOwner;", "The Player chunk must install its renderer behind the shared facade.");
includes(playerCore, 'const playerName = formatCellValue(row, "name");', "The Player chunk must contain Player page DOM construction.");
excludes(playerCore, "function primaryPreciseOverall(row) {", "Shared overall math must not become Player-only.");
excludes(playerCore, "async function copyPlayerId(id) {", "Shared copy behavior must not become Player-only.");
excludes(playerCore, "function renderPlayerPage(playerId) {", "The stable Player renderer name must remain shared for existing wrappers and refresh owners.");

includes(routeLoader, 'player: "/modules/app-core-player-runtime.js"', "The route-core loader must map Player to its generated chunk.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("player");', "Direct Player startup must load Player helpers before startApp.");
includes(routeNormalizer, '/^\\\\/players\\\\/[^/]+\\\\/?$/i', "Direct Player startup must recognize canonical /players/<id> routes.");

includes(buildCore, 'const playerRuntimePath = resolve(siteRoot, "modules/app-core-player-runtime.js");', "The build must emit a generated Player runtime.");
includes(buildCore, "artifacts.routeChunks?.player", "The build must consume the Player artifact.");

const generatedPlayer = await read("./modules/app-core-player-runtime.js");
const playerBanner = "// Generated Player core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedPlayer.startsWith(playerBanner), "Generated Player runtime must carry the build ownership banner.");
invariant(generatedPlayer.slice(playerBanner.length).replace(/\s*$/, "") === playerCore.replace(/\s*$/, ""), "Generated Player runtime must exactly match the Player build artifact.");

console.log("Player route-core splitting validation passed.");
