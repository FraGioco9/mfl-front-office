import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [source, generated] = await Promise.all([
  read("./modules/core-sources/player.js"),
  read("./modules/app-core-player-runtime.js"),
]);

const sharedRequired = [
  "function pendingAttributeValue(context, column) {",
  "const raw = knownRawValue(context, column);",
  'return String(formatPlainValue(raw, column) ?? "").trim();',
  "function playerAttributeLoadingActive(playerIdValue = playerIdFromLocation()) {",
  'pendingDetailPlayerId === playerId',
  'root.classList.contains("mflDataLoading")',
  'root.classList.contains("mflSingleRenderPending")',
  'root.classList.contains("mflNavigationPending")',
  "function attributeViewForRender(selectedView, playerIdValue = playerIdFromLocation()) {",
  'return playerAttributeLoadingActive(playerIdValue) ? "attributes" : selectedView;',
  "function scheduleReadyControlsAfterLoading(playerIdValue) {",
  'if (playerAttributeLoadingActive(playerId)) {',
  'if (typeof owner === "function") owner(playerId);',
  "function stableAttributePanelHtml(row) {",
  "return renderPlayerAttributePanel(row);",
];

for (const [label, runtime] of [["Canonical Player source", source], ["Generated Player runtime", generated]]) {
  for (const value of sharedRequired) {
    if (!runtime.includes(value)) throw new Error(`${label}: missing ${value}`);
  }
  if (runtime.includes("pendingAttributeViewRestore")) {
    throw new Error(`${label}: legacy event-based selected-view restoration must not remain.`);
  }
  const pendingStart = runtime.indexOf("function pendingAttributeValue(context, column) {");
  const pendingEnd = runtime.indexOf("function createPendingAttributesPanel(context) {", pendingStart);
  if (runtime.slice(pendingStart, pendingEnd).includes("knownDisplayValue(context, column)")) {
    throw new Error(`${label}: pending Attributes must never reuse cached display strings that can contain progression suffixes.`);
  }
}

const renderRequired = [
  'const selectedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);',
  'const normalizedAttributeView = window.__mflPlayerFirstPaintRuntime?.attributeViewForRender?.(selectedAttributeView, playerId) || selectedAttributeView;',
  "const renderSignature = playerDetailRenderSignature(row, playerId, normalizedAttributeView);",
  "state.playerAttributeView = normalizedAttributeView;",
  'const displayRow = state.playerAttributeView === "training" ? trainingRow(row) : row;',
  "state.playerAttributeView = selectedAttributeView;",
  'if (viewName === "attributes") {',
  "return formattedValue;",
];
for (const value of renderRequired) {
  if (!generated.includes(value)) throw new Error(`Generated Player runtime: missing ${value}`);
}

const selectedIndex = generated.indexOf('const selectedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);');
const renderViewIndex = generated.indexOf('const normalizedAttributeView = window.__mflPlayerFirstPaintRuntime?.attributeViewForRender?.(selectedAttributeView, playerId) || selectedAttributeView;', selectedIndex);
const normalizedStateIndex = generated.indexOf("state.playerAttributeView = normalizedAttributeView;", renderViewIndex);
const restoreIndex = generated.indexOf("state.playerAttributeView = selectedAttributeView;", normalizedStateIndex);
if (!(selectedIndex >= 0 && renderViewIndex > selectedIndex && normalizedStateIndex > renderViewIndex && restoreIndex > normalizedStateIndex)) {
  throw new Error("Generated Player runtime must render with the Attributes-only loading view before restoring the user's selected view.");
}

console.log("Player loading uses raw plain Attributes without progression suffixes and restores the selected view only after the loading render.");
