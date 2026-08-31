import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);
const requireAll = (source, values, label) => {
  for (const value of values) includes(source, value, `${label}: missing ${value}`);
};
const forbidAll = (source, values, label) => {
  for (const value of values) excludes(source, value, `${label}: forbidden ${value}`);
};

const [coreSource, playerSplitter, appConfig, routeLoader, buildCore, portraitCloseUp, stylesBase] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./api/_portrait-close-up.js"),
  read("./styles-base.css"),
]);
const bootstrapSource = await read("./bootstrap.js");
const walletPreferencesApi = await read("./api/wallet-preferences.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const playerCore = String(artifacts.routeChunks?.player || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Player split.");
invariant(playerCore.length > 12_000, "The Player core chunk is too small to represent the Player-detail renderer owner.");
new Function(sharedCore);
new Function(playerCore);

requireAll(playerSplitter, [
  '"Player pitch renderer"',
  '"Player training and attribute configuration"',
  '"Player attribute panel renderer"',
  '"Player page renderer owner"',
  '"Player contract-link helper"',
  '"Player contract-link shared wrapper"',
  '"Player pending first-paint handoff"',
  '"Player portrait hero hydration"',
  '"Player Profile Rev Share box stability"',
  '"Player hero identity stable markup"',
  '"Player consolidated hero action menu"',
  '"Player stable attribute-grid geometry"',
  '"Player dropdown watchlist class stability"',
  '"Player hero action menu binding"',
  '"Player pitch position native tooltip removal"',
  '"Player pitch position passive hover behavior"',
  '"Player retirement marker color ownership"',
  '"Player partial-row loading gate"',
  'const PLAYER_FIRST_PAINT_RUNTIME = String.raw`',
  "const PLAYER_NOTE_MAX_LENGTH = 100;",
  "finalizeSplitArtifacts(",
], "Player splitter contract");

requireAll(sharedCore, [
  "function renderPlayerPage(playerId) {",
  "const owner = window.__mflRenderPlayerPageOwner;",
  "function primaryPreciseOverall(row) {",
  "async function copyPlayerId(id) {",
  "renderPlayerPageWithNoteLimit",
  "window.__mflPlayerFirstPaintPendingContext = pendingContext;",
  "function playerFirstPaintNavigationContext(playerId) {",
  "state.columns.forEach((column, index) => {",
  "knownValues[column] = { raw: serializedRaw, display };",
  "const searchEntry = playerFirstPaintSearchEntry(key);",
  "knownValues,",
  "window.__mflBuildPlayerFirstPaintContext = playerFirstPaintNavigationContext;",
  "__mflPlayerFirstPaintContext: pendingContext",
], "Shared Player first-paint handoff");

requireAll(coreSource, [
  "const PLAYER_NOTE_MAX_LENGTH = 100;",
  'String(pageName || "") === "player"',
  'await window.__mflEnsureRouteRuntime("player", { ...incomingOptions, playerId });',
  'window.__mflPlayerFirstPaintRuntime?.renderPending?.(pendingContext);',
  "const playerMatch = cleanPath.match(",
  "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});",
], "Player route-runtime preparation");

forbidAll(coreSource, [
  "playerDetail.innerHTML = '<div class=\"emptyState\">Loading player...</div>';",
], "Alternate Player loading DOM");
forbidAll(sharedCore, [
  "function primePlayerHeroFirstPaintGeometry() {",
  "primePlayerHeroFirstPaintGeometry();",
  "renderPlayerPageWithStableContractLink",
  "function contractClubId(playerId, teamName) {",
  "function bindContractTeamLink(playerId) {",
  "function renderPitch(row) {",
  "function playerTrainingKey(row) {",
  "function playerAttributeColumns(row) {",
  "function nextOverallDetailHtml(row, column) {",
  "function renderPlayerAttributePanel(row) {",
  "const infoCardsData = [",
], "Eager Player-only ownership");

requireAll(playerCore, [
  "function renderPitch(row) {",
  "function playerTrainingKey(row) {",
  "function adjustTrainingStat(playerId, column, delta) {",
  "function playerAttributeColumns(row) {",
  "function nextOverallDetailHtml(row, column) {",
  "function renderPlayerAttributePanel(row) {",
  "function contractClubId(playerId, teamName) {",
  "function bindContractTeamLink(playerId) {",
  "function renderPlayerPageOwner(playerId) {",
  "function renderPlayerPageWithStableContractLinkOwner(playerId) {",
  "window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;",
  "const infoCardsData = [",
  'infoCardsData.push(["Rev Share", escapeHtml(revenueShare || "–")]);',
  'window.__mflStaticUiRuntime?.showNotFound?.("Player");',
  'document.documentElement.dataset.initialEntityVerified = "player";',
], "Player route owner");

// One route-commit-safe pending process must own both refresh and in-site navigation.
requireAll(playerCore, [
  'if (playerIdFromLocation() !== playerId) return false;',
  "function beginDetailNavigation(value) {",
  "queueMicrotask(() => {",
  "if (pendingDetailPlayerId !== targetPlayerId || playerIdFromLocation() !== targetPlayerId) return;",
  "normalizePlayerId(pendingContext?.playerId) === targetPlayerId ? pendingContext : context,",
  "function renderPending(value = {}) {",
  "const routeContext = { playerId: routePlayerId };",
  "beginDetailNavigation(routeContext);",
  "renderPending(routeContext);",
  "detail.replaceChildren(hero, createPendingPlayerGrid(context));",
  "showPlayerPage();",
], "Unified Player route-commit pending paint");

// A clicked/search Player with no current table row is still pending until the authoritative detail payload settles.
requireAll(playerCore, [
  'const PLAYER_DETAIL_REQUIRED_COLUMNS = ["height", "preferred_foot", "goalkeeping", "retirement_years"]',
  "function markDetailPayloadReady(route, payload) {",
  "readyDetailPlayerId = routePlayerId;",
  "function detailDataReady(row, playerIdValue) {",
  "if (pendingDetailPlayerId === playerId && readyDetailPlayerId !== playerId) return false;",
  "if (!Array.isArray(row)) return pendingDetailPlayerId !== playerId || readyDetailPlayerId === playerId;",
  'const requiredIndexes = PLAYER_DETAIL_REQUIRED_COLUMNS.map((column) => state.columns.indexOf(column));',
  "if (row.length !== state.columns.length || row.length <= maximumRequiredIndex) return false;",
  "return normalizePlayerId(row[playerIdIndex]) === playerId;",
  "if (window.__mflPlayerFirstPaintRuntime?.detailDataReady?.(row, playerId) === false) {",
  'const pendingContext = window.__mflPlayerFirstPaintPendingContext;',
  'String(pendingContext?.playerId || "").trim() === key ? pendingContext : { playerId: key }',
  "detailDataReady,",
], "Player detail readiness");

const playerDetailMatchIndex = playerCore.indexOf("const matchingRow = payload.rows.find");
const playerDetailReadyIndex = playerCore.indexOf("readyDetailPlayerId = routePlayerId;");
invariant(
  playerDetailMatchIndex >= 0 && playerDetailReadyIndex > playerDetailMatchIndex,
  "Player detail readiness must be granted only after the authoritative matching row is validated.",
);
excludes(
  playerCore,
  'else if (routePlayerId) {\n    renderPending({ playerId: routePlayerId });',
  "Hard-refresh Player loading must enter the same pending gate before any cached row can render a selected progression view.",
);

requireAll(playerCore, [
  "const PLAYER_NOTE_MAX_LENGTH = 100;",
  "input.maxLength = PLAYER_NOTE_MAX_LENGTH;",
  'count.textContent = notesReady ? String(note.length) + "/" + PLAYER_NOTE_MAX_LENGTH : loadingBlank();',
], "Player 100-character note limit");
excludes(playerCore, "const PLAYER_NOTE_MAX_LENGTH = 200;", "Legacy Player note limit must not be generated.");
includes(bootstrapSource, '>0/100</span>', "Bootstrap Player notes shell must reserve the 100-character counter.");
excludes(bootstrapSource, '>0/200</span>', "Bootstrap Player notes shell must not expose the legacy 200-character counter.");
includes(walletPreferencesApi, "const PLAYER_NOTE_MAX_LENGTH = 100;", "Wallet preferences API must enforce the 100-character Player note limit.");
excludes(walletPreferencesApi, "const PLAYER_NOTE_MAX_LENGTH = 200;", "Wallet preferences API must not accept the legacy 200-character Player note limit.");

// Pending values are blank, not legacy dashes, and every static pitch element is already present.
requireAll(playerCore, [
  "function loadingBlank() {",
  'return "\\u00A0";',
  'overallValue.textContent = overallLoaded ? context.overall : loadingBlank();',
  'value.textContent = pendingProfileText(context, label) || loadingBlank();',
  'value.textContent = pendingAttributeValue(context, column) || loadingBlank();',
  'titleName.textContent = context.name || loadingBlank();',
  'positions.textContent = context.positions.length ? context.positions.join(", ") : loadingBlank();',
  "function createPendingPlayerGrid(context) {",
  "function pendingPitchHtml() {",
  "PITCH_ROWS.map((pitchRow) =>",
  'pitchPositionSlot',
  "pitch.innerHTML = pendingPitchHtml();",
], "Player blank/static pending shell");
for (const pitchLine of ["pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom"]) {
  includes(playerCore, pitchLine, `Static pitch line ${pitchLine} must be present at first paint.`);
}

requireAll(playerCore, [
  "function normalizeKnownValues(value) {",
  "knownValues: mergeKnownValues(base.knownValues, next.knownValues),",
  "function snapshotRowKnownValues(row) {",
  "function createPendingProfilePanel(context) {",
  'const knownNationality = knownDisplayValue(context, "nationality");',
  "function pendingAttributeColumns(context) {",
  '? ["overall", "goalkeeping"]',
  "playerGrid.dataset.playerPendingSignature = pendingGridSignature(context);",
  "stack.append(createPendingProfilePanel(context), createPendingAttributesPanel(context));",
  "snapshotRowKnownValues,",
  "knownValues: window.__mflPlayerFirstPaintRuntime?.snapshotRowKnownValues?.(row) || {},",
  '["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract", "Rev Share"]',
  'line.className = "playerContractLine";',
  'team.className = "playerContractTeam";',
  'division.className = "playerContractDivision";',
  'panel.className = "playerPanel attributesPanel";',
  'heading.textContent = "Positions";',
  'if (storedWalletOptIn()) stack.appendChild(createPendingNotesPanel(context));',
  'views.style.visibility = "visible";',
], "Known Player data reuse and stable pending structure");

// Hero geometry is shared by pending/final DOM. Overall + reserved gap is exactly 320px before Identity.
requireAll(playerCore, [
  "const PLAYER_HERO_OVERALL_SIZE_PX = 100;",
  "const PLAYER_HERO_IDENTITY_WIDTH_PX = 360;",
  "const PLAYER_HERO_IDENTITY_OVERALL_GAP_PX = 220;",
  "const PLAYER_HERO_IDENTITY_ACTION_GAP_PX = 16;",
  "const identityOffset = PLAYER_HERO_OVERALL_SIZE_PX + PLAYER_HERO_IDENTITY_OVERALL_GAP_PX;",
  'media.style.flex = "0 0 " + width;',
  'media.style.width = width;',
  'identity.style.marginLeft = "0";',
  'identity.style.marginRight = PLAYER_HERO_IDENTITY_ACTION_GAP_PX + "px";',
  'actions.style.marginLeft = "auto";',
  'overall.style.alignSelf = "center";',
  'overallValue.style.fontSize = "48px";',
  'identity.className = "playerHeroIdentity";',
  '<div class="playerHeroIdentity">',
  'hero.append(createHeroMedia(context), identity, actions);',
  'hero.insertBefore(media, identity instanceof HTMLElement ? identity : hero.firstChild);',
  'eyebrow.style.fontSize = "14px";',
  'title.style.fontSize = "28px";',
  'positions.style.fontSize = "16px";',
], "Player hero identity geometry");
includes(stylesBase, `.playerHero {\n  box-sizing: border-box;\n  display: flex;\n  align-items: stretch;\n  justify-content: space-between;\n  gap: 12px;\n  height: 125px;\n  min-height: 125px;\n  max-height: 125px;\n  padding: 4px 12px 0;\n}`, "The render-blocking canonical stylesheet must own the final 125px Player hero before route JavaScript runs.");
forbidAll(playerCore, [
  'hero.style.height = "125px";',
  '<section class="playerHero" style=',
  "function createHiddenAttributePlaceholder() {",
  "function applyStablePlayerBoxGeometry(container = document) {",
  'playerGrid.style.gridTemplateColumns = "minmax(0, 1fr) 380px";',
  'pitch.style.height = "498px";',
  'notesInput.style.height = "58px";',
], "Duplicate Player geometry ownership");

requireAll(playerCore, [
  'const fullWidth = column === "overall" || (goalkeeper && column === "goalkeeping");',
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
  'const selectedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);',
  'const normalizedAttributeView = window.__mflPlayerFirstPaintRuntime?.attributeViewForRender?.(selectedAttributeView, playerId) || selectedAttributeView;',
  'state.playerAttributeView = selectedAttributeView;',
  "function scheduleReadyControlsAfterLoading(playerIdValue) {",
  'if (playerAttributeLoadingActive(playerId)) {',
  'if (typeof owner === "function") owner(playerId);',
  '${window.__mflPlayerFirstPaintRuntime?.stableAttributePanelHtml?.(displayRow) || renderPlayerAttributePanel(displayRow)}',
], "Natural goalkeeper Attribute geometry and plain Attributes-only Player loading");


requireAll(playerCore, [
  'const PLAYER_PORTRAIT_ORIGIN = "https://d13e14gtps4iwl.cloudfront.net";',
  'const PLAYER_EXTERNAL_ORIGIN = "https://app.playmfl.com";',
  'PLAYER_EXTERNAL_ORIGIN + "/players/" + playerId',
  'PLAYER_PORTRAIT_ORIGIN + "/players/v2/" + playerId + "/photo.webp"',
  "const PLAYER_PORTRAIT_CROP_HEIGHT_PX = 500;",
  "const PLAYER_PORTRAIT_SOURCE_WIDTH_PX = 912;",
  "const PLAYER_PORTRAIT_DISPLAY_HEIGHT_PX = 112;",
  "const portraitSources = new Map();",
  "function applyPortraitGeometry(canvas, sourceWidthValue = PLAYER_PORTRAIT_SOURCE_WIDTH_PX, sourceHeightValue = PLAYER_PORTRAIT_CROP_HEIGHT_PX) {",
  "const displayWidth = sourceWidth * (displayHeight / sourceCropHeight);",
  "applyPortraitGeometry(canvas);",
  "const existing = portraitSources.get(playerId);",
  "portraitSources.set(playerId, image);",
  "context.drawImage(",
  'frame.style.alignSelf = "flex-end";',
  'frame.style.marginBottom = "0";',
  'canvas.style.background = "transparent";',
], "Player portrait first-paint geometry");
excludes(playerCore, 'const portrait = document.createElement("img");', "The raw portrait image must never participate in Player-page layout.");

requireAll(playerCore, [
  'link.className = "agentTableLink playerAgentLink";',
  'team.className = "playerContractTeam playerContractTeamLink clubPageLink";',
  'value.style.fontWeight = "600";',
  "const PLAYER_HERO_PRIMARY_ACTION_WIDTH_PX = 152;",
  "const PLAYER_HERO_ACTION_CHEVRON_WIDTH_PX = 34;",
  "const PLAYER_HERO_ACTION_HEIGHT_PX = 40;",
  "const PLAYER_HERO_ACTION_MENU_WIDTH_PX = 190;",
  'primary.style.fontSize = "16px";',
  'external.href = context.externalUrl;',
  "function applyHeroActionMenuLayout(actions) {",
  "function setHeroActionMenuOpen(menu, open) {",
  "function bindHeroActionMenu(container = document) {",
  "function animateReadyControls(container = document) {",
  'window.__mflPlayerFirstPaintRuntime?.bindHeroActionMenu?.(playerDetail);',
  'window.__mflPlayerFirstPaintRuntime?.animateReadyControls?.(playerDetail);',
], "Player first-paint controls");
forbidAll(playerCore, [
  'external.setAttribute("aria-disabled", "true");',
  "function syncHeroActions(container = document) {",
], "Legacy Player hero controls");

requireAll(playerCore, [
  "sessionStorage.setItem(cacheKey(context.playerId), JSON.stringify(merged));",
  "window.__mflPlayerFirstPaintRuntime = Object.freeze({",
  "window.__mflPlayerFirstPaintRuntime?.hydrateHero?.({",
  'overall: statDisplayValue(row, "overall")',
], "Canonical Player first-paint ownership");
forbidAll(playerCore, [
  "function primaryPreciseOverall(row) {",
  "async function copyPlayerId(id) {",
  "function renderPlayerPage(playerId) {",
  "PLAYER_FIRST_PAINT_STYLESHEET",
], "Player route ownership boundaries");

requireAll(portraitCloseUp, [
  "const PORTRAIT_CROP_HEIGHT_PX = 500;",
  "function createPortraitCloseUp(source, cropHeightPx = PORTRAIT_CROP_HEIGHT_PX) {",
  "const cropLimit = Number.isFinite(requestedCropHeight) && requestedCropHeight > 0",
  "Math.min(cropLimit, sourceHeight)",
], "Evaluation/Player portrait crop parity");
requireAll(appConfig, ['player: "/modules/app-core-player-runtime.js"'], "Player route config");
requireAll(routeLoader, ["const ROUTE_CORE_PATHS = routeConfig.corePaths;"], "Route-core loader");
requireAll(buildCore, [
  'runtime: "app-core-player-runtime.js"',
  'source: "player.js"',
], "Player generated build");

const generatedPlayer = await read("./modules/app-core-player-runtime.js");
const playerBanner = "// Generated Player core from modules/core-sources/player.js. Do not edit directly.\n";
invariant(generatedPlayer.startsWith(playerBanner), "Generated Player runtime must carry the build ownership banner.");
const generatedPlayerBody = generatedPlayer.slice(playerBanner.length).replace(/\s*$/, "");
invariant(generatedPlayerBody.length > 12_000, "Generated Player runtime is unexpectedly small.");
new Function(generatedPlayerBody);

requireAll(generatedPlayerBody, [
  "window.__mflPlayerFirstPaintRuntime = Object.freeze({",
  "function renderPitch(row) {",
  "function renderPlayerAttributePanel(row) {",
  "function renderPlayerPageOwner(playerId) {",
  "window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;",
  'const PLAYER_DETAIL_REQUIRED_COLUMNS = ["height", "preferred_foot", "goalkeeping", "retirement_years"]',
  "function detailDataReady(row, playerIdValue) {",
  "if (!Array.isArray(row)) return pendingDetailPlayerId !== playerId || readyDetailPlayerId === playerId;",
  "if (window.__mflPlayerFirstPaintRuntime?.detailDataReady?.(row, playerId) === false) {",
  'if (playerIdFromLocation() !== playerId) return false;',
  "queueMicrotask(() => {",
  "if (pendingDetailPlayerId !== targetPlayerId || playerIdFromLocation() !== targetPlayerId) return;",
  "const PLAYER_HERO_IDENTITY_OVERALL_GAP_PX = 220;",
  "const identityOffset = PLAYER_HERO_OVERALL_SIZE_PX + PLAYER_HERO_IDENTITY_OVERALL_GAP_PX;",
  "function pendingPitchHtml() {",
  "function stableAttributePanelHtml(row) {",
  "function applyHeroActionMenuLayout(actions) {",
  "function setHeroActionMenuOpen(menu, open) {",
  "function bindHeroActionMenu(container = document) {",
  "function animateReadyControls(container = document) {",
  "const PLAYER_PORTRAIT_SOURCE_WIDTH_PX = 912;",
  "const portraitSources = new Map();",
  "function applyPortraitGeometry(canvas, sourceWidthValue = PLAYER_PORTRAIT_SOURCE_WIDTH_PX, sourceHeightValue = PLAYER_PORTRAIT_CROP_HEIGHT_PX) {",
  '<div class="playerHeroIdentity">',
  'return "\\u00A0";',
], "Generated Player runtime parity");
for (const pitchLine of ["pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom"]) {
  includes(generatedPlayerBody, pitchLine, `Generated Player runtime must retain static pitch line ${pitchLine}.`);
}
forbidAll(generatedPlayerBody, [
  '<section class="playerHero" style=',
  "function createHiddenAttributePlaceholder() {",
  ' title="${position} ${rating}"',
  'external.setAttribute("aria-disabled", "true");',
  "function applyStablePlayerBoxGeometry(container = document) {",
  "function syncHeroActions(container = document) {",
  'overallLabel.textContent = "Overall";',
], "Generated Player legacy behavior");

console.log("Player refresh and in-site navigation share one route-commit-safe pending renderer, unresolved rows remain pending until detail payload settlement, unknown values stay blank, the full pitch exists from first paint, the 125px hero is CSS-owned, Player hero media reserves 320px before playerHeroIdentity, and generated runtime parity validation passed.");
