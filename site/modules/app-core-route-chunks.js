// @ts-check

function extractRequiredSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

export function splitApplicationCoreRuntime(source) {
  let core = String(source || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split an empty application core.");
  }

  const evaluationParts = [];
  const mflStatsParts = [];

  let extracted = extractRequiredSection(
    core,
    "const advancedPlayerTableTsv = `",
    'const agentColumn = "wallet_name";',
    "Evaluation advanced player lookup data",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "const evaluationContractsTable = (() => {",
    "function evaluationMflMultiplierForSeason(",
    "Evaluation contract lookup table",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "function normalizeSharedEvaluationPayload(payload) {",
    "let evaluationLoadFloatingTooltip = null;",
    "Evaluation save and share services",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "function renderSavedEvaluationList(rows) {",
    "async function openSavedEvaluationsModal() {",
    "Evaluation saved-list renderer",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "const mflStatsOverallFilterOptions = [",
    "function rowHasHiddenMflJoinedAgencyDate(row) {",
    "MFL Stats renderer",
  );
  core = extracted.core;
  mflStatsParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    'mflStatsDistributionModeButtons?.addEventListener("click", (event) => {',
    "let pendingViewButtonPointer = null;",
    "MFL Stats distribution interaction",
  );
  core = extracted.core;
  mflStatsParts.push(extracted.chunk);

  const evaluation = evaluationParts.join("\n\n").replace(/\s*$/, "");
  const mflstats = mflStatsParts.join("\n\n").replace(/\s*$/, "");
  const normalizedCore = core.replace(/\s*$/, "");
  if (!evaluation || !mflstats || !normalizedCore) {
    throw new Error("Application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ evaluation, mflstats }),
  });
}
