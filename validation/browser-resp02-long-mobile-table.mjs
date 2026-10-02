import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-resp02-long-mobile-table.tmp.mjs");
let source = await readFile(sourcePath, "utf8");

const runtimeEnableMarker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(source.includes(runtimeEnableMarker), "Chrome runtime-enable hook must remain discoverable.");

const probe = String.raw`    await cdp.send("Runtime.enable");

    const readyDeadline = Date.now() + 15_000;
    let ready = false;
    while (Date.now() < readyDeadline) {
      const value = await cdp.send("Runtime.evaluate", {
        expression: 'document.documentElement.dataset.mflRouteReady === "true" && Boolean(document.querySelector("#tableBody tr[data-player-id=\\\"1\\\"]"))',
        returnByValue: true,
      });
      if (value?.result?.value === true) { ready = true; break; }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    assert.equal(ready, true, "RESP-02 Database fixture never became ready.");

    const seeded = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const body = document.getElementById("tableBody");
        const original = body?.querySelector("tr[data-player-id=\\\"1\\\"]");
        if (!(body instanceof HTMLTableSectionElement) || !(original instanceof HTMLTableRowElement)) return null;
        for (let index = 2; index <= 100; index += 1) {
          const clone = original.cloneNode(true);
          clone.dataset.playerId = String(index);
          clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
          const name = clone.querySelector(".playerNameFullValue, .playerNameCompactValue, .playerNameLink");
          if (name instanceof HTMLElement) name.textContent = "Player " + index;
          body.appendChild(clone);
        }
        const scroller = document.querySelector("#progressionPage .playerTableScroller");
        const shell = document.querySelector("#progressionPage .tableShell");
        const nameCell = original.querySelector("td.col-name, td:has(> .playerNameCell)");
        const preceding = document.querySelector("#tableHead th.col-name")?.previousElementSibling;
        return {
          rows: body.rows.length,
          tableHeight: Math.round(body.getBoundingClientRect().height),
          clientWidth: scroller?.clientWidth || 0,
          scrollWidth: scroller?.scrollWidth || 0,
          nameCell: nameCell instanceof HTMLElement,
          preceding: preceding instanceof HTMLElement,
          shell: shell instanceof HTMLElement,
        };
      })()`,
      returnByValue: true,
    });
    const seededValue = seeded?.result?.value;
    assert.equal(seededValue?.rows, 100, "RESP-02 must exercise exactly 100 rendered rows.");
    assert.ok(seededValue?.tableHeight > 2500, "RESP-02 long table did not create meaningful vertical length.");
    assert.ok(seededValue?.scrollWidth > seededValue?.clientWidth, "RESP-02 mobile table must expose local horizontal scrolling.");
    assert.equal(seededValue?.nameCell, true, "RESP-02 sticky Name cell is missing.");
    assert.equal(seededValue?.preceding, true, "RESP-02 Name boundary header is missing.");
    assert.equal(seededValue?.shell, true, "RESP-02 table shell is missing.");

    const snapshot = async (position) => {
      const result = await cdp.send("Runtime.evaluate", {
        expression: `(() => {
          const scroller = document.querySelector("#progressionPage .playerTableScroller");
          const shell = document.querySelector("#progressionPage .tableShell");
          const nameCell = document.querySelector("#tableBody tr[data-player-id=\\\"1\\\"] td.col-name, #tableBody tr[data-player-id=\\\"1\\\"] td:has(> .playerNameCell)");
          const preceding = document.querySelector("#tableHead th.col-name")?.previousElementSibling;
          if (!(scroller instanceof HTMLElement) || !(shell instanceof HTMLElement) || !(nameCell instanceof HTMLElement) || !(preceding instanceof HTMLElement)) return null;
          const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
          scroller.scrollLeft = position === "start" ? 0 : position === "end" ? max : Math.round(max / 2);
          scroller.dispatchEvent(new Event("scroll"));
          return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
            const edge = scroller.getBoundingClientRect().left + scroller.clientLeft;
            resolve({
              left: scroller.scrollLeft,
              max,
              canLeft: shell.classList.contains("mflPlayerTableCanScrollLeft"),
              canRight: shell.classList.contains("mflPlayerTableCanScrollRight"),
              stuck: scroller.classList.contains("mflPlayerTableNameStuck"),
              nameLeft: Math.round(nameCell.getBoundingClientRect().left),
              edge: Math.round(edge),
              precedingRight: Math.round(preceding.getBoundingClientRect().right),
            });
          })));
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      return result?.result?.value;
    };

    const start = await snapshot("start");
    const middle = await snapshot("middle");
    const end = await snapshot("end");
    assert.equal(start?.canLeft, false, "RESP-02 left fade must be hidden at scroll start.");
    assert.equal(start?.canRight, true, "RESP-02 right fade must advertise more columns at scroll start.");
    assert.equal(middle?.canLeft, true, "RESP-02 left fade must appear after horizontal scrolling.");
    assert.equal(middle?.canRight, true, "RESP-02 right fade must remain while more columns exist.");
    assert.equal(end?.canLeft, true, "RESP-02 left fade must remain at the far edge.");
    assert.equal(end?.canRight, false, "RESP-02 right fade must disappear at the far edge.");
    assert.equal(end?.stuck, true, "RESP-02 Name column must become sticky after crossing its natural edge.");
    assert.ok(Math.abs((end?.nameLeft || 0) - (end?.edge || 0)) <= 1, "RESP-02 sticky Name column is not pinned to the mobile scroller edge.");

    const sortResult = await cdp.send("Runtime.evaluate", {
      expression: `(async () => {
        const scroller = document.querySelector("#progressionPage .playerTableScroller");
        const button = document.querySelector('#tableHead th[data-table-column="overall"] > .tableSortButton');
        if (!(scroller instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return null;
        button.scrollIntoView({ block: "nearest", inline: "center" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const beforePath = location.pathname + location.search;
        button.click();
        const deadline = performance.now() + 5000;
        while (performance.now() < deadline) {
          const header = document.querySelector('#tableHead th[data-table-column="overall"]');
          if (header?.getAttribute("aria-sort") === "descending") break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const header = document.querySelector('#tableHead th[data-table-column="overall"]');
        return {
          hit: hit instanceof Element && (hit === button || button.contains(hit)),
          ariaSort: header?.getAttribute("aria-sort") || "",
          pathStable: beforePath === location.pathname + location.search,
          rows: document.querySelectorAll("#tableBody tr").length,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const sortValue = sortResult?.result?.value;
    assert.equal(sortValue?.hit, true, "RESP-02 mobile sort control is visually exposed but not hit-testable.");
    assert.equal(sortValue?.ariaSort, "descending", "RESP-02 tap/click sort did not commit Overall descending.");
    assert.equal(sortValue?.pathStable, true, "RESP-02 sorting caused accidental navigation.");
    assert.ok((sortValue?.rows || 0) > 0, "RESP-02 sorting unexpectedly emptied the table.");

    return { status: "passed", detail: "RESP-02 100-row mobile table interaction matrix passed" };
`;

source = source.replace(runtimeEnableMarker, probe);
const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(source, scenariosPattern, "Browser regression scenario list must remain discoverable.");
source = source.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["resp02-long-mobile-table", "/database/attributes#resp02-long-table", 390, 844]]);\n\nconst server =',
);

await writeFile(temporaryPath, source, "utf8");
try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "RESP-02 long mobile table browser regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("RESP-02 100-row mobile table regression passed.");
