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

const PLAYER_REENTRY_CACHE_HELPER = `let playerDetailLastRenderSignature = "";

function playerDetailRenderSignature(row, playerId, attributeView) {
  const key = String(playerId || "").trim();
  return JSON.stringify([
    key,
    state.columns,
    row,
    attributeView,
    Boolean(hasWalletOptIn()),
    normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),
    Boolean(state.walletPermissionAllowed),
    Boolean(state.watchlistPlayerIds.has(key)),
    playerNote(key),
    state.settingsDateFormat,
    state.settingsTimeFormat,
    state.trainingAdjustments[key] || null,
  ]);
}`;

const PLAYER_NOT_FOUND_RENDER = `  if (!row) {
    playerDetailLastRenderSignature = "";
    window.__mflStaticUiRuntime?.showNotFound?.("Player");
    return;
  }
  const normalizedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);
  const renderSignature = playerDetailRenderSignature(row, playerId, normalizedAttributeView);
  if (playerDetailLastRenderSignature === renderSignature
      && playerDetail.firstElementChild?.classList.contains("playerHero")) {
    document.documentElement.dataset.initialEntityVerified = "player";
    return;
  }
  document.documentElement.dataset.initialEntityVerified = "player";`;

const PLAYER_RENDER_CACHE_COMMIT = `  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
  playerDetailLastRenderSignature = renderSignature;
}`;

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
    "function renderPlayerPage(playerId) {",
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
  playerRenderer = replaceRequired(
    playerRenderer,
    `  if (!row) {
    playerDetail.innerHTML = \`<div class="emptyState">Player \${escapeHtml(playerId || "")} was not found.</div>\`;
    return;
  }`,
    PLAYER_NOT_FOUND_RENDER,
    "Player cached re-entry guard and not-found route surface",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    "  state.playerAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);",
    "  state.playerAttributeView = normalizedAttributeView;",
    "Player normalized attribute view reuse",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    `  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
}`,
    PLAYER_RENDER_CACHE_COMMIT,
    "Player cached re-entry signature commit",
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
  playerParts.push(`${PLAYER_REENTRY_CACHE_HELPER}\n\n${playerRenderer}\n\nfunction renderPlayerPageWithStableContractLinkOwner(playerId) {
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
