import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readSite = (path) => readFile(resolve(siteRoot, path), "utf8");

test("responsive layout has one explicit final owner loaded before runtime startup", async () => {
  const responsive = await readSite("responsive.css");
  const entry = await readSite("modules/app-entry.js");

  assert.match(responsive, /Canonical responsive layout owner/);
  assert.match(responsive, /@media \(max-width: 900px\)/);
  assert.match(entry, /data-mfl-responsive-layout/);
  assert.match(entry, /link\.href = "\/responsive\.css";/);
  assert.doesNotMatch(entry, /responsive\.css\?v=/);
  assert.match(entry, /await responsiveStylesReady;\n\s+installApiFetchPolicy\(\);/);
});

test("mobile owner neutralizes the pinned desktop shell instead of adding another sidebar width", async () => {
  const responsive = await readSite("responsive.css");

  assert.match(responsive, /--pinned-sidebar-width: 0px/);
  assert.match(responsive, /--sidebar-offset: 0px !important/);
  assert.match(responsive, /body\.pinnedSidebarVisible main,[\s\S]*?width: 100% !important;[\s\S]*?margin-left: 0 !important;/);
  assert.match(responsive, /\.menuRail,[\s\S]*?width: 100% !important;[\s\S]*?height: var\(--mobile-nav-height\)/);
  assert.match(responsive, /\.sidebar,[\s\S]*?flex-direction: row;[\s\S]*?overflow-x: auto/);
});

test("mobile table ownership keeps exact columns and scrolls the component rather than the page", async () => {
  const responsive = await readSite("responsive.css");
  const widths = await readSite("table-width-prime-runtime.js");
  const entry = await readSite("modules/app-entry.js");

  assert.match(responsive, /#progressionPage \.tableScroller,[\s\S]*?overflow-x: auto !important/);
  assert.match(responsive, /#progressionPage \.tableScroller table \{\n\s+min-width: 1240px !important;/);
  assert.doesNotMatch(responsive, /\.col-(?:select|id|flag|name|nationality|age|positions|seasons|stat|agent|contract|link)\s*\{/);

  assert.match(widths, /const MOBILE_TABLE_MIN_WIDTH = 1240;/);
  assert.match(widths, /getPropertyValue\("--pinned-sidebar-width"\)/);
  assert.doesNotMatch(widths, /return rail && !rail\.hidden \? 190 : 0/);
  assert.match(widths, /if \(mobileLayoutActive\(\)\) return applyFallbackWidths\(\);/);
  assert.match(widths, /scroller\.style\.setProperty\("overflow-x", "auto", "important"\)/);
  assert.match(widths, /takeOwnership/);
  assert.match(entry, /__mflTableWidthPrimeRuntime\?\.takeOwnership\?\.\(\)/);
});

test("mobile owner covers every fixed-width application surface", async () => {
  const responsive = await readSite("responsive.css");

  for (const selector of [
    ".searchDialog",
    ".filtersDialog",
    ".advancedSettingsDialog",
    ".evaluationLoadDialog",
    ".playerHero",
    ".pitch",
    ".evaluationSearchGroup",
    ".evaluationActions",
    ".mflStatsFilterButtons",
    ".settingsIdentity",
    ".changelogPatchList li",
    ".selectionBar",
  ]) {
    assert.ok(responsive.includes(selector), `responsive owner is missing ${selector}`);
  }
});
