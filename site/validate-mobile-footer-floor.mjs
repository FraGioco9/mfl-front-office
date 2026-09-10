import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const footer = read("./footer.css");
const responsive = read("./responsive.css");
const generated = read("./styles-runtime.css");
const indexHtml = read("./index.html");
const buildCore = read("./build-app-core.mjs");
const bootstrap = read("./bootstrap.js");

const mainFlow = `main {
  --mfl-footer-page-floor: 800px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  row-gap: 22px;
}`;
const pageFlow = `main > .pageView {
  flex: 0 0 auto;
  min-height: var(--mfl-footer-page-floor);
}`;
const firstPaintFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]):not([data-stored-wallet-opt-in="false"][data-initial-locked-page]) body > #appShell > main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(var(--mfl-footer-page-floor), max-content) max-content;
  align-content: start;
}`;
const firstPaintPageFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]):not([data-stored-wallet-opt-in="false"][data-initial-locked-page]) body > #appShell > main > .pageView {
  grid-column: 1;
  grid-row: 1;
}`;
const firstPaintFooterFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]):not([data-stored-wallet-opt-in="false"][data-initial-locked-page]) body > #appShell > main > .siteFooterDetails {
  grid-column: 1;
  grid-row: 2;
}`;
const clubFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }`;
const hiddenPlayerFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage {
        display: none;
      }`;
const cueGatedPlayerFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage,
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-player-first-paint-cues-ready="true"]) #playerPage {
        visibility: hidden;
        pointer-events: none;
      }`;
const visiblePlayerFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"] #playerPage {
        pointer-events: none;
      }`;

assert.ok(footer.includes(mainFlow) && generated.includes(mainFlow), "Every route must share the desktop 800px floor through normal flow.");
assert.ok(footer.includes(pageFlow) && generated.includes(pageFlow), "Visible pageViews must use the shared responsive floor while retaining their natural height.");
assert.ok(footer.includes(firstPaintFlow), "Unresolved non-Player refresh first paint must reserve an explicit shared floor before the footer.");
assert.ok(footer.includes(firstPaintPageFlow) && footer.includes(firstPaintFooterFlow), "Non-Player first-paint route shells and footer must occupy explicit content/footer rows.");
assert.ok(
  !footer.includes('html:not(.mflInitialRouteResolved) body > #appShell > main {'),
  "Direct Player loading must stay in the base flex flow so its actual lowest box determines the footer position.",
);
assert.ok(!footer.includes('main:not(:has(> .pageView:not([hidden])))'), "Refresh first paint must not infer route visibility from the hidden attribute.");
assert.ok(indexHtml.includes(clubFirstPaintGuard), "Direct Club refreshes must retain their pre-verification hidden-shell guard.");
assert.ok(!indexHtml.includes(hiddenPlayerFirstPaintGuard), "Direct Player first paint must not remove the Player page from layout.");
assert.ok(!indexHtml.includes(cueGatedPlayerFirstPaintGuard), "The retired identity-only Player visibility gate must not return.");
assert.ok(
  indexHtml.includes(visiblePlayerFirstPaintGuard),
  "Direct Player first paint must keep the complete normal-flow shell visible while interaction remains blocked until route readiness.",
);

const playerShellIndex = indexHtml.indexOf('data-mfl-static-player-shell="true"');
const playerPrimeScriptIndex = indexHtml.indexOf('if (root.dataset.initialEntityRoute !== "player") return;', playerShellIndex);
const playerContentGateIndex = indexHtml.indexOf('root.dataset.playerFirstPaintContentReady = "false";', playerPrimeScriptIndex);
const playerCueGateIndex = indexHtml.indexOf('root.dataset.playerFirstPaintCuesReady = "false";', playerContentGateIndex);
const footerIndex = indexHtml.indexOf('<footer class="siteFooterDetails"');
assert.ok(playerShellIndex >= 0, "Player first paint must have a static HTML loading shell before bootstrap executes.");
assert.ok(playerPrimeScriptIndex > playerShellIndex, "The direct Player route must synchronously remove the shell's hidden layout state during HTML parsing.");
assert.ok(playerContentGateIndex > playerPrimeScriptIndex && playerCueGateIndex > playerContentGateIndex, "The parser-owned Player shell must mark both authoritative content and cue readiness pending before release.");
assert.ok(footerIndex > playerCueGateIndex, "The Player shell and its cue-priming script must both be parsed before the footer can paint.");
for (const token of [
  'class="playerHero playerHeroPending"',
  'class="playerPanel playerInfoPanel"',
  'class="playerPanel attributesPanel"',
  'data-mfl-static-player-notes="true"',
  'class="playerPanel pitchPanel"',
  'class="pitch"',
  'shell.className = "viewsScrollerShell";',
  'viewsScrollButton viewsScrollButtonRight',
]) {
  assert.ok(indexHtml.includes(token), `Static Player first-paint geometry is missing ${token}.`);
}
assert.ok(indexHtml.includes('<h2 class="playerTitle">'), "Parser-owned Player hero must use the same title class structure as the hydrated hero.");
assert.ok(!indexHtml.includes('<h2 class="tablePageTitle playerTitle">'), "Player first paint must not inherit table-title layout that changes the mobile hero size before hydration.");
assert.ok(indexHtml.includes('<div class="attributeGrid" data-mfl-static-player-attributes>'), "Static Player first paint must own a parser-synchronized Attribute grid.");
assert.ok(indexHtml.includes('<span>Overall</span><strong>&nbsp;</strong>'), "Overall is position-independent and must be labeled before cached values are projected.");
for (const label of ["Nationality", "Height", "Foot", "Seasons", "Agent", "Contract", "Rev Share"]) {
  assert.ok(!indexHtml.includes(`<span>${label}</span><strong>-</strong>`), `Static Player first paint must not show '-' for pending ${label} data.`);
}
assert.ok(!indexHtml.includes('<span class="playerDetailAgeLine">-</span>'), "Static Player first paint must leave pending Age blank instead of showing '-'.");
for (const token of [
  'const attributeLabels = (positions) => positions[0] === "GK"',
  '["Overall", "Goalkeeping"]',
  '["Overall", "Pace", "Dribbling", "Shooting", "Defense", "Passing", "Physical"]',
  'const syncPendingAttributeLabels = () => {',
  'if (!positions.length) {',
  'const overallValue = cachedAttributeValue("overall");',
]) assert.ok(indexHtml.includes(token), `Parser-first Player Attribute labels/Overall must stay synchronized to known cached data throughout loading: ${token}`);
for (const pitchLine of ["pitchBoxTop", "pitchGoalTop", "pitchArcTop", "pitchBoxBottom", "pitchGoalBottom", "pitchArcBottom"]) {
  assert.ok(indexHtml.includes(`class="pitchLine ${pitchLine}"`), `Static Player first paint must include ${pitchLine}.`);
}
assert.ok((indexHtml.match(/class="pitchRow pitchRow[13]"/g) || []).length >= 7, "Static Player first paint must include all seven pitch rows before Player data loads.");
assert.ok(bootstrap.includes('function playerLoadingAttributeLabels(context = firstPaintPlayerContext()) {'), "Bootstrap fallback Player shell must derive Attribute labels from cached position data.");
assert.ok(bootstrap.includes('function playerLoadingPitchHtml() {'), "Bootstrap fallback Player shell must draw the complete pitch before Player data loads.");
assert.ok(
  indexHtml.includes('notesPanel.hidden = root.dataset.storedWalletOptIn !== "true";'),
  "Static Player first paint must include Notes only when the stored opt-in state requires that box.",
);
assert.ok(
  bootstrap.includes("function primePlayerSkeleton()") && bootstrap.includes('target.id === "playerPage"'),
  "Bootstrap must keep hydrating the same Player skeleton after the HTML-owned first paint.",
);
const primePlayerStart = bootstrap.indexOf("function primePlayerSkeleton() {");
const primePlayerEnd = primePlayerStart >= 0 ? bootstrap.indexOf("\n  function ", primePlayerStart + 1) : -1;
const primePlayerBody = primePlayerStart >= 0 && primePlayerEnd > primePlayerStart
  ? bootstrap.slice(primePlayerStart, primePlayerEnd)
  : "";
assert.ok(
  primePlayerBody.includes('playerDetail.dataset.mflStaticPlayerShell === "true"')
    && primePlayerBody.includes('.playerHero.playerHeroPending[data-player-shell-id]')
    && primePlayerBody.indexOf('playerDetail.dataset.loadingShell = "true";') < primePlayerBody.indexOf("playerDetail.innerHTML = `"),
  "Direct Player bootstrap must adopt the parser-owned hero before the fallback skeleton replacement path.",
);
assert.ok(
  indexHtml.includes('class="playerGrid playerGridPending" data-mfl-static-player-grid="true"')
    && indexHtml.includes('data-mfl-static-player-age')
    && indexHtml.includes('hero.dataset.playerShellId = playerId;')
    && indexHtml.includes('sessionStorage.getItem("mfl-player-first-paint-v1:" + playerId)')
    && indexHtml.includes('marker.classList.add("retirementMarker", "playerAgeMarker")'),
  "Parser-owned Player first paint must reserve the pending grid identity and render a cached Age retirement marker before bootstrap/runtime hydration.",
);
assert.ok(
  indexHtml.includes('const cachedName = String(firstPaintContext?.name || knownDisplay("name") || "").trim();')
    && indexHtml.includes('const cachedPositionText = knownDisplay("positions");')
    && indexHtml.includes('const compactPlayerPageName = (value) => {')
    && indexHtml.includes('const syncPendingName = () => {')
    && indexHtml.includes('titleName.dataset.playerFullName = fullName;')
    && indexHtml.includes('if (titleName.textContent !== displayName) titleName.textContent = displayName;')
    && indexHtml.includes('if (positionsText instanceof HTMLElement && cachedPositions.length) positionsText.textContent = cachedPositions.join(", ");'),
  "Parser-owned Player hero must project cached identity in the final responsive name format and keep enforcing it throughout pending renders.",
);
for (const token of [
  'const knownDisplay = (column) => {',
  'const cachedAttributeValue = (column) => {',
  'const syncCachedProfileValues = () => {',
  'setProfileText("Height", formatCachedHeight());',
  'setProfileText("Foot", formatCachedFoot());',
  'setProfileText("Seasons", knownDisplay("player_seasons"));',
  'const agentName = knownDisplay("wallet_name");',
  'const teamName = cachedContractTeamName();',
  'setProfileText("Rev Share", formatCachedRevenueShare());',
  'const syncCachedHeroValues = () => {',
  'const listingRaw = knownRaw("listing_price");',
  'value.textContent = cachedAttributeValue(columns[index]) || "\\u00a0";',
  'syncCachedHeroValues();',
  'syncCachedProfileValues();',
]) assert.ok(indexHtml.includes(token), `Parser-owned Player first paint must project cached data without waiting for hydration: ${token}`);
assert.ok(
  indexHtml.includes('pendingObserver.observe(playerDetail, { childList: true, subtree: true, characterData: true });')
    && indexHtml.includes('pendingObserver.observe(root, { attributes: true, attributeFilter: ["data-player-first-paint-content-ready"] });')
    && indexHtml.includes('syncPendingPlayerShell();'),
  "Parser-owned Player loading must keep responsive name and Attribute labels/values synchronized until authoritative content is ready.",
);
assert.ok(
  indexHtml.includes('const applyFirstPaintHeroActionLayout = (playerHero) => {')
    && indexHtml.includes('primary.style.justifyContent = "center";')
    && indexHtml.includes('primary.style.padding = "0 10px";')
    && indexHtml.includes('toggle.style.color = "var(--text-soft)";')
    && indexHtml.includes('toggle.style.opacity = "0.5";')
    && indexHtml.includes('applyFirstPaintHeroActionLayout(hero);'),
  "Parser-owned Player actions must use their final text geometry immediately, with the desktop chevron greyed until loading completes.",
);
assert.ok(
  buildCore.includes("function normalizePlayerFirstPaintShell(source, canonicalPlayerShell)")
    && buildCore.includes('const playerHtmlSourcePath = resolve(siteRoot, "html-sources", "player.html");')
    && buildCore.includes("normalizePlayerFirstPaintShell(indexSource, playerHtmlSource)"),
  "The build must own regeneration of the pre-footer static Player first-paint shell.",
);
assert.ok(
  indexHtml.includes('html:not(.mflInitialRouteResolved):not([data-initial-page="home"]) #homePage'),
  "Direct non-Home refreshes must retain the CSS-hidden Home first-paint guard that the footer floor handles explicitly.",
);

const contracts = [
  ["900", "max(560px, calc(100dvh - var(--mobile-nav-overlay-clearance)))"],
  ["520", "max(500px, calc(100dvh - var(--mobile-nav-overlay-clearance)))"],
  ["380", "max(460px, calc(100dvh - var(--mobile-nav-overlay-clearance)))"],
];
for (const [breakpoint, floor] of contracts) assert.ok(responsive.includes(`--mfl-footer-page-floor: ${floor};`), `${breakpoint}px must own the scaled shared footer floor ${floor}.`);

assert.equal((footer.match(/--mfl-footer-page-floor:/g) || []).length, 1, "Desktop footer floor must have one canonical declaration.");
assert.equal((responsive.match(/--mfl-footer-page-floor:/g) || []).length, 3, "Responsive footer floor must be defined exactly once at each mobile breakpoint.");
assert.ok(!responsive.includes("#homePage {\n    --mfl-footer-page-floor") && !responsive.includes("#progressionPage {\n    --mfl-footer-page-floor"), "Mobile footer floor must not be route-specific.");
assert.ok(!footer.includes("!important") && !responsive.includes("--mfl-footer-page-floor: 800px !important"), "Footer floor must not use overrides or !important.");
console.log("Shared responsive footer validation passed with direct Player loading using the complete visible normal-flow shell, stable mobile hero geometry, cached first-paint data, and loading-synchronized Attribute labels/values.");
