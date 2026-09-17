import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

const origin = String(process.argv[2] || "").trim().replace(/\/$/u, "");
assert(origin, "Next mobile table route probe requires a server origin.");

function browserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error("Next mobile table route probe requires Chrome or Chromium on PATH.");
}

async function reserveTcpPort() {
  const probe = createNetServer();
  await new Promise((resolvePromise, rejectPromise) => {
    probe.once("error", rejectPromise);
    probe.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = probe.address();
  assert(address && typeof address === "object", "Could not reserve a Chrome debugging port.");
  const port = address.port;
  await new Promise((resolvePromise) => probe.close(resolvePromise));
  return port;
}

async function waitForPageTarget(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = Array.isArray(targets)
          ? targets.find((entry) => entry?.type === "page")
          : null;
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      // Chrome may not have opened the debugging endpoint yet.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Chrome debugging target did not become ready.");
}

async function connectCdp(webSocketUrl) {
  assert(typeof WebSocket === "function", "Node runtime must expose WebSocket for CDP.");
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message?.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result || {});
  });

  return {
    send(method, params = {}) {
      const id = ++sequence;
      return new Promise((resolvePromise, rejectPromise) => {
        pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function setPhoneViewport(cdp, width, height) {
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 3,
    mobile: true,
  });
}

async function waitForRouteRow(cdp, playerId) {
  const deadline = Date.now() + 25_000;
  let lastValue = null;
  while (Date.now() < deadline) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression: `(() => ({
        pathname: window.location.pathname,
        readyState: document.readyState,
        routeReady: document.documentElement.dataset.mflRouteReady === "true",
        page: String(document.body.dataset.page || ""),
        row: Boolean(document.querySelector('#tableBody tr[data-player-id="${playerId}"]')),
        loading: document.documentElement.classList.contains("mflDataLoading"),
        error: String(document.querySelector("#tableEmptyState")?.textContent || "").trim(),
      }))()`,
      returnByValue: true,
    });
    const value = evaluation?.result?.value || null;
    lastValue = value;
    if (value?.readyState === "complete" && value?.routeReady && value?.row && !value?.loading) return value;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Mobile table route row did not become ready. Last state: ${JSON.stringify(lastValue)}`);
}

async function inspectRouteRow(cdp, playerId) {
  const evaluation = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const row = document.querySelector('#tableBody tr[data-player-id="${playerId}"]');
      if (!(row instanceof HTMLTableRowElement)) return { missing: true };
      const fullName = row.querySelector('.playerNameFullValue');
      const compactName = row.querySelector('.playerNameCompactValue');
      const joinedFull = row.querySelector('.joinedAgencyFullValue');
      const joinedCompact = row.querySelector('.joinedAgencyCompactValue');
      const ageHost = row.querySelector('td.col-age .tableControlCellContent');
      const ageMarker = row.querySelector('td.col-age .retirementMarker, td.col-age .newMintMarker');
      const display = (element) => element instanceof HTMLElement ? getComputedStyle(element).display : "missing";
      const visibleText = (element) => element instanceof HTMLElement && display(element) !== "none"
        ? String(element.textContent || "").replace(/\\s+/g, " ").trim()
        : "";
      const ageStyle = ageHost instanceof HTMLElement ? getComputedStyle(ageHost) : null;
      const scroller = row.closest('.playerTableScroller');
      return {
        width: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        visualViewportWidth: Math.round(window.visualViewport?.width || 0),
        dpr: window.devicePixelRatio,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        hoverNone: matchMedia('(hover: none)').matches,
        mobileMedia: matchMedia('(max-width: 900px)').matches,
        fullNamePresent: fullName instanceof HTMLElement,
        compactNamePresent: compactName instanceof HTMLElement,
        fullNameDisplay: display(fullName),
        compactNameDisplay: display(compactName),
        renderedName: visibleText(fullName) || visibleText(compactName),
        joinedFullPresent: joinedFull instanceof HTMLElement,
        joinedCompactPresent: joinedCompact instanceof HTMLElement,
        joinedFullDisplay: display(joinedFull),
        joinedCompactDisplay: display(joinedCompact),
        renderedJoined: visibleText(joinedFull) || visibleText(joinedCompact),
        ageMarkerPresent: ageMarker instanceof HTMLElement && ageMarker.getClientRects().length > 0,
        ageGap: ageStyle ? String(ageStyle.columnGap || ageStyle.gap || '') : '',
        tableScrollWidth: scroller instanceof HTMLElement ? scroller.scrollWidth : 0,
        tableClientWidth: scroller instanceof HTMLElement ? scroller.clientWidth : 0,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`,
    returnByValue: true,
  });
  return evaluation?.result?.value || {};
}

async function verifyRoute(cdp, { path, playerId, compactName }) {
  for (const [width, height, expectedGap] of [[390, 844, "2px"], [380, 800, "1px"]]) {
    await setPhoneViewport(cdp, width, height);
    await cdp.send("Page.navigate", { url: `${origin}${path}` });
    await waitForRouteRow(cdp, playerId);
    const state = await inspectRouteRow(cdp, playerId);
    const detail = JSON.stringify(state);

    assert.equal(state.width, width, `Layout viewport mismatch on ${path}: ${detail}`);
    assert.equal(state.clientWidth, width, `Document viewport mismatch on ${path}: ${detail}`);
    assert.equal(state.visualViewportWidth, width, `Visual viewport mismatch on ${path}: ${detail}`);
    assert.equal(state.dpr, 3, `Mobile DPR mismatch on ${path}: ${detail}`);
    assert.equal(state.coarsePointer, true, `Pointer is not coarse on ${path}: ${detail}`);
    assert.equal(state.hoverNone, true, `Hover capability is not none on ${path}: ${detail}`);
    assert.equal(state.mobileMedia, true, `Mobile media query is inactive on ${path}: ${detail}`);
    assert.equal(state.fullNamePresent, true, `Full-name node is missing on ${path}: ${detail}`);
    assert.equal(state.compactNamePresent, true, `Compact-name node is missing on ${path}: ${detail}`);
    assert.equal(state.fullNameDisplay, "none", `Full player name is visible on mobile ${path}: ${detail}`);
    assert.notEqual(state.compactNameDisplay, "none", `Compact player name is hidden on ${path}: ${detail}`);
    assert.equal(state.renderedName, compactName, `Compact player name is wrong on ${path}: ${detail}`);
    assert.equal(state.joinedFullPresent, true, `Joined Agency full node is missing on ${path}: ${detail}`);
    assert.equal(state.joinedCompactPresent, true, `Joined Agency compact node is missing on ${path}: ${detail}`);
    assert.equal(state.joinedFullDisplay, "none", `Joined Agency full value is visible on phone ${path}: ${detail}`);
    assert.notEqual(state.joinedCompactDisplay, "none", `Joined Agency compact value is hidden on ${path}: ${detail}`);
    assert.ok(state.renderedJoined && !state.renderedJoined.includes(" "), `Joined Agency did not reduce to date-only on ${path}: ${detail}`);
    assert.equal(state.ageMarkerPresent, true, `Age marker is missing on ${path}: ${detail}`);
    assert.equal(state.ageGap, expectedGap, `Age/marker spacing is wrong on ${path}: ${detail}`);
    assert.ok(state.tableScrollWidth >= state.tableClientWidth, `Player table scroller has invalid geometry on ${path}: ${detail}`);
    assert.ok(state.documentOverflow <= 1, `Player table leaked horizontal overflow to the document on ${path}: ${detail}`);
  }
}

const executable = browserExecutable();
const debuggingPort = await reserveTcpPort();
const userDataDirectory = await mkdtemp(join(tmpdir(), "mfl-next-mobile-table-routes-"));
const child = spawn(executable, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--remote-debugging-port=${debuggingPort}`,
  "--remote-debugging-address=127.0.0.1",
  `--user-data-dir=${userDataDirectory}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { stderr += chunk; });
let cdp = null;

try {
  const target = await waitForPageTarget(debuggingPort);
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");

  await verifyRoute(cdp, {
    path: "/mfl/attributes",
    playerId: "1",
    compactName: "N. Barella",
  });
  await verifyRoute(cdp, {
    path: "/agents/0x2222222222222222/attributes",
    playerId: "2",
    compactName: "A. Bastoni",
  });

  console.log("Real Next MFL and Agent mobile route probe passed.");
} catch (error) {
  throw new Error(`${error.message}\n${stderr.slice(-2500)}`, { cause: error });
} finally {
  cdp?.close();
  if (child.exitCode === null) {
    await new Promise((resolvePromise) => {
      child.once("close", resolvePromise);
      child.kill("SIGKILL");
    });
  }
  await rm(userDataDirectory, { recursive: true, force: true });
}
