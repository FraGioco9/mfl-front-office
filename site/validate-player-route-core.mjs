import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, playerSplitter, appConfig, routeLoader, buildCore, portraitCloseUp, stylesBase] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./api/_portrait-close-up.js"),
  read("./styles-base.css"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const playerCore = String(artifacts.routeChunks?.player || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Player split.");
invariant(playerCore.length > 12_000, "The Player core chunk is too small to represent the Player-detail renderer owner.");
new Function(sharedCore);
new Function(playerCore);

for (const marker of [
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
]) {
  includes(playerSplitter, marker, `Player splitter contract missing ${marker}.`);
}
includes(playerSplitter, 'const PLAYER_FIRST_PAINT_RUNTIME = String.raw`', "The Player splitter must own the lightweight Player first-paint runtime.");
includes(playerSplitter, "finalizeSplitArtifacts(", "The Player splitter must use canonical split-result finalization.");

includes(sharedCore, "function renderPlayerPage(playerId) {", "The shared core must retain the stable Player renderer facade.");
includes(sharedCore, "const owner = window.__mflRenderPlayerPageOwner;", "The stable shared Player renderer must dispatch to the route-owned implementation.");
includes(sharedCore, "function primaryPreciseOverall(row) {", "Shared table/Evaluation Overall math must remain universal.");
includes(sharedCore, "async function copyPlayerId(id) {", "Shared clipboard behavior must remain universal.");
includes(sharedCore, "renderPlayerPageWithNoteLimit", "The Player note-limit wrapper must remain shared around the stable renderer facade.");
includes(sharedCore, "window.__mflPlayerFirstPaintPendingContext = pendingContext;", "Internal Player navigation must publish already-known Player context before route loading.");
includes(sharedCore, "window.__mflPlayerFirstPaintRuntime?.renderPending?.(pendingContext);", "Revisited Player routes must paint known content synchronously.");
excludes(sharedCore, "function primePlayerHeroFirstPaintGeometry() {", "Player hero geometry must not depend on a late shared-runtime primer.");
excludes(sharedCore, "primePlayerHeroFirstPaintGeometry();", "Player navigation must not rely on a late hero-geometry primer call.");
for (const eagerOwner of [
  "renderPlayerPageWithStableContractLink",
  "function contractClubId(playerId, teamName) {",
  "function bindContractTeamLink(playerId) {",
  "function renderPitch(row) {",
  "function playerTrainingKey(row) {",
  "function playerAttributeColumns(row) {",
  "function nextOverallDetailHtml(row, column) {",
  "function renderPlayerAttributePanel(row) {",
  "const infoCardsData = [",
]) {
  excludes(sharedCore, eagerOwner, `Player-only owner must not remain eager in shared core: ${eagerOwner}`);
}

for (const routeOwner of [
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
]) {
  includes(playerCore, routeOwner, `The Player chunk must retain route owner ${routeOwner}.`);
}
includes(playerCore, "const infoCardsData = [", "The Player chunk must own Player page DOM construction.");
includes(playerCore, 'infoCardsData.push(["Rev Share", escapeHtml(revenueShare || "–")]);', "Final Profile geometry must retain the Rev Share card.");
includes(playerCore, 'window.__mflStaticUiRuntime?.showNotFound?.("Player");', "Missing Player IDs must use the shared not-found surface.");
includes(playerCore, 'document.documentElement.dataset.initialEntityVerified = "player";', "Confirmed Player routes must release the guarded first-paint shell.");

includes(playerCore, 'const PLAYER_DETAIL_REQUIRED_COLUMNS = ["height", "preferred_foot", "goalkeeping", "retirement_years"]', "Player final rendering must have a detail-only readiness contract distinct from partial table rows.");
includes(playerCore, "function detailDataReady(row, playerIdValue) {", "Player first-paint owner must validate readiness against the target Player row.");
includes(playerCore, 'const requiredIndexes = PLAYER_DETAIL_REQUIRED_COLUMNS.map((column) => state.columns.indexOf(column));', "Player detail readiness must locate detail-only columns in the active row schema.");
includes(playerCore, 'if (row.length !== state.columns.length || row.length <= maximumRequiredIndex) return false;', "A partial row must never be treated as full Player-detail data even when stale global columns exist.");
includes(playerCore, 'return normalizePlayerId(row[playerIdIndex]) === playerId;', "Player detail readiness must belong to the requested Player ID.");
includes(playerCore, "if (row && window.__mflPlayerFirstPaintRuntime?.detailDataReady?.(row, playerId) === false) {", "A partial in-site row must stay on the pending Player shell instead of becoming final Player markup.");
includes(playerCore, 'const pendingContext = window.__mflPlayerFirstPaintPendingContext;', "Partial in-site loading must reuse the exact context captured before navigation.");
includes(playerCore, 'String(pendingContext?.playerId || "").trim() === key ? pendingContext : { playerId: key }', "The partial-row gate must not reinterpret a row through stale columns.");
includes(playerCore, "detailDataReady,", "The canonical Player first-paint runtime must publish detail readiness to the heavy renderer.");

includes(playerCore, 'const PLAYER_PORTRAIT_ORIGIN = "https://d13e14gtps4iwl.cloudfront.net";', "Player first paint must use the canonical MFL portrait origin.");
includes(playerCore, 'const PLAYER_EXTERNAL_ORIGIN = "https://app.playmfl.com";', "Player first paint must derive the canonical external Player link without waiting for detail data.");
includes(playerCore, 'PLAYER_EXTERNAL_ORIGIN + "/players/" + playerId', "Open link must be derivable from Player ID at first paint.");
includes(playerCore, 'PLAYER_PORTRAIT_ORIGIN + "/players/v2/" + playerId + "/photo.webp"', "Player first paint must use /players/v2/<id>/photo.webp.");
includes(playerCore, "const PLAYER_PORTRAIT_CROP_HEIGHT_PX = 500;", "Player first paint must mirror the Evaluation top-500px crop.");
includes(playerCore, "const PLAYER_PORTRAIT_SOURCE_WIDTH_PX = 912;", "Player first paint must reserve the known 912px source width before portrait decode.");
includes(playerCore, "const PLAYER_PORTRAIT_DISPLAY_HEIGHT_PX = 112;", "Player portrait display height must remain 112px.");
includes(playerCore, "const portraitSources = new Map();", "Decoded Player portrait sources must be reusable by player ID across pending/final DOM replacement.");
includes(playerCore, "function applyPortraitGeometry(canvas, sourceWidthValue = PLAYER_PORTRAIT_SOURCE_WIDTH_PX, sourceHeightValue = PLAYER_PORTRAIT_CROP_HEIGHT_PX) {", "Player first paint must own synchronous portrait geometry reservation.");
includes(playerCore, "const displayWidth = sourceWidth * (displayHeight / sourceCropHeight);", "Portrait width must derive from the already-cropped source ratio.");
includes(playerCore, "applyPortraitGeometry(canvas);", "A replacement portrait canvas must reserve final geometry before image decode.");
includes(playerCore, "const existing = portraitSources.get(playerId);", "Final hydration must reuse an already-decoded portrait source by Player ID.");
includes(playerCore, "portraitSources.set(playerId, image);", "Portrait source cache must be keyed by Player ID rather than the disposable canvas.");
includes(playerCore, "context.drawImage(", "Player portrait must render with explicit crop-before-scale canvas drawing.");
includes(playerCore, "sourceWidth,\n      sourceCropHeight,", "Canvas drawing must use full source width and only the top crop height.");
includes(playerCore, 'frame.style.alignSelf = "flex-end";', "Portrait must stay bottom-aligned in the hero.");
includes(playerCore, 'frame.style.marginBottom = "0";', "Portrait must sit immediately above the hero bottom border.");
includes(playerCore, 'canvas.style.background = "transparent";', "Visible portrait canvas must remain transparent.");
excludes(playerCore, 'const portrait = document.createElement("img");', "The raw portrait image must never participate in Player-page layout.");

includes(playerCore, "const PLAYER_HERO_OVERALL_SIZE_PX = 100;", "Hero Overall must remain a 100px square.");
includes(playerCore, 'overall.style.alignSelf = "center";', "Hero Overall must remain vertically centered.");
includes(playerCore, 'overallValue.style.fontSize = "48px";', "Hero Overall value must remain 48px.");
includes(stylesBase, `.playerHero {\n  box-sizing: border-box;\n  display: flex;\n  align-items: stretch;\n  justify-content: space-between;\n  gap: 12px;\n  height: 125px;\n  min-height: 125px;\n  max-height: 125px;\n  padding: 4px 12px 0;\n}`, "The render-blocking canonical stylesheet must own the final 125px Player hero before route JavaScript runs.");
excludes(playerCore, 'hero.style.height = "125px";', "Player runtime must not duplicate the canonical hero height owner.");
includes(playerCore, '<section class="playerHero">', "Loaded Player hero must inherit its final geometry from canonical CSS from creation.");
excludes(playerCore, '<section class="playerHero" style=', "Loaded Player hero must not restore inline geometry ownership.");
includes(playerCore, 'identity.className = "playerHeroIdentity";', "Pending hero identity must use the final identity class from creation.");
includes(playerCore, '<div class="playerHeroIdentity">', "Final renderer must emit the same hero identity wrapper class before hydration.");
includes(playerCore, 'eyebrow.id = "copyPlayerIdButton";', "Pending Player ID must use the final copy-button element contract.");
includes(playerCore, 'titleNoteIcon.className = "playerTitleNoteIcon";', "Pending title must reserve the final note-icon slot.");
includes(playerCore, 'hero.append(createHeroMedia(context), identity, actions);', "First-paint hero order must match the final Overall/image, identity, actions order.");
includes(playerCore, 'hero.insertBefore(media, identity instanceof HTMLElement ? identity : hero.firstChild);', "Final hydration must preserve media before identity.");
includes(playerCore, 'eyebrow.style.fontSize = "14px";', "Player ID text must be 14px at first paint and after hydration.");
includes(playerCore, 'title.style.fontSize = "28px";', "Player name must be 28px at first paint and after hydration.");
includes(playerCore, 'positions.style.fontSize = "16px";', "Player positions must be 16px at first paint and after hydration.");

includes(playerCore, "function loadingBlank() {", "Player first paint must own a geometry-preserving blank loading value.");
includes(playerCore, 'return "\\u00A0";', "Loading placeholders must be visually blank while retaining line geometry.");
includes(playerCore, 'overallValue.textContent = context.overall || loadingBlank();', "Unknown hero Overall must stay visually blank.");
includes(playerCore, 'value.textContent = loadingBlank();', "Unknown Profile values must stay visually blank.");
includes(playerCore, 'value.textContent = label === "Overall" ? (context.overall || loadingBlank()) : loadingBlank();', "Unknown Attribute values must stay visually blank.");
includes(playerCore, 'titleName.textContent = context.name || loadingBlank();', "Unknown Player name must stay visually blank.");
includes(playerCore, 'positions.textContent = context.positions.length ? context.positions.join(", ") : loadingBlank();', "Unknown positions must stay visually blank.");
includes(playerCore, 'pendingOverall.textContent = context.overall || loadingBlank();', "Pending Attributes Overall must stay visually blank.");

includes(playerCore, "function createPendingPlayerGrid(context) {", "Player first paint must reserve the complete final panel grid.");
includes(playerCore, '["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract", "Rev Share"]', "Profile labels and cards must exist immediately.");
includes(playerCore, 'line.className = "playerContractLine";', "Pending Contract must reserve the same nested line structure as loaded Contract.");
includes(playerCore, 'team.className = "playerContractTeam";', "Pending Contract must reserve the final team slot.");
includes(playerCore, 'division.className = "playerContractDivision";', "Pending Contract must reserve the final division slot.");
includes(playerCore, 'panel.className = "playerPanel attributesPanel";', "Attributes panel must exist immediately.");
includes(playerCore, 'heading.textContent = "Positions";', "Positions panel heading must exist immediately.");
includes(playerCore, "function pendingPitchHtml() {", "Player first paint must own static pitch rendering.");
for (const pitchLine of ["pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom"]) {
  includes(playerCore, pitchLine, `Static pitch line ${pitchLine} must be present at first paint.`);
}
includes(playerCore, "PITCH_ROWS.map((pitchRow) =>", "Pending pitch must reserve every final pitch row.");
includes(playerCore, 'pitchPositionSlot', "Pending pitch must reserve every final position slot.");
includes(playerCore, 'pitchPositionSlot" style="cursor:default;user-select:none;-webkit-user-select:none"', "Pending pitch position slots must keep the default cursor and disable text selection.");
includes(playerCore, "pitch.innerHTML = pendingPitchHtml();", "Static pitch structure must be attached before Player data is ready.");
includes(playerCore, 'if (storedWalletOptIn()) stack.appendChild(createPendingNotesPanel(context));', "Opted-in first paint must reserve the Notes panel immediately.");
excludes(playerCore, 'button.className = "playerAttributeViewButton" + (view === activeView ? " active" : "");', "Loading Player view buttons must not show an active state before data is ready.");
includes(playerCore, 'button.className = "playerAttributeViewButton";', "Loading Player view buttons must remain neutral until the loaded renderer applies the active view.");
includes(playerCore, "const watchlistReady = Boolean(state.walletPreferencesLoaded);", "First paint must reuse already-loaded watchlist state when available.");
includes(playerCore, "const notesReady = Boolean(state.walletPreferencesLoaded);", "First paint must reuse already-loaded note state when available.");
includes(playerCore, 'if (state.walletPreferencesLoaded && typeof playerNoteIconHtml === "function") {', "First paint must render an already-known Player note icon immediately.");
includes(playerCore, 'views.style.visibility = "visible";', "Player view controls must stay visible from first paint.");
includes(playerCore, 'detail.replaceChildren(hero, createPendingPlayerGrid(context));', "Hero and static panel grid must publish together in final order.");

excludes(playerCore, "function createHiddenAttributePlaceholder() {", "Goalkeeper Attributes must not be padded to outfield height with structural placeholders.");
includes(playerCore, 'const fullWidth = label === "Overall" || (goalkeeper && label === "Goalkeeping");', "Known goalkeeper first paint must use the final full-width Goalkeeping card geometry.");
excludes(playerCore, 'for (let index = 0; index < 4; index += 1) grid.appendChild(createHiddenAttributePlaceholder());', "Goalkeeper first paint must remain naturally smaller than the outfield Attributes panel.");
includes(playerCore, "function stableAttributePanelHtml(row) {", "Final Player rendering must retain the shared Attribute markup owner.");
includes(playerCore, "return renderPlayerAttributePanel(row);", "Final goalkeeper Attributes must use the naturally smaller loaded-state rendering without hidden padding cards.");
includes(playerCore, '${window.__mflPlayerFirstPaintRuntime?.stableAttributePanelHtml?.(displayRow) || renderPlayerAttributePanel(displayRow)}', "Final Attributes markup must use the same route owner.");

excludes(playerCore, ' title="${position} ${rating}"', "Pitch positions must not create a native tooltip on hover.");
includes(playerCore, 'return `<div class="pitchPositionSlot" style="cursor:default;user-select:none;-webkit-user-select:none">${content}</div>`;', "Loaded pitch positions must keep the default cursor and prevent text selection without changing their visible contents.");
includes(playerCore, '<span class="pitchPositionCircle ${familiarity}"><strong>${rating}</strong><small>${position}</small></span>', "Loaded pitch positions must retain their visible rating/position content without a title tooltip.");

includes(playerCore, '<i class="retirementMarker playerAgeMarker retirementMarker--${escapeHtml(ageMarker.status || "default")}"', "Player age retirement markers must use an icon element that is not recolored by the generic Profile span rule.");
excludes(playerCore, '<span class="retirementMarker playerAgeMarker', "Player age retirement markers must not be caught by the generic muted Profile span styling.");

excludes(playerCore, "const PLAYER_PROFILE_GRID_HEIGHT_PX = 152;", "Player Profile sizing must not be redefined by first-paint inline constants.");
excludes(playerCore, "const PLAYER_ATTRIBUTE_GRID_HEIGHT_PX = 146;", "Player Attributes sizing must not be redefined by first-paint inline constants.");
excludes(playerCore, "const PLAYER_ATTRIBUTE_FEATURED_ROW_HEIGHT_PX = 44;", "Player Attribute row sizing must remain owned by the loaded-state CSS.");
excludes(playerCore, "const PLAYER_ATTRIBUTE_ROW_HEIGHT_PX = 30;", "Player Attribute row sizing must remain owned by the loaded-state CSS.");
excludes(playerCore, "function applyStablePlayerBoxGeometry(container = document) {", "Player boxes must use the canonical loaded-state CSS instead of a duplicate inline geometry owner.");
excludes(playerCore, 'playerGrid.style.gridTemplateColumns = "minmax(0, 1fr) 380px";', "Player grid columns must not be hard-coded by first paint.");
excludes(playerCore, 'pitch.style.height = "498px";', "Pitch height must remain owned by canonical loaded-state CSS.");
excludes(playerCore, 'notesInput.style.height = "58px";', "Notes height must remain owned by canonical loaded-state CSS.");

includes(playerCore, "const PLAYER_HERO_PRIMARY_ACTION_WIDTH_PX = 152;", "Open link width must be the exact remainder of the 190px split action.");
includes(playerCore, "const PLAYER_HERO_ACTION_CHEVRON_WIDTH_PX = 34;", "Hero action chevron must reserve its compact final width at first paint.");
includes(playerCore, "const PLAYER_HERO_ACTION_HEIGHT_PX = 40;", "Visible Player hero actions must remain 40px high.");
includes(playerCore, "const PLAYER_HERO_ACTION_MENU_WIDTH_PX = 190;", "Player hero dropdown and split action must share one stable width.");
includes(playerCore, 'const PLAYER_READY_TRANSITION = "color 180ms ease, opacity 180ms ease, background-color 180ms ease, border-color 180ms ease";', "Greyed loading controls must own a stable ready-state transition.");
excludes(playerCore, 'external.setAttribute("aria-disabled", "true");', "Open link must never become disabled during Player loading.");
includes(playerCore, 'external.href = context.externalUrl;', "Pending Open link must be clickable immediately.");
includes(playerCore, 'toggle.style.transition = PLAYER_READY_TRANSITION;', "Chevron must transition from greyed loading state to ready state.");
includes(playerCore, "function animateReadyControls(container = document) {", "Final Player controls must animate from the pending grey state without changing dimensions.");
includes(playerCore, 'let readyTransitionPlayerId = "";', "Player loading must own a one-shot ready-transition token.");
includes(playerCore, 'readyTransitionPlayerId = playerId;', "Publishing the pending Player shell must arm the ready transition for that Player only.");
includes(playerCore, 'if (!playerId || readyTransitionPlayerId !== playerId) return false;', "View re-renders must skip the loading ready transition after it has already been consumed.");
includes(playerCore, 'readyTransitionPlayerId = "";', "The initial ready transition must be consumed before animation begins.");
includes(playerCore, 'control.style.transition = "none";', "Ready controls must first commit their neutral loading appearance without animating backwards.");
includes(playerCore, 'control.style.backgroundColor = "var(--surface-muted)";', "Loaded Player view buttons must be forced to the neutral pending background before the ready transition.");
includes(playerCore, 'control.style.borderColor = "var(--border-strong)";', "Loaded Player view buttons must be forced to the neutral pending border before the ready transition.");
includes(playerCore, "controls[0]?.getBoundingClientRect();", "Neutral Player view-button state must be committed before starting the forward ready transition.");
includes(playerCore, 'control.style.transition = PLAYER_READY_TRANSITION;', "Ready controls must enable their transition only after the neutral state is committed.");
includes(playerCore, 'control.style.removeProperty("background-color");', "Player view buttons must transition once from neutral to their final active/inactive background.");
includes(playerCore, 'window.__mflPlayerFirstPaintRuntime?.animateReadyControls?.(playerDetail);', "Final renderer must trigger the ready-state control transition synchronously after hydration.");
includes(playerCore, 'wrapper.style.width = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";', "Open link plus chevron must exactly match the dropdown width.");
includes(playerCore, 'wrapper.style.gap = "4px";', "Split action must keep the intended 4px internal gap.");
includes(playerCore, 'menu.style.width = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";', "Dropdown width must use the same 190px owner as the visible split action.");
includes(playerCore, 'wrapper.className = "playerHeroActionMenu";', "Pending hero must reserve the final split action wrapper.");
includes(playerCore, 'external.className = "playerExternalButton playerHeroPrimaryAction";', "Open link must be the single visible primary Player action.");
includes(playerCore, 'toggle.className = "playerHeroActionMenuButton";', "A compact chevron control must sit beside Open link.");
includes(playerCore, 'menu.className = "playerHeroActionMenuDropdown";', "Player secondary actions must live in one dropdown.");
includes(playerCore, 'evaluate.className = "playerEvaluateButton playerHeroActionMenuItem";', "Evaluate must move into the Player action dropdown.");
includes(playerCore, 'watchlist.className = "playerWatchlistButton playerHeroActionMenuItem";', "Watchlist action must move into the Player action dropdown.");
includes(playerCore, 'stem.setAttribute("d", "M12 3v18");', "Evaluate first paint must use the dollar icon stem.");
includes(playerCore, 'curve.setAttribute("d", "M17 7.5c-.8-1.4-2.4-2.2-5-2.2-3 0-5 1.3-5 3.4 0 2.4 2.4 3.1 5 3.4 3 .4 5 1.1 5 3.4 0 2.1-2 3.4-5 3.4-2.7 0-4.4-.9-5.3-2.5");', "Evaluate first paint must reuse the canonical Evaluation dollar icon path.");
includes(playerCore, 'path.setAttribute("d", "m7 10 5 5 5-5");', "Hero menu chevron must use the canonical compact down-chevron path.");
includes(playerCore, "function applyHeroActionMenuLayout(actions) {", "One Player hero action-menu owner must size Open link, chevron and dropdown.");
includes(playerCore, 'const unavailable = toggle.getAttribute("aria-disabled") === "true";', "Loading chevron styling must derive from its non-interactive state without changing geometry.");
includes(playerCore, 'toggle.style.color = unavailable ? "var(--text-soft)" : "var(--text)";', "Loading chevron must appear greyed out while unavailable.");
includes(playerCore, 'toggle.style.opacity = unavailable ? "0.5" : "1";', "Loading chevron must visibly communicate its unavailable state.");
includes(playerCore, 'toggle.removeAttribute("aria-disabled");', "Loaded chevron must become interactive without changing its dimensions.");
includes(playerCore, "function setHeroActionMenuOpen(menu, open) {", "Player dropdown visibility must use one transition-aware owner.");
includes(playerCore, 'menu.style.opacity = open ? "1" : "0";', "Player dropdown must fade during open and close.");
includes(playerCore, 'menu.style.transform = open ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.98)";', "Player dropdown must move/scale during open and close.");
includes(playerCore, 'menu.style.transition = open', "Player dropdown must define transition timing for both directions.");
includes(playerCore, 'menu.style.visibility = open ? "visible" : "hidden";', "Closed dropdown must stay non-visible after its closing transition.");
includes(playerCore, 'const willOpen = menu.dataset.open !== "true";', "Dropdown toggle must use transition state instead of the non-animatable hidden attribute.");
includes(playerCore, "function bindHeroActionMenu(container = document) {", "The loaded Player hero must bind the action dropdown through the first-paint owner.");
includes(playerCore, 'window.__mflPlayerFirstPaintRuntime?.bindHeroActionMenu?.(playerDetail);', "Final Player hydration must bind the same action dropdown owner.");
includes(playerCore, 'watchButton.className = `playerWatchlistButton playerHeroActionMenuItem ${inAnyWatchlist ? "active" : ""}`;', "Watchlist hydration must retain dropdown-item geometry while updating state.");
includes(playerCore, 'id="openPlayerExternalButton" class="playerExternalButton playerHeroPrimaryAction"', "Final hero must expose only Open link as the primary visible action.");
includes(playerCore, 'id="playerHeroActionMenuButton" class="playerHeroActionMenuButton"', "Final hero must render the compact chevron beside Open link.");
includes(playerCore, 'id="playerEvaluateButton" class="playerEvaluateButton playerHeroActionMenuItem"', "Final Evaluate action must live inside the dropdown.");
includes(playerCore, 'class="playerHeroMenuIcon playerEvaluateIcon"', "Final Evaluate action must render the dollar icon.");
excludes(playerCore, "const PLAYER_HERO_ACTION_WIDTH_PX = 116;", "The removed three-equal-button width owner must not remain.");
excludes(playerCore, "function syncHeroActions(container = document) {", "The removed three-button sizing owner must not remain.");

includes(playerCore, "sessionStorage.setItem(cacheKey(context.playerId), JSON.stringify(merged));", "Known Player context must remain session-only and keyed by Player ID.");
includes(playerCore, "window.__mflPlayerFirstPaintRuntime = Object.freeze({", "The Player chunk must expose one canonical first-paint owner.");
includes(playerCore, "window.__mflPlayerFirstPaintRuntime?.hydrateHero?.({", "Final Player renderer must hydrate through that same owner.");
includes(playerCore, 'overall: statDisplayValue(row, "overall")', "Final hero must hydrate the authoritative Overall.");
excludes(playerCore, "function primaryPreciseOverall(row) {", "Shared Overall math must not become Player-only.");
excludes(playerCore, "async function copyPlayerId(id) {", "Shared copy behavior must not become Player-only.");
excludes(playerCore, "function renderPlayerPage(playerId) {", "Stable Player renderer name must remain shared.");
excludes(playerCore, "PLAYER_FIRST_PAINT_STYLESHEET", "Player first paint must not inject a repair stylesheet.");

includes(portraitCloseUp, "const PORTRAIT_CROP_HEIGHT_PX = 500;", "Evaluation preview must retain the same top-500px crop contract.");
includes(portraitCloseUp, "Math.min(PORTRAIT_CROP_HEIGHT_PX, sourceHeight)", "Evaluation preview crop geometry must remain aligned with Player pages.");

includes(appConfig, 'player: "/modules/app-core-player-runtime.js"', "Canonical app config must map Player to its generated chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "Route-core loader must consume canonical route-core paths.");
includes(coreSource, "const playerMatch = cleanPath.match(", "Canonical app-core source must recognize direct Player routes.");
includes(coreSource, "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});", "Direct Player startup must load route dependencies before startApp.");
includes(buildCore, 'const playerRuntimePath = resolve(siteRoot, "modules/app-core-player-runtime.js");', "Build must emit a generated Player runtime.");
includes(buildCore, "artifacts.routeChunks?.player", "Build must consume the Player route artifact.");

const generatedPlayer = await read("./modules/app-core-player-runtime.js");
const playerBanner = "// Generated Player core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedPlayer.startsWith(playerBanner), "Generated Player runtime must carry the build ownership banner.");
const generatedPlayerBody = generatedPlayer.slice(playerBanner.length).replace(/\s*$/, "");
invariant(generatedPlayerBody.length > 12_000, "Generated Player runtime is unexpectedly small.");
new Function(generatedPlayerBody);
for (const required of [
  "window.__mflPlayerFirstPaintRuntime = Object.freeze({",
  "function renderPitch(row) {",
  "function renderPlayerAttributePanel(row) {",
  "function renderPlayerPageOwner(playerId) {",
  "window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;",
  "const PLAYER_DETAIL_REQUIRED_COLUMNS = [\"height\", \"preferred_foot\", \"goalkeeping\", \"retirement_years\"]",
  "function detailDataReady(row, playerIdValue) {",
  "const PLAYER_READY_TRANSITION = \"color 180ms ease, opacity 180ms ease, background-color 180ms ease, border-color 180ms ease\";",
  "const PLAYER_PORTRAIT_SOURCE_WIDTH_PX = 912;",
  "const portraitSources = new Map();",
  "function applyPortraitGeometry(canvas, sourceWidthValue = PLAYER_PORTRAIT_SOURCE_WIDTH_PX, sourceHeightValue = PLAYER_PORTRAIT_CROP_HEIGHT_PX) {",
  "function pendingPitchHtml() {",
  "function stableAttributePanelHtml(row) {",
  "function applyHeroActionMenuLayout(actions) {",
  "function setHeroActionMenuOpen(menu, open) {",
  "function bindHeroActionMenu(container = document) {",
  "function animateReadyControls(container = document) {",
  "const PLAYER_HERO_ACTION_CHEVRON_WIDTH_PX = 34;",
  "const PLAYER_HERO_PRIMARY_ACTION_WIDTH_PX = 152;",
  '<div class="playerHeroIdentity">',
  'class="playerHeroMenuIcon playerEvaluateIcon"',
  'return "\\u00A0";',
]) {
  includes(generatedPlayerBody, required, `Generated Player runtime must retain ${required}.`);
}
for (const pitchLine of ["pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom"]) {
  includes(generatedPlayerBody, pitchLine, `Generated Player runtime must retain static pitch line ${pitchLine}.`);
}
includes(generatedPlayerBody, 'infoCardsData.push(["Rev Share", escapeHtml(revenueShare || "–")]);', "Generated Player runtime must keep final Profile geometry stable.");
includes(generatedPlayerBody, 'frame.style.marginBottom = "0";', "Generated Player runtime must keep portrait on the hero bottom edge.");
includes(generatedPlayerBody, 'overallValue.style.fontSize = "48px";', "Generated Player runtime must preserve the 48px Overall value.");
includes(generatedPlayerBody, '<section class="playerHero">', "Generated Player runtime must create the loaded hero under canonical stylesheet geometry.");
excludes(generatedPlayerBody, '<section class="playerHero" style=', "Generated Player runtime must not restore inline hero geometry.");
includes(generatedPlayerBody, "return renderPlayerAttributePanel(row);", "Generated Player runtime must keep goalkeeper Attributes naturally smaller.");
excludes(generatedPlayerBody, "function createHiddenAttributePlaceholder() {", "Generated Player runtime must not pad goalkeeper Attributes with hidden cards.");
excludes(generatedPlayerBody, ' title="${position} ${rating}"', "Generated Player runtime must not restore native position hover tooltips.");
includes(generatedPlayerBody, 'return `<div class="pitchPositionSlot" style="cursor:default;user-select:none;-webkit-user-select:none">${content}</div>`;', "Generated Player runtime must keep pitch positions passive and non-selectable.");
includes(generatedPlayerBody, "if (row && window.__mflPlayerFirstPaintRuntime?.detailDataReady?.(row, playerId) === false) {", "Generated Player runtime must keep partial in-site rows on the pending shell using per-player readiness.");
includes(generatedPlayerBody, 'line.className = "playerContractLine";', "Generated Player runtime must reserve final Contract structure at first paint.");
excludes(generatedPlayerBody, 'external.setAttribute("aria-disabled", "true");', "Generated Player runtime must keep Open link clickable during loading.");
includes(generatedPlayerBody, 'external.href = context.externalUrl;', "Generated Player runtime must publish a working Open link at first paint.");
includes(generatedPlayerBody, 'control.style.transition = "none";', "Generated Player runtime must commit the neutral view-button state without a reverse flicker.");
includes(generatedPlayerBody, 'control.style.backgroundColor = "var(--surface-muted)";', "Generated Player runtime must neutralize active view styling before the ready transition.");
includes(generatedPlayerBody, "controls[0]?.getBoundingClientRect();", "Generated Player runtime must commit the neutral state before enabling the ready transition.");
includes(generatedPlayerBody, 'window.__mflPlayerFirstPaintRuntime?.animateReadyControls?.(playerDetail);', "Generated Player runtime may request the ready animation after rendering.");
includes(generatedPlayerBody, 'if (!playerId || readyTransitionPlayerId !== playerId) return false;', "Generated Player runtime must suppress ready animation on subsequent view renders.");
includes(generatedPlayerBody, 'readyTransitionPlayerId = "";', "Generated Player runtime must consume the one-shot transition token.");
includes(generatedPlayerBody, '<i class="retirementMarker playerAgeMarker retirementMarker--${escapeHtml(ageMarker.status || "default")}"', "Generated Player runtime must preserve retirement marker color ownership outside generic Profile span styling.");
includes(generatedPlayerBody, 'wrapper.style.width = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";', "Generated Player runtime must keep split action width equal to dropdown width.");
includes(generatedPlayerBody, 'toggle.style.color = unavailable ? "var(--text-soft)" : "var(--text)";', "Generated Player runtime must keep the loading chevron greyed out without resizing it.");
includes(generatedPlayerBody, 'menu.style.opacity = open ? "1" : "0";', "Generated Player runtime must retain dropdown fade transition.");
includes(generatedPlayerBody, 'id="playerHeroActionMenuButton" class="playerHeroActionMenuButton"', "Generated Player runtime must keep the compact action chevron.");
includes(generatedPlayerBody, 'id="playerEvaluateButton" class="playerEvaluateButton playerHeroActionMenuItem"', "Generated Player runtime must keep Evaluate inside the dropdown.");
excludes(generatedPlayerBody, "function applyStablePlayerBoxGeometry(container = document) {", "Generated Player runtime must not restore the removed fixed box-size owner.");
excludes(generatedPlayerBody, "function syncHeroActions(container = document) {", "Generated Player runtime must not restore the removed three-button sizing owner.");
excludes(generatedPlayerBody, 'overallLabel.textContent = "Overall";', "Generated Player runtime must keep the hero Overall label removed.");

console.log("Player route-core splitting, target-row Player loading readiness, identical refresh/in-site pending structure, blank loading values, one-shot flicker-free neutral-to-ready controls, passive non-selectable pitch positions, render-blocking canonical 125px hero geometry, natural smaller goalkeeper Attributes, restored retirement-marker color ownership, 14/28/16 hero identity typography, reusable cropped portrait source, complete static pitch, equal-width Open-link split action/dropdown, transitioned dropdown, dollar-icon Evaluate action, and guarded identity validation passed.");
