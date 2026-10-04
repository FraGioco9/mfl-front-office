import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sleep = ms => new Promise(done => setTimeout(done, ms));

async function evaluate(cdp, expression) {
  const out = await cdp.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  }, 20000);
  if (out.exceptionDetails) throw new Error("LOAD01B4 JS: " + JSON.stringify(out.exceptionDetails));
  return out.result?.value;
}

async function until(cdp, expression, label, timeout = 9500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await sleep(80);
  }
  const probe = await evaluate(cdp, "window.__load01b4?.snapshot()");
  throw new Error("LOAD01B4 timeout " + label + ": " + JSON.stringify({
    held: probe?.heldCount, released: probe?.releasedCount, path: probe?.path,
    requests: probe?.apiRequests?.slice(-9), texts: probe?.texts, regions: probe?.regions,
  }).slice(0, 2400));
}

function compare(a, b) {
  const result = {};
  for (const [key, first] of Object.entries(a.regions)) {
    const next = b.regions[key];
    const start = first.samples[0], end = next?.samples[0];
    result[key] = {
      firstCount: first.count, nextCount: next?.count ?? null,
      ...(start && end
        ? Object.fromEntries(["x", "y", "width", "height"].map(prop =>
            ["d" + prop, +(end[prop] - start[prop]).toFixed(2)]))
        : { comparable: false }),
    };
  }
  return result;
}

async function shot(cdp, directory, filename) {
  const out = await cdp.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: false,
  }, 30000);
  assert(out.data, "LOAD01B4 PNG missing");
  const buffer = Buffer.from(out.data, "base64");
  await writeFile(resolve(directory, filename), buffer);
  return { file: filename, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") };
}

const readiness = {
  myclubs: 'document.querySelectorAll("#myClubsGrid .myClubCard:not(.myClubCardLoading)").length === 3 && document.getElementById("myClubsGrid")?.textContent?.includes("Browser League")',
  home: 'document.getElementById("homePlayers")?.textContent?.trim() !== "-" && document.getElementById("homePlayers")?.textContent?.trim()?.length > 0',
  club: 'document.getElementById("clubIdentityName")?.textContent?.trim() === "Browser Club" && document.getElementById("clubIdentityOwnerName")?.textContent?.includes("Browser Owner")',
  evaluation: 'document.getElementById("evaluationPage")?.hidden === false && document.documentElement.dataset.mflRouteReady === "true"',
  database: 'document.getElementById("tableBody")?.textContent?.includes("Browser Player")',
};

const returnActions = {
  myclubs: 'window.setPage("my-clubs", true)',
  home: 'window.setPage("home", true)',
  club: '(history.back(), Promise.resolve())',
  evaluation: 'window.setPage("evaluation", true, { plain: true })',
  database: 'window.setPage("database", true, { view: "attributes" })',
};

export async function runLoad01b4(cdp, { url, width, height }) {
  const kind = process.env.MFL_LOAD01B4_KIND;
  const theme = process.env.MFL_LOAD01B4_THEME;
  const folder = resolve(process.env.MFL_LOAD01B4_OUT || "/tmp/mfl-load01b4");
  await mkdir(folder, { recursive: true });
  const key = [kind, width, theme].join("-");
  await until(cdp, "Boolean(window.__load01b4)", "probe initialization");
  await until(cdp, "window.__load01b4.heldCount > 0", "real held API GET");
  await sleep(120);
  const pending = await evaluate(cdp, "window.__load01b4.snapshot()");
  assert.equal(pending.themeActual, theme, "wrong first-paint theme");
  if (kind === "myclubs") {
    assert.equal(pending.regions["#myClubsGrid .myClubCardLoading"].count, 3,
      "My Clubs must present actual 3-card skeleton while competitions request is held");
  }
  const captures = [await shot(cdp, folder, key + "-pending.png")];
  await evaluate(cdp, "window.__load01b4.startWindow(); window.__load01b4.release()");
  await until(cdp, readiness[kind], "actual settled " + kind);
  await sleep(180);
  const loaded = await evaluate(cdp, "window.__load01b4.snapshot()");
  assert.equal(loaded.themeActual, theme, "theme changed on API resolution");
  assert(loaded.releasedCount > 0, "no synthetic GET was released");
  captures.push(await shot(cdp, folder, key + "-loaded.png"));
  await evaluate(cdp, "window.__load01b4.endWindow(); true");
  const beforeNav = loaded.apiRequests.length;
  await evaluate(cdp, 'window.setPage("privacy", true)');
  await until(cdp, 'location.pathname === "/privacy" && document.getElementById("privacyPage")?.hidden === false',
    "SPA privacy transition");
  await sleep(80);
  await evaluate(cdp, "window.__load01b4.startWindow(); true");
  await evaluate(cdp, returnActions[kind]);
  await until(cdp, "location.pathname === " + JSON.stringify(new URL(url).pathname)
    + " && (" + readiness[kind] + ")", "genuine cached SPA return " + kind);
  await sleep(180);
  const cached = await evaluate(cdp, "window.__load01b4.snapshot()");
  captures.push(await shot(cdp, folder, key + "-spa-return.png"));
  assert.equal(cached.themeActual, theme, "theme changed during SPA return");
  assert.equal(cached.heldCount, pending.heldCount, "unexpected new network hold on cached return");
  if (kind === "myclubs") {
    assert.equal(
      cached.apiRequests.filter(x => x.mode === "my-clubs" || x.mode === "my-clubs-competitions").length,
      loaded.apiRequests.filter(x => x.mode === "my-clubs" || x.mode === "my-clubs-competitions").length,
      "My Clubs SPA cached return repeated owned-clubs network fetch",
    );
  }
  const report = {
    status: "passed", kind, theme, width, height, url, synthetic: true,
    pending, loaded, spaCached: cached,
    pendingToLoaded: compare(pending, loaded),
    loadedToCached: compare(loaded, cached),
    apiRequestsDuringReturn: cached.apiRequests.slice(beforeNav),
    captures,
    limitations: [
      "Chromium simulated viewport, not real iPhone/Safari",
      "All API data and wallet proofs are local synthetic fixtures; no live refresh or opt-in",
      "CLS windows isolate API settlement and SPA return but are not field/RUM scores",
      "CSS/image/font timing can affect snapshots; screenshots require visual review",
      "No application A/B patch has been tested",
    ],
  };
  await writeFile(resolve(folder, key + ".json"), JSON.stringify(report, null, 2) + "\n");
  console.log("LOAD01B4_PASS " + JSON.stringify({
    key, held: pending.heldCount, loadedCLS: loaded.cls, returnCLS: cached.cls,
    pendingToLoaded: report.pendingToLoaded, loadedToCached: report.loadedToCached,
    returnAPI: report.apiRequestsDuringReturn, captures: captures.map(x => x.file),
  }));
  return { status: "passed", detail: key + " pending/loaded/SPA captured" };
}
