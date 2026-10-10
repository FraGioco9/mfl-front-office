import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const legacyMode = process.env.MFL_BROWSER_RESPONSIVE_COMPAT_MODE;
const mode = legacyMode || process.argv[2];
assert.ok(
  (legacyMode === undefined ? process.argv.length === 3 : ["long-mobile-table", "sticky-name-theme"].includes(legacyMode))
    && ["mobile-resize", "shell-boundary", "intermediate", "long-mobile-table", "sticky-name-theme"].includes(mode),
  "Specify one responsive browser contract: mobile-resize, shell-boundary, intermediate, long-mobile-table or sticky-name-theme.");
const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const specs = {
  "mobile-resize": {
    temporary: ".browser-mobile-table-responsive-resize.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1367, 900]]);\n\nconst server =',
    failure: "Mobile table responsive resize browser regression failed.",
    success: "Mobile table responsive resize browser regression passed through the 1366px compact boundary.",
  },
  "shell-boundary": {
    temporary: ".browser-responsive-shell-breakpoint.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1367, 900]]);\n\nconst server =',
    failure: "Responsive shell breakpoint browser regression failed.",
    success: "Responsive shell breakpoint browser regression passed through the 1366px compact boundary.",
  },
  "intermediate": {
    temporary: ".browser-intermediate-responsive-extension.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([\n  ["database-1367", "/database/attributes", 1367, 900],\n  ["database-1366", "/database/attributes", 1366, 900],\n  ["database-1200", "/database/attributes", 1200, 900],\n  ["database-1041", "/database/attributes", 1041, 900],\n  ["database-901", "/database/attributes", 901, 900],\n]);\n\nconst server =',
    failure: "Intermediate responsive extension browser regression failed.",
    success: "Intermediate responsive extension browser regression passed.",
  },
  "long-mobile-table": {
    temporary: ".browser-long-mobile-table-long-mobile-table.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["long-mobile-table-long-mobile-table", "/database/attributes#long-mobile-table-long-table", 390, 844]]);\n\nconst server =',
    failure: "Long mobile table long mobile table browser regression failed.",
    success: "Long mobile table 100-row mobile table regression passed.",
  },
  "sticky-name-theme": {
    temporary: ".browser-sticky-name-theme-sticky-theme.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["sticky-name-theme-sticky-themes", "/database/attributes", 390, 844]]);\n\nconst server =',
    failure: "Sticky Name theme sticky Name browser regression failed.",
    success: "Sticky Name theme sticky Name themes and scroll boundaries passed.",
  },
};
const spec = specs[mode];
const temporaryPath = resolve(validationDirectory, spec.temporary);
const source = await readFile(sourcePath, "utf8");
let diagnosticSource = source;

if (mode === "mobile-resize") {
for (const [from, to, label] of [
  ['  name: "Browser Player",', '  name: "Nicolò Barella",', "fixture player name"],
  ["  listing_price: null,", "  listing_price: 10000,", "fixture Listing price"],
  ["  retirement_years: 5,", "  retirement_years: 2,", "fixture retirement marker"],
  ['  const expectedPlayerName = "Browser Player";', '  const expectedPlayerName = "Nicolò Barella";', "browser expected player name"],
  [
    "writeJson(response, { generatedAt, prices: {}, flowBlockHeight: 0 });",
    'writeJson(response, { generatedAt, prices: { "1": 10000 }, flowBlockHeight: 0 });',
    "marketplace Listing overlay fixture",
  ],
]) {
  assert.ok(diagnosticSource.includes(from), `${label} hook must remain discoverable.`);
  diagnosticSource = diagnosticSource.replace(from, to);
}

const runtimeEnableMarker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(diagnosticSource.includes(runtimeEnableMarker), "Chrome runtime-enable hook must remain discoverable.");

// The borrowed routing-regression fixture would otherwise independently run
// NAV-02, navigating Database -> Privacy -> Database while CDP measures the
// still-attached Database row. Privacy legitimately hides #progressionPage,
// yielding zero Age/Listing rectangles despite correct computed media rules.
// Disable only that competing browser test inside this GENERATED fixture; the
// canonical routing suite continues to execute unmodified in its own CI job.
const competingRouteRunner = "      else await runRepresentativeRoute();";
assert.ok(diagnosticSource.includes(competingRouteRunner),
  "Browser routing regression's concurrent navigation hook must remain discoverable.");
assert.match(diagnosticSource, /async function runNav02HistoryMatrix\(setPage\) \{[\s\S]*?await setPage\("privacy", true\);/,
  "Routing fixture's navigation to hidden Privacy must remain identifiable.");
diagnosticSource = diagnosticSource.replace(
  competingRouteRunner,
  '      else if (scenario !== "database") await runRepresentativeRoute();',
);

const responsiveProbe = String.raw`    await cdp.send("Runtime.enable");

    const responsiveDeadline = Date.now() + 15_000;
    let responsiveReady = false;
    while (Date.now() < responsiveDeadline) {
      const ready = await cdp.send("Runtime.evaluate", {
        expression: 'document.documentElement.dataset.mflRouteReady === "true" && Boolean(document.querySelector("#tableBody tr[data-player-id=\\"1\\"]"))',
        returnByValue: true,
      });
      if (ready?.result?.value === true) {
        responsiveReady = true;
        break;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    assert.equal(responsiveReady, true, "Responsive Database fixture never became ready.");

    const storedRow = await cdp.send("Runtime.evaluate", {
      expression: '(() => { const row = document.querySelector("#tableBody tr[data-player-id=\\"1\\"]"); window.__mflResponsiveResizeOriginalRow = row; return row instanceof HTMLTableRowElement; })()',
      returnByValue: true,
    });
    assert.equal(storedRow?.result?.value, true, "Responsive Database fixture row is missing.");

    // Reproduce the *observed geometry signature* without racing CI timings:
    // hidden route ancestor -> zero icon boxes, even with a nonzero CSS
    // pseudo-icon width. Restore visibility in the same evaluation and verify
    // no production CSS or table data was modified by this controlled probe.
    const hiddenRouteControl = await cdp.send("Runtime.evaluate", {
      expression: '(() => { const page = document.getElementById("progressionPage"); const row = document.querySelector("#tableBody tr[data-player-id=\\\"1\\\"]"); const age = row?.querySelector("td.col-age .retirementMarker, td.col-age .newMintMarker"); const listing = row?.querySelector("td.col-listing .listingCellIcon"); if (!page || !row || !age || !listing) return { missing: true }; const before = { visible: !page.hidden, route: document.body.dataset.page, width: age.getBoundingClientRect().width, listingWidth: listing.getBoundingClientRect().width }; const wasHidden = page.hidden; let collapsed; try { page.hidden = true; collapsed = { ageWidth: age.getBoundingClientRect().width, listingWidth: listing.getBoundingClientRect().width, pseudoWidth: Number.parseFloat(getComputedStyle(age, "::before").width) }; } finally { page.hidden = wasHidden; } return { before, collapsed, restored: !page.hidden && age.getBoundingClientRect().width > 0 && listing.getBoundingClientRect().width > 0 }; })()',
      returnByValue: true,
    });
    const hiddenControl = hiddenRouteControl?.result?.value || {};
    assert.equal(hiddenControl.before?.route, "database", "TEST-04 must start on Database, not another route.");
    assert.equal(hiddenControl.before?.visible, true, "TEST-04 Database route must be visible before resize.");
    assert.ok(hiddenControl.before?.width > 0 && hiddenControl.before?.listingWidth > 0,
      "TEST-04 icons must have boxes before the controlled hidden-ancestor reproduction.");
    assert.equal(hiddenControl.collapsed?.ageWidth, 0, "Hidden route must remove the Age marker's layout box.");
    assert.equal(hiddenControl.collapsed?.listingWidth, 0, "Hidden route must remove the Listing icon's layout box.");
    assert.ok(hiddenControl.collapsed?.pseudoWidth > 0, "Hidden route must retain nonzero computed icon style.");
    assert.equal(hiddenControl.restored, true, "Controlled route hide must restore both icon boxes.");


    const snapshotResponsiveTable = async (viewportWidth) => {
      const mobileDeviceMode = viewportWidth <= 900;
      await cdp.send("Emulation.setTouchEmulationEnabled", {
        enabled: mobileDeviceMode,
        maxTouchPoints: mobileDeviceMode ? 5 : 1,
      });
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewportWidth,
        height,
        screenWidth: viewportWidth,
        screenHeight: height,
        deviceScaleFactor: mobileDeviceMode ? 3 : 1,
        mobile: mobileDeviceMode,
      });
      await cdp.send("Runtime.evaluate", {
        expression: 'window.dispatchEvent(new Event("resize"));',
      });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 180));
      const evaluation = await cdp.send("Runtime.evaluate", {
        expression: "(() => { const row = document.querySelector('#tableBody tr[data-player-id=\\\"1\\\"]'); if (!(row instanceof HTMLTableRowElement)) return { missing: 'row', width: window.innerWidth }; const fullNameValue = row.querySelector('.playerNameFullValue'); const compactNameValue = row.querySelector('.playerNameCompactValue'); const fullNameDisplay = fullNameValue instanceof HTMLElement ? getComputedStyle(fullNameValue).display : 'missing'; const compactNameDisplay = compactNameValue instanceof HTMLElement ? getComputedStyle(compactNameValue).display : 'missing'; const renderedName = fullNameDisplay === 'none' ? String(compactNameValue?.textContent || '').trim() : String(fullNameValue?.textContent || '').trim(); const listingPrice = row.querySelector('td.col-listing .listingCellPrice'); const listingIcon = row.querySelector('td.col-listing .listingCellIcon'); const listingPricePresent = listingPrice instanceof HTMLElement; const listingPriceVisible = listingPricePresent && getComputedStyle(listingPrice).display !== 'none' && getComputedStyle(listingPrice).visibility !== 'hidden' && listingPrice.getClientRects().length > 0; const ageHost = row.querySelector('td.col-age .tableControlCellContent'); const ageMarker = row.querySelector('td.col-age .retirementMarker, td.col-age .newMintMarker'); const markerChild = ageMarker?.querySelector('img, .newMintIcon'); const ageStyle = ageHost instanceof HTMLElement ? getComputedStyle(ageHost) : null; const ageGap = ageStyle ? String(ageStyle.columnGap || ageStyle.gap || '') : ''; const ageGapPx = Number.parseFloat(ageGap); const iconWidth = listingIcon instanceof HTMLElement ? Math.round(listingIcon.getBoundingClientRect().width) : 0; const ageMarkerRect = ageMarker instanceof Element ? ageMarker.getBoundingClientRect() : null; const ageMarkerWidth = ageMarkerRect ? Math.round(ageMarkerRect.width) : 0; const ageMarkerHeight = ageMarkerRect ? Math.round(ageMarkerRect.height) : 0; const markerChildWidth = markerChild instanceof Element ? Math.round(markerChild.getBoundingClientRect().width) : 0; const markerPseudoWidth = ageMarker instanceof Element ? Math.round(Number.parseFloat(getComputedStyle(ageMarker, '::before').width) || 0) : 0; const ageMarkerGraphicWidth = markerChildWidth > 0 ? markerChildWidth : markerPseudoWidth; const markerPseudoStyle = ageMarker instanceof Element ? getComputedStyle(ageMarker, '::before') : null; const ageMarkerMaskSize = markerPseudoStyle ? String(markerPseudoStyle.maskSize || markerPseudoStyle.webkitMaskSize || markerPseudoStyle.getPropertyValue('-webkit-mask-size') || '') : ''; const ageMarkerMaskPixels = Number.parseFloat(ageMarkerMaskSize); const ageMarkerMaskFitsBox = ageMarkerMaskSize === 'contain' || ageMarkerMaskSize.includes('%') || (Number.isFinite(ageMarkerMaskPixels) && Math.round(ageMarkerMaskPixels) === ageMarkerWidth); const ageMarkerStyle = ageMarker instanceof Element ? getComputedStyle(ageMarker) : null; const listingIconStyle = listingIcon instanceof Element ? getComputedStyle(listingIcon) : null; const tableScroller = document.querySelector('#progressionPage .playerTableScroller'); const ageHostRect = ageHost instanceof Element ? ageHost.getBoundingClientRect() : null; const ageCell = row.querySelector('td.col-age'); const markerRect = ageMarker instanceof Element ? ageMarker.getBoundingClientRect() : null; const ageCellRect = ageCell instanceof Element ? ageCell.getBoundingClientRect() : null; const ageMarkerInsideCell = Boolean(markerRect && ageCellRect && markerRect.left >= ageCellRect.left - 0.5 && markerRect.right <= ageCellRect.right + 0.5 && markerRect.top >= ageCellRect.top - 0.5 && markerRect.bottom <= ageCellRect.bottom + 0.5); return { activePage: document.body.dataset.page, progressionPageHidden: Boolean(document.getElementById('progressionPage')?.hidden), rowBoxWidth: Math.round(row.getBoundingClientRect().width), tableScrollerBoxWidth: tableScroller instanceof Element ? Math.round(tableScroller.getBoundingClientRect().width) : 0, ageHostBoxWidth: ageHostRect ? Math.round(ageHostRect.width) : 0, ageMarkerCssDisplay: ageMarkerStyle?.display || 'missing', ageMarkerCssWidth: ageMarkerStyle?.width || 'missing', ageMarkerCssVisibility: ageMarkerStyle?.visibility || 'missing', listingIconCssDisplay: listingIconStyle?.display || 'missing', listingIconCssWidth: listingIconStyle?.width || 'missing', ageMarkerConnected: Boolean(ageMarker?.isConnected), width: window.innerWidth, clientWidth: document.documentElement.clientWidth, visualViewportWidth: Math.round(window.visualViewport?.width || 0), devicePixelRatio: window.devicePixelRatio, sameRow: row === window.__mflResponsiveResizeOriginalRow, renderedName, fullNameNodePresent: fullNameValue instanceof HTMLElement, compactNameNodePresent: compactNameValue instanceof HTMLElement, fullNameDisplay, compactNameDisplay, listingPricePresent, listingPriceVisible, listingIconWidth: iconWidth, ageMarkerPresent: ageMarker instanceof HTMLElement && ageMarker.getClientRects().length > 0, ageMarkerWidth, ageMarkerHeight, ageMarkerGraphicWidth, ageMarkerMaskSize, ageMarkerMaskFitsBox, ageMarkerInsideCell, ageGap, ageGapPx, compactTableMedia: matchMedia('(max-width: 1366px)').matches, mobileMedia: matchMedia('(max-width: 900px)').matches, coarsePointer: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches }; })()",
        returnByValue: true,
      });
      return evaluation?.result?.value || {};
    };

    const stages = [];
    const viewportSweep = [1664, 1444, 1367, 1366, 1200, 1041, 901, 900, 700, 520, 380, 360, 1367, 1444, 1664];
    for (const viewportWidth of [...viewportSweep, ...viewportSweep]) {
      const stage = await snapshotResponsiveTable(viewportWidth);
      stages.push(stage);
      if (!stage.ageMarkerPresent || (stage.listingPricePresent && stage.listingIconWidth === 0)) {
        // Diagnostic only: preserve the FIRST capture for all existing assertions.
        // Re-measure the same viewport to distinguish persistent zero geometry from
        // an intermittent post-resize layout transition; do not retry the assertion.
        const secondCapture = await snapshotResponsiveTable(viewportWidth);
        console.error("TEST-04 responsive resize zero geometry: " + JSON.stringify({
          viewportWidth, firstCapture: stage, secondCapture
        }));
      }
    }

    const expected = [
      { width: 1664, name: "Nicolò Barella", listing: null, gap: 7.00, icon: 12, marker: 16, compact: false, mobile: false },
      { width: 1444, name: "Nicolò Barella", listing: null, gap: 5.99, icon: 11, marker: 13, compact: false, mobile: false },
      { width: 1367, name: "Nicolò Barella", listing: null, gap: 5.63, icon: 11, marker: 12, compact: false, mobile: false },
      { width: 1366, name: "N. Barella", listing: false, gap: 5.63, icon: 11, marker: 12, compact: true, mobile: false },
      { width: 1200, name: "N. Barella", listing: false, gap: 4.87, icon: 10, marker: 11, compact: true, mobile: false },
      { width: 1041, name: "N. Barella", listing: false, gap: 4.13, icon: 9, marker: 11, compact: true, mobile: false },
      { width: 901, name: "N. Barella", listing: false, gap: 3.49, icon: 8, marker: 10, compact: true, mobile: false },
      { width: 900, name: "N. Barella", listing: false, gap: 3.48, icon: 8, marker: 10, compact: true, mobile: true },
      { width: 700, name: "N. Barella", listing: false, gap: 2.56, icon: 8, marker: 9, compact: true, mobile: true },
      { width: 520, name: "N. Barella", listing: false, gap: 1.74, icon: 7, marker: 9, compact: true, mobile: true },
      { width: 380, name: "N. Barella", listing: false, gap: 1.09, icon: 6, marker: 8, compact: true, mobile: true },
      { width: 360, name: "N. Barella", listing: false, gap: 1.00, icon: 6, marker: 8, compact: true, mobile: true },
      { width: 1367, name: "Nicolò Barella", listing: null, gap: 5.63, icon: 11, marker: 12, compact: false, mobile: false },
      { width: 1444, name: "Nicolò Barella", listing: null, gap: 5.99, icon: 11, marker: 13, compact: false, mobile: false },
      { width: 1664, name: "Nicolò Barella", listing: null, gap: 7.00, icon: 12, marker: 16, compact: false, mobile: false },
    ];

    assert.equal(stages.length, expected.length * 2, "TEST-04 requires two complete viewport sweeps.");
    stages.forEach((stage, index) => {
      const contract = expected[index % expected.length];
      assert.equal(stage.activePage, "database", "A competing fixture navigated away during responsive measurement: " + JSON.stringify(stage));
      assert.equal(stage.progressionPageHidden, false, "Database view became hidden during responsive measurement: " + JSON.stringify(stage));
      const stageDetail = JSON.stringify(stage);
      assert.equal(stage.width, contract.width, "Layout viewport width is wrong at " + contract.width + "px: " + stageDetail);
      assert.equal(stage.clientWidth, contract.width, "Document client width is wrong at " + contract.width + "px: " + stageDetail);
      assert.equal(stage.visualViewportWidth, contract.width, "Visual viewport width is wrong at " + contract.width + "px: " + stageDetail);
      assert.equal(stage.sameRow, true, "Database row was replaced at " + contract.width + "px: " + stageDetail);
      assert.equal(stage.renderedName, contract.name, "Player name did not follow responsive contract at " + contract.width + "px: " + stageDetail);
      if (contract.compact) {
        assert.equal(stage.fullNameDisplay, "none", "Full player name must hide at compact width " + contract.width + "px: " + stageDetail);
        assert.notEqual(stage.compactNameDisplay, "none", "Compact player name must show at " + contract.width + "px: " + stageDetail);
      } else {
        assert.notEqual(stage.fullNameDisplay, "none", "Full player name must show above the compact breakpoint at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.compactNameDisplay, "none", "Compact player name must hide above the compact breakpoint at " + contract.width + "px: " + stageDetail);
      }
      assert.equal(stage.listingPricePresent, true, "Listing price must stay in breakpoint-neutral DOM at " + contract.width + "px: " + stageDetail);
      if (contract.listing !== null) {
        assert.equal(stage.listingPriceVisible, contract.listing, "Listing price visibility is wrong at " + contract.width + "px: " + stageDetail);
      }
      assert.equal(stage.ageMarkerPresent, true, "Age marker is missing at " + contract.width + "px: " + stageDetail);
      assert.equal(stage.compactTableMedia, contract.compact, "Compact table media-query state is wrong at " + contract.width + "px: " + stageDetail);
      assert.equal(stage.mobileMedia, contract.mobile, "Mobile device media-query state is wrong at " + contract.width + "px: " + stageDetail);
      if (contract.compact) {
        assert.equal(stage.fullNameNodePresent, true, "Full-name node is missing at " + contract.width + "px.");
        assert.equal(stage.compactNameNodePresent, true, "Compact-name node is missing at " + contract.width + "px.");
      }
      if (contract.mobile) {
        assert.equal(stage.coarsePointer, true, "Mobile pointer is not coarse at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.hoverNone, true, "Mobile hover capability is not none at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.devicePixelRatio, 3, "Mobile DPR is wrong at " + contract.width + "px: " + stageDetail);
      }
      assert.equal(Number.isFinite(stage.ageGapPx), true, "Age/marker gap must resolve to a responsive pixel value at " + contract.width + "px: " + stageDetail);
      assert.ok(Math.abs(stage.ageGapPx - contract.gap) <= 0.08, "Age/marker gap is wrong at " + contract.width + "px: " + stageDetail);
      if (contract.icon) assert.equal(stage.listingIconWidth, contract.icon, "Listing icon width is wrong at " + contract.width + "px: " + stageDetail);
      if (contract.marker) {
        assert.equal(stage.ageMarkerWidth, contract.marker, "Age status marker width is wrong at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.ageMarkerGraphicWidth, contract.marker, "Visible Age status icon drawing width is wrong at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.ageMarkerHeight, contract.marker, "Age status marker must keep a 1:1 width/height proportion at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.ageMarkerInsideCell, true, "Age status marker must stay inside its Age cell at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.ageMarkerMaskFitsBox, true, "Retirement icon mask must fit its responsive marker box at " + contract.width + "px: " + stageDetail);
        assert.equal(stage.ageMarkerMaskSize, "contain", "Retirement icon mask must preserve its intrinsic proportions while scaling at " + contract.width + "px: " + stageDetail);
      }
    });

    return { status: "passed", detail: "responsive table breakpoint passed" };
`;
diagnosticSource = diagnosticSource.replace(runtimeEnableMarker, responsiveProbe);
} else if (mode === "shell-boundary") {
const runtimeEnableMarker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(diagnosticSource.includes(runtimeEnableMarker), "Chrome runtime-enable hook must remain discoverable.");

const shellProbe = String.raw`    await cdp.send("Runtime.enable");

    const shellDeadline = Date.now() + 15_000;
    let shellReady = false;
    while (Date.now() < shellDeadline) {
      const ready = await cdp.send("Runtime.evaluate", {
        expression: 'document.documentElement.dataset.mflRouteReady === "true" && Boolean(document.querySelector(".menuRail")) && Boolean(document.querySelector("#sidebar"))',
        returnByValue: true,
      });
      if (ready?.result?.value === true) {
        shellReady = true;
        break;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    assert.equal(shellReady, true, "Responsive application shell never became ready.");

    const snapshotShell = async (viewportWidth) => {
      await cdp.send("Emulation.setTouchEmulationEnabled", {
        enabled: false,
        maxTouchPoints: 1,
      });
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewportWidth,
        height,
        screenWidth: viewportWidth,
        screenHeight: height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Runtime.evaluate", {
        expression: 'window.dispatchEvent(new Event("resize"));',
      });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 180));

      const evaluation = await cdp.send("Runtime.evaluate", {
        expression: "(() => { const menuRail = document.querySelector('.menuRail'); const sidebar = document.querySelector('#sidebar'); const sidebarGrid = document.querySelector('.sidebarGrid'); const navButton = sidebar?.querySelector('.navButton'); const navIcon = navButton?.querySelector('.navEmoji'); const navText = navButton?.querySelector('.navText'); const stats = document.querySelector('.topbar .stats'); const searchButton = document.querySelector('.topbar .searchButton'); const searchIcon = searchButton?.querySelector('.searchIcon'); const accountButton = document.querySelector('#accountButton'); const accountIcon = accountButton?.querySelector('.accountButtonIcon'); const appShell = document.querySelector('.appShell'); const main = document.querySelector('#appShell > main'); const railStyle = menuRail instanceof HTMLElement ? getComputedStyle(menuRail) : null; const sidebarGridStyle = sidebarGrid instanceof HTMLElement ? getComputedStyle(sidebarGrid) : null; const navButtonStyle = navButton instanceof HTMLElement ? getComputedStyle(navButton) : null; const navTextStyle = navText instanceof HTMLElement ? getComputedStyle(navText) : null; const statsStyle = stats instanceof HTMLElement ? getComputedStyle(stats) : null; const appShellStyle = appShell instanceof HTMLElement ? getComputedStyle(appShell) : null; const mainStyle = main instanceof HTMLElement ? getComputedStyle(main) : null; const rectWidth = (element) => element instanceof Element ? Math.round(element.getBoundingClientRect().width) : 0; const rectHeight = (element) => element instanceof Element ? Math.round(element.getBoundingClientRect().height) : 0; const cssNumber = (value) => { const parsed = Number.parseFloat(String(value || '')); return Number.isFinite(parsed) ? parsed : 0; }; return { width: window.innerWidth, railPosition: railStyle?.position || '', railBottom: railStyle?.bottom || '', railWidth: rectWidth(menuRail), railHeight: rectHeight(menuRail), sidebarGridDisplay: sidebarGridStyle?.display || '', navButtonDisplay: navButtonStyle?.display || '', navButtonHeight: rectHeight(navButton), navIconWidth: rectWidth(navIcon), navTextFontSize: navTextStyle?.fontSize || '', statsDisplay: statsStyle?.display || '', searchWidth: rectWidth(searchButton), searchHeight: rectHeight(searchButton), searchIconWidth: rectWidth(searchIcon), accountWidth: rectWidth(accountButton), accountHeight: rectHeight(accountButton), accountIconWidth: rectWidth(accountIcon), sidebarOffset: appShellStyle?.getPropertyValue('--sidebar-offset').trim() || '', pinnedSidebarWidth: getComputedStyle(document.documentElement).getPropertyValue('--pinned-sidebar-width').trim(), mainMarginLeft: mainStyle?.marginLeft || '', mainPaddingBottom: cssNumber(mainStyle?.paddingBottom), mobileNavHeight: getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-height').trim(), compactShellMedia: matchMedia('(max-width: 1366px)').matches, legacyMobileMedia: matchMedia('(max-width: 900px)').matches }; })()",
        returnByValue: true,
      });
      return evaluation?.result?.value || {};
    };

    const stages = [];
    for (const viewportWidth of [1367, 1366, 1200, 1041, 901, 900, 1367]) {
      stages.push(await snapshotShell(viewportWidth));
    }

    const expected = [
      { width: 1367, compact: false },
      { width: 1366, compact: true, navIcon: 17, searchIcon: 16, accountIcon: 17 },
      { width: 1200, compact: true, navIcon: 17, searchIcon: 16, accountIcon: 17 },
      { width: 1041, compact: true, navIcon: 16, searchIcon: 16, accountIcon: 17 },
      { width: 901, compact: true, navIcon: 16, searchIcon: 15, accountIcon: 16 },
      { width: 900, compact: true, navIcon: 16, searchIcon: 15, accountIcon: 16 },
      { width: 1367, compact: false },
    ];

    stages.forEach((stage, index) => {
      const contract = expected[index];
      const detail = JSON.stringify(stage);
      assert.equal(stage.width, contract.width, "Shell viewport width is wrong at " + contract.width + "px: " + detail);
      assert.equal(stage.compactShellMedia, contract.compact, "Compact-shell media state is wrong at " + contract.width + "px: " + detail);
      if (contract.compact) {
        assert.equal(stage.railPosition, "absolute", "Bottom navigation rail must replace the fixed sidebar at " + contract.width + "px: " + detail);
        assert.equal(stage.railBottom, "8px", "Bottom navigation rail offset is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.railHeight, 58, "Bottom navigation rail height is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.sidebarGridDisplay, "contents", "Sidebar grid must flatten into the bottom rail at " + contract.width + "px: " + detail);
        assert.equal(stage.navButtonDisplay, "flex", "Bottom navigation buttons must use compact flex geometry at " + contract.width + "px: " + detail);
        assert.equal(stage.navButtonHeight, 48, "Bottom navigation button height is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.navIconWidth, contract.navIcon, "Bottom navigation icon must follow the continuous small-to-large scale at " + contract.width + "px: " + detail);
        assert.equal(stage.navTextFontSize, "9px", "Bottom navigation label size is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.statsDisplay, "none", "Header stats must be hidden in compact shell at " + contract.width + "px: " + detail);
        assert.equal(stage.searchWidth, 44, "Compact search control width is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.searchHeight, 44, "Compact search control height is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.searchIconWidth, contract.searchIcon, "Compact search icon must follow the continuous small-to-large scale at " + contract.width + "px: " + detail);
        assert.equal(stage.accountWidth, 44, "Compact account control width is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.accountHeight, 44, "Compact account control height is wrong at " + contract.width + "px: " + detail);
        assert.equal(stage.accountIconWidth, contract.accountIcon, "Compact account icon must follow the continuous small-to-large scale at " + contract.width + "px: " + detail);
        assert.equal(stage.sidebarOffset, "0px", "Compact shell sidebar offset must be zero at " + contract.width + "px: " + detail);
        assert.equal(stage.pinnedSidebarWidth, "0px", "Pinned sidebar width must collapse at " + contract.width + "px: " + detail);
        assert.equal(stage.mainMarginLeft, "0px", "Main content must not reserve desktop sidebar space at " + contract.width + "px: " + detail);
        assert.ok(stage.mainPaddingBottom >= 76, "Main content must reserve bottom-navigation clearance at " + contract.width + "px: " + detail);
        assert.equal(stage.mobileNavHeight, "58px", "Mobile navigation height token is wrong at " + contract.width + "px: " + detail);
      } else {
        assert.equal(stage.railPosition, "fixed", "Desktop sidebar must return at " + contract.width + "px: " + detail);
        assert.equal(stage.sidebarGridDisplay, "grid", "Desktop sidebar grid must return at " + contract.width + "px: " + detail);
        assert.equal(stage.navButtonDisplay, "grid", "Desktop navigation button geometry must return at " + contract.width + "px: " + detail);
        assert.notEqual(stage.statsDisplay, "none", "Header stats must return above compact shell at " + contract.width + "px: " + detail);
        assert.ok(stage.railWidth < 300, "Desktop navigation rail must not retain bottom-rail width at " + contract.width + "px: " + detail);
        assert.ok(stage.searchWidth > 44, "Desktop search control must restore above compact shell at " + contract.width + "px: " + detail);
        assert.ok(stage.accountWidth > 44, "Desktop account control must restore above compact shell at " + contract.width + "px: " + detail);
        assert.notEqual(stage.pinnedSidebarWidth, "0px", "Desktop pinned sidebar width must restore at " + contract.width + "px: " + detail);
        assert.ok(stage.mainPaddingBottom < 76, "Desktop main content must release bottom-navigation clearance at " + contract.width + "px: " + detail);
      }
    });

    return { status: "passed", detail: "responsive shell breakpoint passed" };
`;

diagnosticSource = diagnosticSource.replace(runtimeEnableMarker, shellProbe);
} else if (mode === "intermediate") {
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
      const expectedMarkerWidth = ({ 1366: 12, 1200: 11, 1041: 11, 901: 10 })[viewportWidth];
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
      const headerDiagnostics = {
        viewportWidth,
        compactMedia: window.matchMedia("(max-width: 1366px)").matches,
        positions: headerLabel("positions"),
        seasons: headerLabel("player_seasons"),
        overall: headerLabel("overall"),
        positionsData: (() => {
          const label = document.querySelector('#tableHead th[data-table-column="positions"] [data-mfl-full-table-label][data-mfl-compact-table-label]');
          return label instanceof HTMLElement ? {
            full: label.dataset.mflFullTableLabel || "",
            compact: label.dataset.mflCompactTableLabel || "",
          } : null;
        })(),
        routeReady: document.documentElement.dataset.mflRouteReady || "",
      };
      assert(headerLabel("positions") === "Positions", "Positions header must restore its full label at 1367px: " + JSON.stringify(headerDiagnostics));
      assert(headerLabel("player_seasons") === "Seasons", "Seasons header must restore its full label at 1367px: " + JSON.stringify(headerDiagnostics));
      assert(headerLabel("overall") === "Overall", "Overall header must restore its full label at 1367px: " + JSON.stringify(headerDiagnostics));
    }
`;

diagnosticSource = diagnosticSource.replace(geometryMarker, geometryProbe);
} else if (mode === "long-mobile-table") {
  const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
  assert.ok(diagnosticSource.includes(marker), "Chrome runtime-enable hook must remain discoverable.");
  const probe = "    await cdp.send(\"Runtime.enable\");\n\n    const readyDeadline = Date.now() + 15_000;\n    let ready = false;\n    while (Date.now() < readyDeadline) {\n      const value = await cdp.send(\"Runtime.evaluate\", {\n        expression: 'document.documentElement.dataset.mflRouteReady === \"true\" && Boolean(document.querySelector(\"#tableBody tr[data-player-id=\\\\\\\"1\\\\\\\"]\"))',\n        returnByValue: true,\n      });\n      if (value?.result?.value === true) { ready = true; break; }\n      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));\n    }\n    assert.equal(ready, true, \"Long mobile table Database fixture never became ready.\");\n\n    const seeded = await cdp.send(\"Runtime.evaluate\", {\n      expression: `(() => {\n        const body = document.getElementById(\"tableBody\");\n        const original = body?.querySelector(\"tr[data-player-id=\\\\\\\"1\\\\\\\"]\");\n        if (!(body instanceof HTMLTableSectionElement) || !(original instanceof HTMLTableRowElement)) return null;\n        for (let index = 2; index <= 100; index += 1) {\n          const clone = original.cloneNode(true);\n          clone.dataset.playerId = String(index);\n          clone.querySelectorAll(\"[id]\").forEach((node) => node.removeAttribute(\"id\"));\n          const name = clone.querySelector(\".playerNameFullValue, .playerNameCompactValue, .playerNameLink\");\n          if (name instanceof HTMLElement) name.textContent = \"Player \" + index;\n          body.appendChild(clone);\n        }\n        const scroller = document.querySelector(\"#progressionPage .playerTableScroller\");\n        const shell = document.querySelector(\"#progressionPage .tableShell\");\n        const nameCell = original.querySelector(\"td.col-name, td:has(> .playerNameCell)\");\n        const preceding = document.querySelector(\"#tableHead th.col-name\")?.previousElementSibling;\n        return {\n          rows: body.rows.length,\n          tableHeight: Math.round(body.getBoundingClientRect().height),\n          clientWidth: scroller?.clientWidth || 0,\n          scrollWidth: scroller?.scrollWidth || 0,\n          nameCell: nameCell instanceof HTMLElement,\n          preceding: preceding instanceof HTMLElement,\n          shell: shell instanceof HTMLElement,\n        };\n      })()`,\n      returnByValue: true,\n    });\n    const seededValue = seeded?.result?.value;\n    assert.equal(seededValue?.rows, 100, \"Long mobile table must exercise exactly 100 rendered rows.\");\n    assert.ok(seededValue?.tableHeight > 2500, \"Long mobile table long table did not create meaningful vertical length.\");\n    assert.ok(seededValue?.scrollWidth > seededValue?.clientWidth, \"Long mobile table mobile table must expose local horizontal scrolling.\");\n    assert.equal(seededValue?.nameCell, true, \"Long mobile table sticky Name cell is missing.\");\n    assert.equal(seededValue?.preceding, true, \"Long mobile table Name boundary header is missing.\");\n    assert.equal(seededValue?.shell, true, \"Long mobile table table shell is missing.\");\n    // Give the real hydration/width observer one quiet paint after seeding 100 rows.\n    await new Promise((done) => setTimeout(done, 500));\n\n    const snapshot = async (position) => {\n      const result = await cdp.send(\"Runtime.evaluate\", {\n        expression: `((position) => {\n          const scroller = document.querySelector(\"#progressionPage .playerTableScroller\");\n          const shell = document.querySelector(\"#progressionPage .tableShell\");\n          const nameCell = document.querySelector(\"#tableBody tr[data-player-id=\\\\\\\"1\\\\\\\"] td.col-name, #tableBody tr[data-player-id=\\\\\\\"1\\\\\\\"] td:has(> .playerNameCell)\");\n          const preceding = document.querySelector(\"#tableHead th.col-name\")?.previousElementSibling;\n          if (!(scroller instanceof HTMLElement) || !(shell instanceof HTMLElement) || !(nameCell instanceof HTMLElement) || !(preceding instanceof HTMLElement)) return null;\n          const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);\n          scroller.style.scrollBehavior = \"auto\";\n          scroller.scrollTo({ left: position === \"start\" ? 0 : position === \"end\" ? max : Math.round(max / 2), behavior: \"instant\" });\n          scroller.dispatchEvent(new Event(\"scroll\"));\n          return new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => {\n            const edge = scroller.getBoundingClientRect().left + scroller.clientLeft;\n            resolve({\n              left: scroller.scrollLeft,\n              max,\n              canLeft: shell.classList.contains(\"mflPlayerTableCanScrollLeft\"),\n              canRight: shell.classList.contains(\"mflPlayerTableCanScrollRight\"),\n              stuck: scroller.classList.contains(\"mflPlayerTableNameStuck\"),\n              nameLeft: Math.round(nameCell.getBoundingClientRect().left),\n              edge: Math.round(edge),\n              precedingRight: Math.round(preceding.getBoundingClientRect().right),\n            });\n          })), 100));\n        })(${JSON.stringify(position)})`,\n        awaitPromise: true,\n        returnByValue: true,\n      });\n      if (result?.exceptionDetails) throw new Error(\"Long mobile table scroll snapshot browser exception: \" + JSON.stringify(result.exceptionDetails));\n      return result?.result?.value;\n    };\n\n    const start = await snapshot(\"start\");\n    const middle = await snapshot(\"middle\");\n    const end = await snapshot(\"end\");\n    console.log(\"RESP02-SNAPSHOTS\", JSON.stringify({ start,middle,end }));\n    assert.equal(start?.canLeft, false, \"Long mobile table left fade must be hidden at scroll start.\");\n    assert.equal(start?.canRight, true, \"Long mobile table right fade must advertise more columns at scroll start.\");\n    assert.equal(middle?.canLeft, true, \"Long mobile table left fade must appear after horizontal scrolling.\");\n    assert.equal(middle?.canRight, true, \"Long mobile table right fade must remain while more columns exist.\");\n    assert.equal(end?.canLeft, true, \"Long mobile table left fade must remain at the far edge.\");\n    assert.equal(end?.canRight, false, \"Long mobile table right fade must disappear at the far edge.\");\n    assert.equal(end?.stuck, true, \"Long mobile table Name column must become sticky after crossing its natural edge.\");\n    assert.ok(Math.abs((end?.nameLeft || 0) - (end?.edge || 0)) <= 1, \"Long mobile table sticky Name column is not pinned to the mobile scroller edge.\");\n\n    const sortResult = await cdp.send(\"Runtime.evaluate\", {\n      expression: `(async () => {\n        const scroller = document.querySelector(\"#progressionPage .playerTableScroller\");\n        const button = document.querySelector('#tableHead th[data-table-column=\"overall\"] > .tableSortButton');\n        if (!(scroller instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return null;\n        button.scrollIntoView({ block: \"nearest\", inline: \"center\" });\n        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n        const rect = button.getBoundingClientRect();\n        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);\n        const beforePath = location.pathname;\n        const initialSort = button.closest(\"th\")?.getAttribute(\"aria-sort\") || \"\";\n        button.click();\n        const deadline = performance.now() + 5000;\n        while (performance.now() < deadline) {\n          const header = document.querySelector('#tableHead th[data-table-column=\"overall\"]');\n          if (header?.getAttribute(\"aria-sort\") && header?.getAttribute(\"aria-sort\") !== initialSort) break;\n          await new Promise((resolve) => setTimeout(resolve, 25));\n        }\n        const header = document.querySelector('#tableHead th[data-table-column=\"overall\"]');\n        return {\n          hit: hit instanceof Element && (hit === button || button.contains(hit)),\n          ariaSort: header?.getAttribute(\"aria-sort\") || \"\",\n          initialSort,\n          pathStable: beforePath === location.pathname,\n          rows: document.querySelectorAll(\"#tableBody tr\").length,\n        };\n      })()`,\n      awaitPromise: true,\n      returnByValue: true,\n    });\n    const sortValue = sortResult?.result?.value;\n    assert.equal(sortValue?.hit, true, \"Long mobile table mobile sort control is visually exposed but not hit-testable.\");\n    assert.ok([\"ascending\", \"descending\"].includes(sortValue?.ariaSort) && sortValue?.ariaSort !== sortValue?.initialSort, \"Long mobile table tap/click sort did not update Overall aria-sort.\");\n    assert.equal(sortValue?.pathStable, true, \"Long mobile table sorting caused accidental navigation.\");\n    assert.ok((sortValue?.rows || 0) > 0, \"Long mobile table sorting unexpectedly emptied the table.\");\n\n    return { status: \"passed\", detail: \"Long mobile table 100-row mobile table interaction matrix passed\" };\n";
  diagnosticSource = diagnosticSource.replace(marker, probe);
} else if (mode === "sticky-name-theme") {
  const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
  assert.ok(diagnosticSource.includes(marker), "Canonical CDP browser hook must be available.");
const expression = "(async () => {\n  const deadline = performance.now() + 15000;\n  let row;\n  while (performance.now() < deadline) {\n    row = document.querySelector('#tableBody tr[data-player-id=\"1\"]');\n    if (document.documentElement.dataset.mflRouteReady === 'true' && row instanceof HTMLTableRowElement) break;\n    await new Promise(resolve => setTimeout(resolve, 50));\n  }\n  const scroller = document.querySelector('#progressionPage .playerTableScroller');\n  const shell = document.querySelector('#progressionPage .tableShell');\n  const name = row?.querySelector('td.col-name, td:has(> .playerNameCell)');\n  const header = document.querySelector('#tableHead th.col-name');\n  if (!(row instanceof HTMLTableRowElement) || !(scroller instanceof HTMLElement)\n    || !(shell instanceof HTMLElement) || !(name instanceof HTMLTableCellElement)\n    || !(header instanceof HTMLTableCellElement)) return { error: 'Missing hydrated Database sticky Name fixture' };\n  const savedTheme = document.documentElement.getAttribute('data-theme');\n  const originalScroll = scroller.scrollLeft;\n  const originalScrollBehavior = scroller.style.scrollBehavior;\n  scroller.style.scrollBehavior = 'auto';\n  // The app's first route-ready paint may still schedule its own scroller measurement.\n  await new Promise(resolve => setTimeout(resolve, 400));\n  const reports = [];\n  try {\n    for (const theme of ['light', 'dark']) {\n      document.documentElement.dataset.theme = theme;\n      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n      const max = scroller.scrollWidth - scroller.clientWidth;\n      for (const position of ['start', 'middle', 'end']) {\n        row.classList.remove('tableRowHovered');\n        const left = position === 'start' ? 0 : position === 'end' ? max : Math.round(max / 2);\n        scroller.scrollTo({ left, behavior: 'instant' });\n        scroller.dispatchEvent(new Event('scroll'));\n        // Wait for actual layout/scroll-state convergence, not just the requested target.\n        // On first light-theme paint CDP can observe the previous frame's scrollLeft.\n        const deadline = performance.now() + 1800;\n        while (performance.now() < deadline) {\n          await new Promise(resolve => setTimeout(resolve, 65));\n          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n          const actual = scroller.scrollLeft;\n          const fadeReady = position === 'start'\n            ? !shell.classList.contains('mflPlayerTableCanScrollLeft')\n            : shell.classList.contains('mflPlayerTableCanScrollLeft');\n          if (Math.abs(actual - left) <= 1 && fadeReady) break;\n          scroller.scrollTo({ left, behavior: 'instant' });\n          scroller.dispatchEvent(new Event('scroll'));\n        }\n        const normal = getComputedStyle(name);\n        const edge = scroller.getBoundingClientRect().left + scroller.clientLeft;\n        const snapshot = {\n          theme, position, max, scrollLeft: scroller.scrollLeft,\n          sticky: normal.position, inset: normal.left, zIndex: normal.zIndex,\n          isolation: normal.isolation, clip: normal.backgroundClip, color: normal.backgroundColor,\n          image: normal.backgroundImage,\n          stuck: scroller.classList.contains('mflPlayerTableNameStuck'),\n          canLeft: shell.classList.contains('mflPlayerTableCanScrollLeft'),\n          canRight: shell.classList.contains('mflPlayerTableCanScrollRight'),\n          nameLeft: name.getBoundingClientRect().left, edge,\n          separator: getComputedStyle(name.querySelector('.playerNameCell'), '::before').borderRightStyle,\n        };\n        row.classList.add('tableRowHovered');\n        await new Promise(resolve => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 120));\n        const hovered = getComputedStyle(name);\n        snapshot.hoverColor = hovered.backgroundColor;\n        snapshot.hoverImage = hovered.backgroundImage;\n        const expectedHover = document.createElement('span');\n        expectedHover.style.backgroundColor = 'var(--mfl-table-row-hover-background)';\n        name.appendChild(expectedHover);\n        snapshot.hoverExpectedColor = getComputedStyle(expectedHover).backgroundColor;\n        expectedHover.remove();\n        row.classList.remove('tableRowHovered');\n        reports.push(snapshot);\n      }\n    }\n  } finally {\n    row.classList.remove('tableRowHovered');\n    if (savedTheme === null) document.documentElement.removeAttribute('data-theme');\n    else document.documentElement.setAttribute('data-theme', savedTheme);\n    scroller.scrollTo({ left: originalScroll, behavior: 'instant' });\n    scroller.style.scrollBehavior = originalScrollBehavior;\n    scroller.dispatchEvent(new Event('scroll'));\n  }\n  return { reports };\n})()";
const injection = `    await cdp.send("Runtime.enable");
    // The canonical Database fixture first completes both direct and cached SPA return.
    // Probe only afterward to avoid racing route navigation / CDP context destruction.
    const baseline = await waitForBrowserRegression(cdp);
    const value = await cdp.send("Runtime.evaluate", {
      expression: ${JSON.stringify(expression)},
      awaitPromise: true,
      returnByValue: true,
    });
    if (value.exceptionDetails) throw new Error("Sticky Name theme browser exception: " + JSON.stringify(value.exceptionDetails));
    const result = value.result?.value;
    assert.ok(result && !result.error, "Sticky Name theme fixture: " + JSON.stringify(result));
    console.log("STICKY_NAME_THEME-THEME-SCROLL-SNAPSHOTS", JSON.stringify(result));
    assert.equal(result.reports?.length, 6, "Expected three scroll boundaries per light/dark theme.");
    for (const sample of result.reports) {
      const label = sample.theme + " / " + sample.position;
      assert.ok(sample.max > 0, label + ": horizontal table overflow is missing");
      assert.equal(sample.sticky, "sticky", label + ": Name must stay sticky");
      assert.equal(sample.inset, "0px", label + ": sticky Name must stay pinned at inset zero");
      assert.equal(sample.zIndex, "5", label + ": Name body stacking order changed");
      assert.equal(sample.isolation, "isolate", label + ": Name opacity isolation changed");
      assert.equal(sample.clip, "border-box", label + ": Name paint clipping changed");
      assert.ok(sample.color.startsWith("rgb("), label + ": Name background must be opaque computed RGB");
      assert.equal(sample.image, "none", label + ": PERF-02B gradient layers returned");
      assert.ok(sample.hoverColor.startsWith("rgb("), label + ": hovered Name background must be opaque");
      assert.equal(sample.hoverColor, sample.hoverExpectedColor, label + ": hovered Name must match the inherited canonical hover token");
      if (sample.position === "start") {
        assert.equal(sample.canLeft, false, label + ": left fade should be hidden");
        assert.equal(sample.canRight, true, label + ": right fade should show overflow");
      } else if (sample.position === "middle") {
        assert.equal(sample.canLeft, true, label + ": left fade should be shown");
        assert.equal(sample.canRight, true, label + ": right fade should show overflow");
      } else {
        assert.equal(sample.canLeft, true, label + ": left fade should persist");
        assert.equal(sample.canRight, false, label + ": right fade should end");
        assert.equal(sample.stuck, true, label + ": Name stuck class missing");
        assert.ok(Math.abs(sample.nameLeft - sample.edge) <= 1, label + ": Name is not pinned");
        assert.equal(sample.separator, "solid", label + ": sticky Name separator is not visible");
      }
    }
    const light = result.reports.find(x => x.theme === "light" && x.position === "start");
    const dark = result.reports.find(x => x.theme === "dark" && x.position === "start");
    assert.notEqual(light.color, dark.color, "Light and dark Name surfaces must differ");
    console.log("Sticky Name theme browser opaque sticky Name / themes / scroll boundaries", JSON.stringify(result));
    return baseline;
`;
  diagnosticSource = diagnosticSource.replace(marker, injection);
}

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(scenariosPattern, spec.scenarios);

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
  assert.equal(status, 0, spec.failure);
} finally {
  await rm(temporaryPath, { force: true });
}

console.log(spec.success);
