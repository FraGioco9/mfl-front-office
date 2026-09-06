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
const firstPaintFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(var(--mfl-footer-page-floor), max-content) max-content;
  align-content: start;
}`;
const firstPaintPageFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main > .pageView {
  grid-column: 1;
  grid-row: 1;
}`;
const firstPaintFooterFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main > .siteFooterDetails {
  grid-column: 1;
  grid-row: 2;
}`;
const clubFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }`;
const hiddenPlayerFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage {
        display: none;
      }`;
const invisiblePlayerFirstPaintGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage {
        visibility: hidden;
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
assert.ok(
  indexHtml.includes(invisiblePlayerFirstPaintGuard),
  "Direct Player first paint must stay visually hidden until identity verification while remaining layout-measurable.",
);

const playerShellIndex = indexHtml.indexOf('data-mfl-static-player-shell="true"');
const playerPrimeScriptIndex = indexHtml.indexOf('if (document.documentElement.dataset.initialEntityRoute !== "player") return;', playerShellIndex);
const footerIndex = indexHtml.indexOf('<footer class="siteFooterDetails"');
assert.ok(playerShellIndex >= 0, "Player first paint must have a static HTML loading shell before bootstrap executes.");
assert.ok(playerPrimeScriptIndex > playerShellIndex, "The direct Player route must synchronously remove the shell's hidden layout state during HTML parsing.");
assert.ok(footerIndex > playerPrimeScriptIndex, "The Player shell and its layout-priming script must both be parsed before the footer can paint.");
for (const token of [
  'class="playerHero playerHeroPending"',
  'class="playerPanel playerInfoPanel"',
  'class="playerPanel attributesPanel"',
  'data-mfl-static-player-notes="true"',
  'class="playerPanel pitchPanel"',
  'class="pitch"',
]) {
  assert.ok(indexHtml.includes(token), `Static Player first-paint geometry is missing ${token}.`);
}
assert.ok(
  indexHtml.includes('notesPanel.hidden = document.documentElement.dataset.storedWalletOptIn !== "true";'),
  "Static Player first paint must include Notes only when the stored opt-in state requires that box.",
);
assert.ok(
  bootstrap.includes("function primePlayerSkeleton()") && bootstrap.includes('target.id === "playerPage"'),
  "Bootstrap must keep hydrating the same Player skeleton after the HTML-owned first paint.",
);
assert.ok(
  buildCore.includes("function normalizePlayerFirstPaintShell(source)")
    && buildCore.includes("normalizePlayerFirstPaintShell(indexSource)"),
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
console.log("Shared responsive footer validation passed with direct Player loading using the real normal-flow shell bottom edge.");
