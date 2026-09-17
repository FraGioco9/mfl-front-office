import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-mobile-table-responsive-resize.tmp.mjs");
const source = await readFile(sourcePath, "utf8");
let diagnosticSource = source;

for (const [from, to, label] of [
  ['  name: "Browser Player",', '  name: "Nicolò Barella",', "fixture player name"],
  ["  listing_price: null,", "  listing_price: 10000,", "fixture Listing price"],
  ['  const expectedPlayerName = "Browser Player";', '  const expectedPlayerName = "Nicolò Barella";', "browser expected player name"],
]) {
  assert.ok(diagnosticSource.includes(from), `${label} hook must remain discoverable.`);
  diagnosticSource = diagnosticSource.replace(from, to);
}

const runtimeEnableMarker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(diagnosticSource.includes(runtimeEnableMarker), "Chrome runtime-enable hook must remain discoverable.");
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

    const snapshotResponsiveTable = async (viewportWidth) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewportWidth,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Runtime.evaluate", {
        expression: 'window.dispatchEvent(new Event("resize"));',
      });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
      const evaluation = await cdp.send("Runtime.evaluate", {
        expression: "(() => { const row = document.querySelector('#tableBody tr[data-player-id=\\\"1\\\"]'); if (!(row instanceof HTMLTableRowElement)) return { missing: 'row', width: window.innerWidth }; const visibleText = (element) => { if (!(element instanceof HTMLElement)) return ''; const style = getComputedStyle(element); return style.display === 'none' || style.visibility === 'hidden' || element.getClientRects().length === 0 ? '' : String(element.textContent || '').trim(); }; const nameLink = row.querySelector('.playerNameLink'); const fullNameValue = row.querySelector('.playerNameFullValue'); const compactNameValue = row.querySelector('.playerNameCompactValue'); const renderedName = visibleText(fullNameValue) || visibleText(compactNameValue) || visibleText(nameLink); const listingPrice = row.querySelector('td.col-listing .listingCellPrice'); const listingIcon = row.querySelector('td.col-listing .listingCellIcon'); const listingPricePresent = listingPrice instanceof HTMLElement; const listingPriceVisible = listingPricePresent && getComputedStyle(listingPrice).display !== 'none' && getComputedStyle(listingPrice).visibility !== 'hidden' && listingPrice.getClientRects().length > 0; const ageHost = row.querySelector('td.col-age .tableControlCellContent'); const ageStyle = ageHost instanceof HTMLElement ? getComputedStyle(ageHost) : null; const ageGap = ageStyle ? String(ageStyle.columnGap || ageStyle.gap || '') : ''; const iconWidth = listingIcon instanceof HTMLElement ? Math.round(listingIcon.getBoundingClientRect().width) : 0; return { width: window.innerWidth, sameRow: row === window.__mflResponsiveResizeOriginalRow, renderedName, fullNameNodePresent: fullNameValue instanceof HTMLElement, compactNameNodePresent: compactNameValue instanceof HTMLElement, listingPricePresent, listingPriceVisible, listingIconWidth: iconWidth, ageGap, mobileMedia: matchMedia('(max-width: 900px)').matches }; })()",
        returnByValue: true,
      });
      return evaluation?.result?.value || {};
    };

    const stages = [];
    for (const viewportWidth of [900, 1100, 900, 700, 520, 380, 1100]) {
      stages.push(await snapshotResponsiveTable(viewportWidth));
    }

    const expected = [
      { width: 900, name: "N. Barella", listing: false, gap: "3px", icon: 9 },
      { width: 1100, name: "Nicolò Barella", listing: true, gap: null, icon: null },
      { width: 900, name: "N. Barella", listing: false, gap: "3px", icon: 9 },
      { width: 700, name: "N. Barella", listing: false, gap: "2px", icon: 9 },
      { width: 520, name: "N. Barella", listing: false, gap: "2px", icon: 7 },
      { width: 380, name: "N. Barella", listing: false, gap: "1px", icon: 6 },
      { width: 1100, name: "Nicolò Barella", listing: true, gap: null, icon: null },
    ];

    stages.forEach((stage, index) => {
      const contract = expected[index];
      assert.equal(stage.sameRow, true, `Database row was replaced at ${contract.width}px: ${JSON.stringify(stage)}`);
      assert.equal(stage.renderedName, contract.name, `Player name did not follow responsive contract at ${contract.width}px: ${JSON.stringify(stage)}`);
      assert.equal(stage.listingPricePresent, true, `Listing price must stay in breakpoint-neutral DOM at ${contract.width}px: ${JSON.stringify(stage)}`);
      assert.equal(stage.listingPriceVisible, contract.listing, `Listing price visibility is wrong at ${contract.width}px: ${JSON.stringify(stage)}`);
      assert.equal(stage.mobileMedia, contract.width <= 900, `Mobile media-query state is wrong at ${contract.width}px: ${JSON.stringify(stage)}`);
      if (contract.width <= 900) {
        assert.equal(stage.fullNameNodePresent, true, `Full-name node is missing at ${contract.width}px.`);
        assert.equal(stage.compactNameNodePresent, true, `Compact-name node is missing at ${contract.width}px.`);
      }
      if (contract.gap) assert.equal(stage.ageGap, contract.gap, `Age/marker gap is wrong at ${contract.width}px: ${JSON.stringify(stage)}`);
      if (contract.icon) assert.equal(stage.listingIconWidth, contract.icon, `Listing icon width is wrong at ${contract.width}px: ${JSON.stringify(stage)}`);
    });

    return await waitForBrowserRegression(cdp);
`;
diagnosticSource = diagnosticSource.replace(runtimeEnableMarker, responsiveProbe);

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database", "/database/attributes", 900, 900]]);\n\nconst server =',
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
  assert.equal(status, 0, "Mobile table responsive resize browser regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Mobile table responsive resize browser regression passed.");
