import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8").replace(/\r\n?/g, "\n");
const html = read("index.html");
const footer = read("footer.css");
const responsive = read("responsive.css");
const generated = read("styles-runtime.css");
const staticUi = read("static-ui-runtime.js");

const ids = ["homePage", "progressionPage", "databaseStatsPage", "mflStatsPage", "myPlayersLockedPage", "evaluationPage", "playerPage", "settingsPage", "changelogPage", "privacyPage"];
for (const id of ids) assert.match(html, new RegExp(`<section id="${id}" class="[^"]*\\bpageView\\b[^"]*"`), `${id} must remain a pageView.`);

const mainIndex = html.indexOf("<main>");
const footerIndex = html.indexOf('<footer class="siteFooterDetails"');
const mainEnd = html.indexOf("</main>", footerIndex);
assert.ok(mainIndex >= 0 && footerIndex > mainIndex && mainEnd > footerIndex, "Footer must stay in main after static route shells.");
for (const id of ids) {
  const index = html.indexOf(`id="${id}"`, mainIndex);
  assert.ok(index > mainIndex && index < footerIndex, `${id} must precede the footer.`);
}

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
const firstPaintFooterFlow = `html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main > .siteFooterDetails {
  grid-column: 1;
  grid-row: 2;
}`;

assert.ok(footer.includes(mainFlow) && generated.includes(mainFlow), "Main must use the shared normal-flow footer column after route resolution.");
assert.ok(footer.includes(pageFlow) && generated.includes(pageFlow), "Visible route shells must own the shared floor and full rendered height.");
assert.ok(footer.includes(firstPaintFlow), "Unresolved non-Player refresh first paint must reserve the shared floor when route guards can hide measurable content.");
assert.ok(footer.includes(firstPaintFooterFlow), "The unresolved non-Player footer must occupy the explicit second grid row.");
assert.ok(footer.includes('.siteFooterDetails {\n  flex: 0 0 auto;'), "Footer must remain a non-shrinking flow item after route content.");
assert.ok(!footer.includes('html:not(.mflInitialRouteResolved) body > #appShell > main {'), "Player loading must bypass the unresolved grid fallback and retain normal-flow footer placement.");
assert.ok(!footer.includes('main:not(:has(> .pageView:not([hidden])))'), "First-paint footer placement must not depend on hidden-attribute inference.");
assert.ok(!generated.includes('body[data-page="evaluation"] #evaluationPage {\n  min-height:'), "Evaluation must not own a separate footer height workaround.");
assert.ok(!generated.includes('html body[data-page="evaluation"]:has(#evaluationPanel[hidden]) #evaluationPage {\n  min-height: 0;'), "Empty Evaluation must not collapse the footer floor.");

for (const floor of [
  "max(560px, calc(100dvh - var(--mobile-nav-overlay-clearance)))",
  "max(500px, calc(100dvh - var(--mobile-nav-overlay-clearance)))",
  "max(460px, calc(100dvh - var(--mobile-nav-overlay-clearance)))",
]) assert.ok(responsive.includes(`--mfl-footer-page-floor: ${floor};`), `Missing responsive footer floor ${floor}.`);

assert.ok(html.includes('data-mfl-static-player-shell="true"'), "Direct Player loading must keep its complete static shell before the footer.");
assert.ok(html.includes('if (playerPage instanceof HTMLElement) playerPage.hidden = false;'), "Direct Player loading must make that shell participate in layout before the footer is parsed.");
assert.ok(html.includes('html:not(.mflInitialRouteResolved):not([data-initial-page="home"]) #homePage'), "Direct non-Home refreshes must retain their CSS-hidden Home first-paint guard.");
assert.ok(staticUi.includes('page.id = "notFoundPage";') && staticUi.includes('page.className = "pageView homePage";'), "Not Found must use the universal pageView contract.");
assert.ok(staticUi.includes('main.insertBefore(page, footer instanceof HTMLElement ? footer : null);'), "Dynamic Not Found must be inserted before the normal-flow footer.");
console.log(`Universal footer coverage passed for ${ids.length} static shells plus dynamic Not Found, with direct Player loading kept in real normal flow.`);
