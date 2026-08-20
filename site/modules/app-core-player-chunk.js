// @ts-check

import {
  extractRequiredSection,
  extractRequiredSections,
  finalizeSplitArtifacts,
  normalizeSplitterInput,
} from "./app-core-splitter-utils.js";

const PLAYER_SECTIONS = [
  ["function renderPitch(row) {", "function playerPositions(row) {", "Player pitch renderer"],
  ["function playerTrainingKey(row) {", "function primaryPreciseOverall(row) {", "Player training and attribute configuration"],
  ["function nextOverallDetailHtml(row, column) {", "async function copyPlayerId(id) {", "Player attribute panel renderer"],
];

export function splitPlayerApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core: inputCore } = normalizeSplitterInput(
    artifacts,
    "player",
    "Player ownership",
  );
  if (alreadySplit) return artifacts;

  const extractedSections = extractRequiredSections(inputCore, PLAYER_SECTIONS);
  let core = extractedSections.core;
  const playerParts = [...extractedSections.chunks];

  const renderer = extractRequiredSection(
    core,
    "function renderPlayerPage(playerId) {",
    "function showModal(modal) {",
    "Player page renderer owner",
  );
  core = renderer.core;
  const playerRenderer = renderer.chunk.replace(
    "function renderPlayerPage(playerId) {",
    "function renderPlayerPageOwner(playerId) {",
  );
  if (!playerRenderer.includes("function renderPlayerPageOwner(playerId) {")) {
    throw new Error("Could not rename the Player page renderer owner.");
  }
  playerParts.push(`${playerRenderer}\n\nwindow.__mflRenderPlayerPageOwner = renderPlayerPageOwner;`);

  const sharedPlayerFacade = [
    "function renderPlayerPage(playerId) {",
    "  const owner = window.__mflRenderPlayerPageOwner;",
    '  if (typeof owner !== "function") {',
    '    throw new Error("Player route core is not loaded.");',
    "  }",
    "  return owner(playerId);",
    "}",
    "",
  ].join("\n");
  const modalMarker = "function showModal(modal) {";
  if (!core.includes(modalMarker)) {
    throw new Error("Could not install the shared Player renderer facade.");
  }
  core = core.replace(modalMarker, `${sharedPlayerFacade}${modalMarker}`);

  return finalizeSplitArtifacts(
    core,
    routeChunks,
    "player",
    playerParts.join("\n\n"),
    "Player",
  );
}
