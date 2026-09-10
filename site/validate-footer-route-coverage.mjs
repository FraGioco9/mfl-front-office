import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8").replace(/\r\n?/g, "\n");
const html = read("index.html");
const stylesBase = read("styles-base.css");
const footer = read("footer.css");
const responsive = read("responsive.css");
const generated = read("styles-runtime.css");
const staticUi = read("static-ui-runtime.js");
const pageLifecycle = read("modules/core-sources/shared-page-lifecycle.js");

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

const pageShells = [...html.slice(mainIndex, footerIndex).matchAll(/<section id="([^"]+)" class="([^"]*\bpageView\b[^"]*)"/g)].map((match) => ({
  id: match[1],
  classes: match[2].trim().split(/\s+/).filter(Boolean),
}));
assert.ok(pageShells.length >= ids.length, "Every static top-level route shell must be discoverable as a pageView before the footer.");
for (const id of ids) assert.ok(pageShells.some((shell) => shell.id === id), `${id} must be included in universal page-shell validation.`);

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

const regexEscape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const shellTokens = [...new Set(pageShells.flatMap((shell) => [
  `#${shell.id}`,
  ...shell.classes.map((className) => `.${className}`),
]))];

function splitSelectorList(selectorText) {
  const selectors = [];
  let start = 0;
  let roundDepth = 0;
  let squareDepth = 0;
  let quote = "";
  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") roundDepth += 1;
    else if (char === ")") roundDepth = Math.max(0, roundDepth - 1);
    else if (char === "[") squareDepth += 1;
    else if (char === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (char === "," && roundDepth === 0 && squareDepth === 0) {
      selectors.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(selectorText.slice(start).trim());
  return selectors.filter(Boolean);
}

function rightmostSelectorCompound(selector) {
  let start = 0;
  let roundDepth = 0;
  let squareDepth = 0;
  let quote = "";
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") roundDepth += 1;
    else if (char === ")") roundDepth = Math.max(0, roundDepth - 1);
    else if (char === "[") squareDepth += 1;
    else if (char === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (roundDepth === 0 && squareDepth === 0 && (char === ">" || char === "+" || char === "~" || /\s/.test(char))) {
      start = index + 1;
    }
  }
  return selector.slice(start).trim();
}

function selectorTargetsPageShell(selector) {
  const compound = rightmostSelectorCompound(selector);
  if (!compound || /::[a-z-]+/i.test(compound) || /:(?:before|after|first-letter|first-line)\b/i.test(compound)) return false;
  return shellTokens.some((token) => {
    const prefix = token[0] === "#" ? "#" : "\\.";
    const value = regexEscape(token.slice(1));
    return new RegExp(`${prefix}${value}(?![\\w-])`).test(compound);
  });
}

const flowViolations = [];
const generatedWithoutComments = generated.replace(/\/\*[\s\S]*?\*\//g, "");
for (const match of generatedWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const position = match[2].match(/\bposition\s*:\s*(fixed|absolute)\b/i)?.[1];
  if (!position) continue;
  for (const selector of splitSelectorList(match[1].trim())) {
    if (selectorTargetsPageShell(selector)) flowViolations.push(`${selector} -> position: ${position.toLowerCase()}`);
  }
}
assert.deepEqual(
  flowViolations,
  [],
  `Top-level pageView shells must remain in normal footer flow; fixed/absolute positioning found:\n${flowViolations.join("\n")}`,
);

const lockedPageRule = stylesBase.match(/\.myPlayersLockedPage\s*\{([^}]*)\}/s)?.[1] || "";
assert.ok(lockedPageRule, "Opted-out protected routes must retain the shared locked page shell styling.");
assert.match(lockedPageRule, /\bdisplay:\s*grid;/, "Opted-out protected content must stay centered by the existing grid shell.");
assert.match(lockedPageRule, /\bplace-items:\s*center;/, "Opted-out protected content must retain its centered presentation.");
assert.doesNotMatch(lockedPageRule, /\bposition:\s*(?:fixed|absolute);/, "Opted-out protected routes must participate in main normal flow so the page floor can position the footer.");
for (const property of ["top", "right", "bottom", "left"]) {
  assert.doesNotMatch(lockedPageRule, new RegExp(`\\b${property}:`), `Opted-out protected routes must not retain obsolete ${property} viewport geometry.`);
}
assert.ok(!responsive.includes("body.pinnedSidebarVisible .myPlayersLockedPage"), "Responsive CSS must not reintroduce viewport geometry for the normal-flow opted-out shell.");
assert.ok(!responsive.includes("body:not(.pinnedSidebarVisible) .myPlayersLockedPage"), "Responsive CSS must not reintroduce viewport geometry for the normal-flow opted-out shell.");
assert.ok(generated.includes(".myPlayersLockedPage {"), "Generated production CSS must include the canonical opted-out shell.");
assert.ok(!generated.includes(".myPlayersLockedPage {\n  position: fixed;"), "Generated production CSS must keep opted-out routes in normal footer flow.");

for (const protectedPage of ["myplayers", "watchlist", "settings"]) {
  assert.ok(pageLifecycle.includes(`pageName === "${protectedPage}"`), `${protectedPage} must remain part of the opted-out route guard.`);
}
assert.ok(pageLifecycle.includes("myPlayersLockedPage.hidden = false;"), "SPA navigation must reveal the same normal-flow locked shell for opted-out protected routes.");

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
console.log(`Universal footer coverage passed for ${pageShells.length} static shells plus dynamic Not Found, with every top-level pageView protected from fixed/absolute positioning.`);
