import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Sticky Name theme: CDP computed-style and scroll-boundary regression against the real
// production browser fixture. Does not change product CSS or persist theme state.
const directory = dirname(fileURLToPath(import.meta.url));
const original = await readFile(resolve(directory, "browser-routing-regression.mjs"), "utf8");
const temporary = resolve(directory, ".browser-sticky-name-theme-sticky-theme.tmp.mjs");
const hook = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(original.includes(hook), "Canonical CDP browser hook must be available.");
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
const scenarios = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(original, scenarios, "Browser fixture scenario list changed.");
let transformed = original.replace(hook, injection);
transformed = transformed.replace(scenarios, 'const regressionScenarios = Object.freeze([["sticky-name-theme-sticky-themes", "/database/attributes", 390, 844]]);\n\nconst server =');
await writeFile(temporary, transformed);
try {
  const code = await new Promise((resolveCode, reject) => {
    const child = spawn(process.execPath, [temporary], {cwd: resolve(directory, ".."), stdio: "inherit"});
    child.once("error", reject);
    child.once("close", resolveCode);
  });
  assert.equal(code, 0, "Sticky Name theme sticky Name browser regression failed.");
} finally {
  await rm(temporary, {force: true});
}
console.log("Sticky Name theme sticky Name themes and scroll boundaries passed.");
