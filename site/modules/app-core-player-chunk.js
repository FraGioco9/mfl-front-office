// @ts-check

function extractRequiredPlayerSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split Player application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

function removeTableIdLocalTooltipOwner(source) {
  let normalized = String(source || "");
  const localListeners = [
    '  button.addEventListener("mouseenter", () => showPlayerNoteTooltip(button));',
    '  button.addEventListener("mouseleave", hidePlayerNoteTooltip);',
    '  button.addEventListener("blur", hidePlayerNoteTooltip);',
  ];

  for (const listener of localListeners) {
    if (!normalized.includes(listener)) {
      throw new Error(`Could not remove Table player-ID local tooltip listener: ${listener}`);
    }
    normalized = normalized.replace(listener, "");
  }

  return normalized.replace(/\n{3,}/g, "\n\n");
}

export function splitPlayerApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(routeChunks.player || "").trim()) return artifacts;

  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split Player ownership from an empty application core.");
  }

  const playerParts = [];
  let extracted = extractRequiredPlayerSection(
    core,
    "function renderPitch(row) {",
    "function playerPositions(row) {",
    "Player pitch renderer",
  );
  core = extracted.core;
  playerParts.push(extracted.chunk);

  extracted = extractRequiredPlayerSection(
    core,
    "function playerTrainingKey(row) {",
    "function primaryPreciseOverall(row) {",
    "Player training and attribute configuration",
  );
  core = extracted.core;
  playerParts.push(extracted.chunk);

  extracted = extractRequiredPlayerSection(
    core,
    "function nextOverallDetailHtml(row, column) {",
    "async function copyPlayerId(id) {",
    "Player attribute panel renderer",
  );
  core = extracted.core;
  playerParts.push(extracted.chunk);

  extracted = extractRequiredPlayerSection(
    core,
    "function renderPlayerPage(playerId) {",
    "function showModal(modal) {",
    "Player page renderer owner",
  );
  core = extracted.core;
  const playerRenderer = extracted.chunk.replace(
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

  const player = removeTableIdLocalTooltipOwner(playerParts.join("\n\n").replace(/\s*$/, ""));
  const normalizedCore = core.replace(/\s*$/, "");
  if (!player || !normalizedCore) {
    throw new Error("Player application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, player }),
  });
}
