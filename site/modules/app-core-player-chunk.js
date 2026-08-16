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

  const player = playerParts.join("\n\n").replace(/\s*$/, "");
  const normalizedCore = core.replace(/\s*$/, "");
  if (!player || !normalizedCore) {
    throw new Error("Player application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, player }),
  });
}
