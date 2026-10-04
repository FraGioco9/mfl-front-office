import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runJS(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, 20000);
  if (result.exceptionDetails) throw Error("LOAD01C browser evaluate: " + JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function waitFor(cdp, condition, context) {
  for (let i = 0; i < 180; i++) {
    if (await runJS(cdp, condition)) return;
    await delay(80);
  }
  throw Error("LOAD01C timeout " + context + " " + JSON.stringify(await runJS(cdp, "window.__load01b?.snapshot()")).slice(0, 550));
}
async function capture(cdp, folder, filename) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }, 30000);
  assert(result?.data, "No screenshot from Chromium");
  const buffer = Buffer.from(result.data, "base64");
  await writeFile(resolve(folder, filename), buffer);
  return { name: filename, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") };
}

export async function runLoad01c(cdp, { url, width, height }) {
  const surface = process.env.MFL_LOAD01C_SURFACE;
  const rows = Number(process.env.MFL_LOAD01C_ROWS);
  const placeholders = Number(process.env.MFL_LOAD01C_PLACEHOLDERS);
  const theme = process.env.MFL_LOAD01C_THEME;
  const repeat = Number(process.env.MFL_LOAD01C_REPEAT);
  const folder = resolve(process.env.MFL_LOAD01C_OUT || "/tmp/load01c");
  await mkdir(folder, { recursive: true });
  const label = [surface, rows, placeholders, width, theme, repeat].join("-");
  const bodySelector = surface === "planner" ? "#plannerRosterBody" : "#tableBody";
  const expectedSkeletonCount = surface === "planner" ? 8 : 10;
  await waitFor(cdp, "Boolean(window.__load01b)", "probe");
  await waitFor(cdp,
    'window.__load01b.requestsHeld >= 1 && document.querySelectorAll(' +
      JSON.stringify(bodySelector + " tr") + ').length === ' + expectedSkeletonCount,
    "network gate + parser skeleton");
  assert([1, expectedSkeletonCount].includes(placeholders), "Unexpected candidate placeholder row count");
  await runJS(cdp, `(() => {
    const body = document.querySelector(${JSON.stringify(bodySelector)});
    const trim = () => {
      while (body.querySelectorAll("tr").length > ${placeholders}) body.lastElementChild.remove();
    };
    trim();
    window.__load01cSkeletonObserver = new MutationObserver(trim);
    window.__load01cSkeletonObserver.observe(body, { childList: true });
  })()`);
  await delay(70);
  const sample = `(() => {
    const body = document.querySelector(${JSON.stringify(bodySelector)});
    const table = body.closest("table");
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map(n => +n.toFixed(2));
    };
    const cells = [...body.querySelectorAll("tr:first-child td")].map(rect);
    const signatures = [...body.querySelectorAll("tr")].map(row => row.textContent?.replace(/\\s+/g, " ").trim() || "");
    return { theme: document.documentElement.dataset.theme,
      rowCount: body.querySelectorAll("tr").length, rows: [...body.querySelectorAll("tr")].map(rect),
      table: rect(table), body: rect(body), columns: cells,
      signatures, path: location.pathname, horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      cls: window.__load01b.cls, held: window.__load01b.requestsHeld, released: window.__load01b.requestsReleased };
  })()`;
  const pending = await runJS(cdp, sample);
  assert.equal(pending.theme, theme, "First paint used wrong theme");
  assert.equal(pending.rowCount, placeholders, "Failed to apply what-if pending row count");
  const screenshots = [await capture(cdp, folder, label + "-pending.png")];
  await runJS(cdp, "window.__load01cSkeletonObserver?.disconnect(); window.__load01b.startMeasurement(); window.__load01b.release()");
  await waitFor(cdp,
    'window.__load01b.requestsReleased >= 1 && document.querySelectorAll(' +
      JSON.stringify(bodySelector + " tr") + ').length === ' + rows
    + (surface === "planner" ? ' && document.querySelector("#plannerRosterBody tr[data-player-id]") !== null' : ''),
    "settled rows " + rows);
  await delay(170);
  const loaded = await runJS(cdp, sample);
  assert.equal(loaded.theme, theme, "Loaded theme changed");
  assert.equal(loaded.rowCount, rows, "Loaded data cardinality incorrect");
  assert(loaded.released >= 1, "No held request was released");
  screenshots.push(await capture(cdp, folder, label + "-loaded.png"));
  const report = {
    surface, rows, placeholders, theme, width, height, repeat,
    phase: "test-only loading DOM what-if, real synthetic server response",
    pending, loaded, screenshots,
    heightDelta: +(loaded.table[3] - pending.table[3]).toFixed(2),
    firstRowHeightDelta: +(loaded.rows[0][3] - pending.rows[0][3]).toFixed(2),
    columnWidthDelta: pending.columns.map((cell, i) => +((loaded.columns[i]?.[2] || 0) - cell[2]).toFixed(2)),
    limitations: [
      "Same committed app, same data fixtures for both pending variants, not a product release",
      "Candidate removes pending rows in the isolated browser only; existing source untouched",
      "No row count is available before a cold async response, so one-row what-if is not a deployable general algorithm",
      "CDP/Chromium CLS is not Safari, RUM or field CLS; no artificial performance claim",
    ],
  };
  await writeFile(resolve(folder, label + ".json"), JSON.stringify(report, null, 2) + "\n");
  console.log("LOAD01C_PASS " + JSON.stringify({
    label, cls: loaded.cls, beforeRows: pending.rowCount, afterRows: loaded.rowCount,
    heightDelta: report.heightDelta, firstRowHeightDelta: report.firstRowHeightDelta,
    columnWidthDelta: report.columnWidthDelta, signature: loaded.signatures, loadedRect: loaded.table,
  }));
  return { status: "passed", detail: label };
}
