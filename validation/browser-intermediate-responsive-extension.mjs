import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-intermediate-responsive-extension.tmp.mjs");
const source = await readFile(sourcePath, "utf8");
let diagnosticSource = source;

for (const [from, to, label] of [
  ["  retirement_years: 5,", "  retirement_years: 2,", "fixture retirement marker"],
  ['      retirement_years: { raw: 5, display: "5" },', '      retirement_years: { raw: 2, display: "2" },', "first-paint retirement marker"],
  ["  listing_price: null,", "  listing_price: 10000,", "fixture Listing price"],
  [
    "writeJson(response, { generatedAt, prices: {}, flowBlockHeight: 0 });",
    'writeJson(response, { generatedAt, prices: { "1": 10000 }, flowBlockHeight: 0 });',
    "marketplace Listing overlay fixture",
  ],
]) {
  assert.ok(diagnosticSource.includes(from), `${label} hook must remain discoverable.`);
  diagnosticSource = diagnosticSource.replace(from, to);
}

const geometryMarker = "  function assertSharedChromeGeometry() {\n    const viewportWidth = document.documentElement.clientWidth;\n";
assert.ok(diagnosticSource.includes(geometryMarker), "Shared chrome geometry hook must remain discoverable.");

const geometryProbe = geometryMarker + String.raw`    if (viewportWidth >= 901 && viewportWidth <= 1366) {
      const menuRail = document.querySelector(".menuRail");
      const sidebarGrid = document.querySelector(".sidebarGrid");
      const main = document.querySelector("#appShell > main");
      const row = document.querySelector("#tableBody tr[data-player-id=\"1\"]");
      const marker = row?.querySelector("td.col-age .retirementMarker, td.col-age .newMintMarker");
      const markerChild = marker?.querySelector("img, .newMintIcon");
      const listingIcon = row?.querySelector("td.col-listing .listingCellIcon");
      const flag = row?.querySelector(".flagImage");
      const rarity = row?.querySelector(".tableOverallRarityCircle");
      const selection = row?.querySelector("td.selectionCell input[type=\"checkbox\"]");
      const actionButton = row?.querySelector(".playerTableActionsButton");
      const fullName = row?.querySelector(".playerNameFullValue");
      const compactName = row?.querySelector(".playerNameCompactValue");
      const listingPrice = row?.querySelector("td.col-listing .listingCellPrice");
      const headerLabel = (column) => String(document.querySelector(
        '#tableHead th[data-table-column="' + column + '"] [data-mfl-full-table-label][data-mfl-compact-table-label]'
      )?.textContent || "").trim();
      const menuStyle = menuRail instanceof HTMLElement ? getComputedStyle(menuRail) : null;
      const gridStyle = sidebarGrid instanceof HTMLElement ? getComputedStyle(sidebarGrid) : null;
      const mainStyle = main instanceof HTMLElement ? getComputedStyle(main) : null;
      const fullStyle = fullName instanceof HTMLElement ? getComputedStyle(fullName) : null;
      const compactStyle = compactName instanceof HTMLElement ? getComputedStyle(compactName) : null;
      const listingStyle = listingPrice instanceof HTMLElement ? getComputedStyle(listingPrice) : null;
      const markerWidth = marker instanceof Element ? Math.round(marker.getBoundingClientRect().width) : 0;
      const markerChildWidth = markerChild instanceof Element ? Math.round(markerChild.getBoundingClientRect().width) : 0;
      const markerPseudoWidth = marker instanceof Element ? Math.round(Number.parseFloat(getComputedStyle(marker, "::before").width) || 0) : 0;
      const markerGraphicWidth = markerChildWidth > 0 ? markerChildWidth : markerPseudoWidth;
      const listingIconWidth = listingIcon instanceof Element ? Math.round(listingIcon.getBoundingClientRect().width) : 0;
      const flagWidth = flag instanceof Element ? Math.round(flag.getBoundingClientRect().width) : 0;
      const rarityWidth = rarity instanceof Element ? Math.round(rarity.getBoundingClientRect().width) : 0;
      const selectionWidth = selection instanceof Element ? Math.round(selection.getBoundingClientRect().width) : 0;
      const actionButtonWidth = actionButton instanceof Element ? Math.round(actionButton.getBoundingClientRect().width) : 0;
      const expectedMarkerWidth = ({ 1366: 14, 1200: 13, 1041: 12, 901: 11 })[viewportWidth];
      const expectedListingIconWidth = ({ 1366: 11, 1200: 10, 1041: 9, 901: 8 })[viewportWidth];
      const expectedFlagWidth = ({ 1366: 16, 1200: 15, 1041: 14, 901: 13 })[viewportWidth];
      const expectedRarityWidth = ({ 1366: 7, 1200: 7, 1041: 7, 901: 6 })[viewportWidth];
      const expectedSelectionWidth = ({ 1366: 15, 1200: 14, 1041: 13, 901: 12 })[viewportWidth];
      const expectedActionButtonWidth = ({ 1366: 18, 1200: 18, 1041: 17, 901: 16 })[viewportWidth];

      assert(menuRail instanceof HTMLElement, "Intermediate compact navigation rail is missing at " + viewportWidth + "px.");
      assert(menuStyle?.position === "absolute", "Bottom navigation must replace the sidebar through 1366px.");
      assert(gridStyle?.display === "contents", "Sidebar grid must flatten into the bottom rail through 1366px.");
      assert(hidden(".topbar .stats"), "Header stats must stay hidden through 1366px.");
      assert(mainStyle?.marginLeft === "0px", "Main content must not reserve sidebar space through 1366px.");
      assert(row instanceof HTMLTableRowElement, "Database row is missing at " + viewportWidth + "px.");
      assert(fullStyle?.display === "none", "Full player name must remain compact through 1366px.");
      assert(compactStyle?.display !== "none", "Compact player name must remain visible through 1366px.");
      assert(listingStyle?.display === "none", "Listing price must remain icon-only through 1366px.");
      assert(marker instanceof HTMLElement, "Age status marker is missing at " + viewportWidth + "px.");
      assert(markerWidth === expectedMarkerWidth, "Age status marker must scale fluidly through 1366px.");
      assert(markerGraphicWidth === expectedMarkerWidth, "Visible Age status icon drawing must scale fluidly through 1366px.");
      assert(listingIconWidth === expectedListingIconWidth, "Listing icon must scale fluidly above 900px.");
      assert(flagWidth === expectedFlagWidth, "Flag icon must scale fluidly above 900px.");
      assert(rarityWidth === expectedRarityWidth, "Overall rarity marker must scale fluidly above 900px.");
      assert(selectionWidth === expectedSelectionWidth, "Selection control must scale fluidly above 900px.");
      assert(actionButtonWidth === expectedActionButtonWidth, "Row action control must scale fluidly above 900px.");
      assert(headerLabel("positions") === "POS", "Positions header must switch at the fixed <=1366px compact breakpoint.");
      assert(headerLabel("player_seasons") === "SZN", "Seasons header must switch at the fixed <=1366px compact breakpoint.");
      assert(headerLabel("overall") === "OVR", "Overall header must switch at the fixed <=1366px compact breakpoint.");
    }

    if (viewportWidth === 1367) {
      const menuRail = document.querySelector(".menuRail");
      const sidebarGrid = document.querySelector(".sidebarGrid");
      const row = document.querySelector("#tableBody tr[data-player-id=\"1\"]");
      const fullName = row?.querySelector(".playerNameFullValue");
      const compactName = row?.querySelector(".playerNameCompactValue");
      assert(menuRail instanceof HTMLElement && getComputedStyle(menuRail).position === "fixed", "Desktop sidebar must restore at 1367px.");
      assert(sidebarGrid instanceof HTMLElement && getComputedStyle(sidebarGrid).display === "grid", "Desktop sidebar grid must restore at 1367px.");
      assert(!hidden(".topbar .stats"), "Header stats must restore at 1367px.");
      assert(fullName instanceof HTMLElement && getComputedStyle(fullName).display !== "none", "Full player name must restore at 1367px.");
      assert(compactName instanceof HTMLElement && getComputedStyle(compactName).display === "none", "Compact player name must hide at 1367px.");
      const headerLabel = (column) => String(document.querySelector(
        '#tableHead th[data-table-column="' + column + '"] [data-mfl-full-table-label][data-mfl-compact-table-label]'
      )?.textContent || "").trim();
      assert(headerLabel("positions") === "Positions", "Positions header must restore its full label at 1367px.");
      assert(headerLabel("player_seasons") === "Seasons", "Seasons header must restore its full label at 1367px.");
      assert(headerLabel("overall") === "Overall", "Overall header must restore its full label at 1367px.");
    }
`;

diagnosticSource = diagnosticSource.replace(geometryMarker, geometryProbe);

const oldStatsContract = '      if (viewportWidth <= 900 && selector.startsWith(".stats")) {';
assert.ok(diagnosticSource.includes(oldStatsContract), "Shared stats visibility contract must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  oldStatsContract,
  '      if (viewportWidth <= 1366 && selector.startsWith(".stats")) {',
);

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([\n  ["database-1367", "/database/attributes", 1367, 900],\n  ["database-1366", "/database/attributes", 1366, 900],\n  ["database-1200", "/database/attributes", 1200, 900],\n  ["database-1041", "/database/attributes", 1041, 900],\n  ["database-901", "/database/attributes", 901, 900],\n]);\n\nconst server =',
);

await writeFile(temporaryPath, diagnosticSource, "utf8");
try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "Intermediate responsive extension browser regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Intermediate responsive extension browser regression passed.");
