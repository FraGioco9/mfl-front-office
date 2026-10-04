import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sleep = ms => new Promise(done => setTimeout(done, ms));

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  }, 15000);
  if (result.exceptionDetails) {
    throw new Error("LOAD01B CDP evaluation failed: " + JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function waitFor(cdp, condition, label, ms = 14000) {
  const until = Date.now() + ms;
  let latest;
  while (Date.now() < until) {
    latest = await evaluate(cdp, condition);
    if (latest) return latest;
    await sleep(75);
  }
  throw new Error("LOAD01B timed out at " + label + "; last=" + JSON.stringify(latest));
}

function deltas(before, after) {
  const diffs = {};
  for (const [selector, first] of Object.entries(before.regions)) {
    const last = after.regions[selector];
    const one = first.samples[0];
    const two = last?.samples[0];
    if (!one || !two) {
      diffs[selector] = { beforeCount: first.count, afterCount: last?.count ?? null, comparable: false };
      continue;
    }
    diffs[selector] = {
      beforeCount: first.count, afterCount: last.count,
      comparable: true,
      dx: +(two.x - one.x).toFixed(2),
      dy: +(two.y - one.y).toFixed(2),
      dw: +(two.width - one.width).toFixed(2),
      dh: +(two.height - one.height).toFixed(2),
    };
  }
  return diffs;
}

async function screenshot(cdp, directory, label) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false, fromSurface: true,
  }, 30000);
  assert(shot?.data, "LOAD01B screenshot missing");
  const bytes = Buffer.from(shot.data, "base64");
  await writeFile(resolve(directory, label + ".png"), bytes);
  return { name: label + ".png", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function runLoad01b(cdp, { url, width, height }) {
  const kind = process.env.MFL_LOAD01B_KIND;
  const theme = process.env.MFL_LOAD01B_THEME;
  const out = resolve(process.env.MFL_LOAD01B_OUTPUT || "/tmp/mfl-load01b");
  const label = [kind, width, theme].join("-");
  await mkdir(out, { recursive: true });
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await waitFor(cdp, "Boolean(window.__load01b)", "injected probe");
  const isPlans = kind === "plans";
  if (isPlans) {
    await waitFor(cdp,
      'document.documentElement.dataset.mflRouteReady === "true" && document.getElementById("plannerPlansButton")?.disabled === false',
      "planner saved plans trigger");
    await evaluate(cdp, 'document.getElementById("plannerPlansButton").click(); true');
  }
  const required = isPlans ? 2 : 1;
  const pending = await waitFor(cdp,
    "window.__load01b.requestsHeld >= " + required + " && " +
    (kind === "myclubs"
      ? 'document.getElementById("myClubsGrid") !== null'
      : kind === "planner-squad"
        ? 'document.querySelectorAll("#plannerRosterBody .plannerRosterSkeleton").length === 64'
        : kind === "plans"
          ? 'document.getElementById("plannerPlansModal")?.hidden === false'
          : "true"),
    "real pending requests and loading view",
    15000);
  assert(pending, "Real network gate never held a request");
  await sleep(90);
  const before = await evaluate(cdp, "window.__load01b.snapshot()");
  assert(before.requestsHeld >= required, "Pending snapshot was not network-gated");
  const screenshotBefore = await screenshot(cdp, out, label + "-pending");
  await evaluate(cdp, "window.__load01b.startMeasurement(); window.__load01b.release()");
  const settledSelectors = {
    "planner-squad": 'document.querySelectorAll("#plannerRosterBody tr[data-player-id]").length > 0',
    plans: 'document.querySelector("#plannerPlansList")?.children.length > 0',
    "planner-search": 'document.querySelector("#plannerTeamSelector") && document.querySelectorAll("#plannerTeamSelector .searchHint").length === 0',
    myclubs: 'document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length >= 1',
    database: 'document.querySelectorAll("#tableBody tr:not(.mflTableLoadingRow)").length > 0 && document.documentElement.dataset.mflRouteReady === "true"',
    player: 'document.documentElement.dataset.mflRouteReady === "true" && document.querySelector("#playerDetail")?.textContent?.includes("Player")',
  };
  await waitFor(cdp, settledSelectors[kind], "settled " + kind, 16000);
  await sleep(150);
  const after = await evaluate(cdp, "window.__load01b.snapshot()");
  const screenshotAfter = await screenshot(cdp, out, label + "-loaded");
  await evaluate(cdp, "window.__load01b.unblockCanonical(); true");
  // This temporary fixture is diagnostic-only: its canonical navigation callback was deliberately
  // held so it could not close the Saved Plans dialog or replace DOM before the screenshots.
  // The untouched canonical suite is independently mandatory in Site Quality and Mobile CI.
  const validation = {
    status: "passed",
    detail: "LOAD-01B screenshot/geometry capture complete; canonical regression runs separately",
  };
  const postCapture = await evaluate(cdp, "window.__load01b.snapshot()");
  const report = {
    kind, theme, width, height, url, status: "passed",
    scope: "synthetic Chromium with held real fixture fetch; no wallet or live provider",
    diagnosticValidation: validation.detail,
    pending: before, loaded: after, postCaptureSnapshot: postCapture,
    delta: deltas(before, after),
    captures: [screenshotBefore, screenshotAfter],
    limitations: [
      "Chromium not Safari/iPhone or VoiceOver",
      "Screenshot pixel differences include expected content changes",
      "CLS is measured in a gated interval and excludes hadRecentInput",
      "Images/fonts and route composition may confound the transition",
      "Not a production performance, wallet, LCP or RUM claim",
    ],
  };
  await writeFile(resolve(out, label + ".json"), JSON.stringify(report, null, 2) + "\n");
  console.log("LOAD01B_PASS " + JSON.stringify({
    label, requests: [before.requestsHeld, after.requestsReleased],
    before: before.regions, after: after.regions,
    cls: after.cls, delta: report.delta,
    captures: report.captures.map(x => x.name),
  }));
  return validation;
}
