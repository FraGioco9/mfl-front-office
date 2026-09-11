import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const bootstrap = await read("./bootstrap.js");

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
  "function stableAttributePanelHtml(row) {",
  "return renderPlayerAttributePanel(row);",
];

for (const [label, runtime] of [["Canonical Player source", source], ["Generated Player runtime", generated]]) {
  for (const value of sharedRequired) {
    if (!runtime.includes(value)) throw new Error(`${label}: missing ${value}`);
  }
  if (runtime.includes("scheduleReadyControlsAfterLoading")) {
    throw new Error(`${label}: authoritative Player controls must not be deferred until after first paint.`);
  }
  if (runtime.includes("pendingAttributeViewRestore")) {
    throw new Error(`${label}: legacy event-based selected-view restoration must not remain.`);
  }
  if (runtime.includes("playerAttributeLoadingObserver = new MutationObserver")) {
    throw new Error(`${label}: Player Attribute loading completion must use the canonical loading lifecycle, not a MutationObserver fix.`);
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
  "attributeViewLoadingActive: playerAttributeLoadingActive,",
  "syncAttributeViewActiveState: syncPlayerAttributeViewActiveState,",
  'window.addEventListener("mfl:loading-state", () => {',
  'window.addEventListener("mfl:navigation-state", (event) => {',
  'event.detail?.pending === true',
  'syncPlayerAttributeViewActiveState(detail);',
  'window.addEventListener("mfl:ready", () => {',
  'button.classList.toggle("active", !loading && button.dataset.playerAttributeView === selectedView);',
  "const attributeViewLoading = Boolean(window.__mflPlayerFirstPaintRuntime?.attributeViewLoadingActive?.(playerId));",
  "const renderSignature = playerDetailRenderSignature(row, playerId, normalizedAttributeView, attributeViewLoading);",
  'const viewButtons = allowedPlayerAttributeViews(row)',
  '!attributeViewLoading && state.playerAttributeView === view ? "active" : ""',
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

if (bootstrap.includes('playerAttributeViewButton${index === 0 ? " active" : ""}')) {
  throw new Error("Player loading shell must not hard-code the Attributes view as active.");
}
if (!bootstrap.includes('<button class="playerAttributeViewButton" type="button" data-view="${view}" disabled>')) {
  throw new Error("Player loading shell must render neutral Player view buttons until loading completes.");
}

console.log("Player loading uses raw plain Attributes without progression suffixes and restores the selected view only after the loading render.");
