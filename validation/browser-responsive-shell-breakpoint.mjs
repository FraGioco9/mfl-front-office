import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-responsive-shell-breakpoint.tmp.mjs");
const source = await readFile(sourcePath, "utf8");
let diagnosticSource = source;

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

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1367, 900]]);\n\nconst server =',
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
  assert.equal(status, 0, "Responsive shell breakpoint browser regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Responsive shell breakpoint browser regression passed through the 1366px compact boundary.");
