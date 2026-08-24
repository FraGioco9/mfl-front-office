// @ts-check

import {
  extractRequiredSection,
  extractRequiredSections,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  normalizeSplitterInput,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const PLAYER_SECTIONS = [
  ["function renderPitch(row) {", "function playerPositions(row) {", "Player pitch renderer"],
  ["function playerTrainingKey(row) {", "function primaryPreciseOverall(row) {", "Player training and attribute configuration"],
  ["function nextOverallDetailHtml(row, column) {", "async function copyPlayerId(id) {", "Player attribute panel renderer"],
];

const PLAYER_ROUTE_ONLY_FUNCTIONS = [
  "showPlayerNoteTooltip",
  "setPlayerNote",
  "normalizePlayerAttributeView",
  "formatFootedness",
  "rarityColorForOverall",
  "shortStatLabel",
  "playerNoteIconHtml",
  "measureTooltipAnchorWidth",
  "queueWalletNotesSave",
  "allowedPlayerAttributeViews",
  "toggleWatchlistPlayer",
  "createWatchlistStar",
];

const PLAYER_CONTRACT_LINK_FUNCTIONS = ["contractClubId", "bindContractTeamLink"];
const PLAYER_CONTRACT_LINK_WRAPPER = `  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithStableContractLink(playerId) {
      const result = originalRenderPlayerPage.apply(this, arguments);
      bindContractTeamLink(playerId);
      return result;
    };
  }
`;

export function splitPlayerApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core: inputCore } = normalizeSplitterInput(
    artifacts,
    "player",
    "Player ownership",
  );
  if (alreadySplit) return artifacts;

  const routeOnly = extractRequiredFunctions(inputCore, PLAYER_ROUTE_ONLY_FUNCTIONS, "Player route-only helper");
  const extractedSections = extractRequiredSections(routeOnly.core, PLAYER_SECTIONS);
  let core = extractedSections.core;
  const playerParts = [...routeOnly.chunks, ...extractedSections.chunks];

  const renderer = extractRequiredSection(
    core,
    "const playerDetailRenderReuse = createRenderReuseGuard();",
    "function showModal(modal) {",
    "Player page renderer owner",
  );
  core = renderer.core;
  let playerRenderer = renderer.chunk.replace(
    "function renderPlayerPage(playerId) {",
    "function renderPlayerPageOwner(playerId) {",
  );
  if (!playerRenderer.includes("function renderPlayerPageOwner(playerId) {")) {
    throw new Error("Could not rename the Player page renderer owner.");
  }
  playerRenderer = replaceRequired(
    playerRenderer,
    "      openAgentPage(agentWalletAddress);",
    '      openAgentPage(agentWalletAddress, formatCellValue(row, "wallet_name"));',
    "Player Agent name handoff",
  );

  const contractLink = extractRequiredFunctions(
    core,
    PLAYER_CONTRACT_LINK_FUNCTIONS,
    "Player contract-link helper",
  );
  core = contractLink.core;
  core = replaceRequired(
    core,
    PLAYER_CONTRACT_LINK_WRAPPER,
    "",
    "Player contract-link shared wrapper",
  );
  core = replaceRequired(
    core,
    '  const RELEASE_VERSION = String(window.__mflReleaseVersion || "");\n\n',
    "",
    "Player contract-link release constant",
  );

  const contractLinkHelpers = contractLink.chunks
    .join("\n\n")
    .replaceAll("RELEASE_VERSION", "PLAYER_RELEASE_VERSION");
  playerParts.push(`const PLAYER_RELEASE_VERSION = String(window.__mflReleaseVersion || "");\n\n${contractLinkHelpers}`);
  playerParts.push(`${playerRenderer}\n\nfunction renderPlayerPageWithStableContractLinkOwner(playerId) {
  const result = renderPlayerPageOwner.apply(this, arguments);
  bindContractTeamLink(playerId);
  return result;
}\n\nwindow.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;`);

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
