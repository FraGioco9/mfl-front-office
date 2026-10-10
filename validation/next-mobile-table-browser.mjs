import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { pathToFileURL } from "node:url";

function browserExecutable(mode) {
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
  throw new Error(mode === "table"
    ? "Next mobile table browser probe requires Chrome or Chromium on PATH."
    : "Next mobile table route probe requires Chrome or Chromium on PATH.");
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
      // Chrome may not have exposed the debugging endpoint yet.
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

async function waitForShell(cdp) {
  const deadline = Date.now() + 20_000;
  let lastValue = null;
  while (Date.now() < deadline) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression: `(() => ({
        readyState: document.readyState,
        appShell: Boolean(document.querySelector("#appShell")),
        progressionPage: Boolean(document.querySelector("#progressionPage")),
        viewport: String(document.querySelector('meta[name="viewport"]')?.getAttribute("content") || ""),
        width: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        visualViewportWidth: Math.round(window.visualViewport?.width || 0),
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        hoverNone: matchMedia("(hover: none)").matches,
      }))()`,
      returnByValue: true,
    });
    const value = evaluation?.result?.value || null;
    lastValue = value;
    if (value?.readyState === "complete" && value?.appShell && value?.progressionPage) return value;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Next mobile shell did not become ready. Last state: ${JSON.stringify(lastValue)}`);
}

async function setPhoneViewport(cdp, width, height = 844) {
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

async function installProbeRow(cdp) {
  const evaluation = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const page = document.querySelector("#progressionPage");
      const scroller = page?.querySelector(".playerTableScroller");
      if (!(page instanceof HTMLElement) || !(scroller instanceof HTMLElement)) {
        return { installed: false, assetsReady: false };
      }
      page.hidden = false;
      scroller.innerHTML = '<table><tbody id="tableBody"><tr data-player-id="mobile-probe"><td class="selectionCell"><span class="tableControlCellContent tableControlCellContentCentered"><input type="checkbox" aria-label="Select probe"></span></td><td class="nameCell col-name"><span class="tableControlCellContent"><div class="playerNameCell"><a class="playerNameLink"><span class="playerNameFullValue">Nicolò Barella</span><span class="playerNameCompactValue">N. Barella</span></a><span class="playerNameMarkers"><span class="playerNoteIcon">📝</span></span></div></span></td><td class="flagCell"><span class="tableControlCellContent tableControlCellContentCentered"><img class="flagImage" src="/flags/it.svg" alt="Italy"></span></td><td class="col-listing"><span class="tableControlCellContent"><span class="listingCellTableHost"><span class="listingCellContent"><img class="listingCellIcon" src="/listing-shopping-bag.svg" width="12" height="12" alt=""><span class="listingCellPrice">$10,000</span></span></span></span></td><td class="col-age"><span class="tableControlCellContent"><span class="playerAgeValue">23</span><span class="retirementMarker">R</span></span></td><td class="col-owned-since"><span class="tableControlCellContent"><span class="joinedAgencyFullValue">17/09/2026 12:30</span><span class="joinedAgencyCompactValue">17/09/2026</span></span></td><td class="rowActionsCell"><span class="tableControlCellContent tableControlCellContentCentered"><button type="button" class="playerTableActionsButton" aria-label="Actions"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1"></circle><circle cx="8" cy="8" r="1"></circle><circle cx="13" cy="8" r="1"></circle></svg></button></span></td></tr></tbody></table>';
      const images = Array.from(scroller.querySelectorAll('img'));
      await Promise.all(images.map(image => image.complete
        ? Promise.resolve()
        : new Promise(resolve => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        installed: Boolean(scroller.querySelector('tr[data-player-id="mobile-probe"]')),
        assetsReady: images.every(image => image.complete),
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  assert.equal(evaluation?.result?.value?.installed, true, "Could not install the mobile table probe row in the real Next shell.");
  assert.equal(evaluation?.result?.value?.assetsReady, true, "Mobile table probe image assets did not settle before geometry checks.");
}

async function snapshot(cdp, width) {
  await setPhoneViewport(cdp, width, width <= 520 ? 844 : 900);
  await cdp.send("Runtime.evaluate", { expression: 'window.dispatchEvent(new Event("resize"));' });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 180));
  const evaluation = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const row = document.querySelector('#tableBody tr[data-player-id="mobile-probe"]');
      const fullName = row?.querySelector('.playerNameFullValue');
      const compactName = row?.querySelector('.playerNameCompactValue');
      const listingPrice = row?.querySelector('.listingCellPrice');
      const listingIcon = row?.querySelector('.listingCellIcon');
      const ageHost = row?.querySelector('td.col-age .tableControlCellContent');
      const joinedFull = row?.querySelector('.joinedAgencyFullValue');
      const joinedCompact = row?.querySelector('.joinedAgencyCompactValue');
      const display = (element) => element instanceof HTMLElement ? getComputedStyle(element).display : "missing";
      const visibleText = (element) => element instanceof HTMLElement && display(element) !== "none" ? String(element.textContent || "").trim() : "";
      const ageStyle = ageHost instanceof HTMLElement ? getComputedStyle(ageHost) : null;
      const centeredObjectSelectors = [
        '.tableControlCellContent > *',
        '.tableOverallCellContent > *',
        '.playerNameCell > *',
        '.playerNameMarkers > *',
        '.listingCellTableHost > *',
        '.listingCellContent > *',
      ];
      const centeredObjects = [...row.querySelectorAll(centeredObjectSelectors.join(','))]
        .filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0)
        .map((element) => {
          const parent = element.parentElement;
          if (!(parent instanceof HTMLElement)) return null;
          const elementRect = element.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
          return {
            selector: element.className || element.tagName,
            offset: Math.abs((elementRect.top + elementRect.height / 2) - (parentRect.top + parentRect.height / 2)),
          };
        })
        .filter(Boolean);
      const maxRowObjectCenterOffset = centeredObjects.reduce((maxOffset, item) => Math.max(maxOffset, item.offset), 0);
      return {
        width: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        visualViewportWidth: Math.round(window.visualViewport?.width || 0),
        dpr: window.devicePixelRatio,
        mobileMedia: matchMedia('(max-width: 900px)').matches,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        hoverNone: matchMedia('(hover: none)').matches,
        fullNameDisplay: display(fullName),
        compactNameDisplay: display(compactName),
        renderedName: visibleText(fullName) || visibleText(compactName),
        listingDisplay: display(listingPrice),
        listingIconWidth: listingIcon instanceof HTMLElement ? Math.round(listingIcon.getBoundingClientRect().width) : 0,
        ageGap: ageStyle ? String(ageStyle.columnGap || ageStyle.gap || '') : '',
        maxRowObjectCenterOffset,
        rowObjectCenterOffsets: centeredObjects,
        joinedFullDisplay: display(joinedFull),
        joinedCompactDisplay: display(joinedCompact),
        renderedJoined: visibleText(joinedFull) || visibleText(joinedCompact),
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`,
    returnByValue: true,
  });
  return evaluation?.result?.value || {};
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
      const centeredObjects = [...row.querySelectorAll('.tableControlCellContent > *, .tableOverallCellContent > *, .playerNameCell > *, .playerNameMarkers > *, .listingCellTableHost > *, .listingCellContent > *')]
        .filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0)
        .map((element) => {
          const parent = element.parentElement;
          if (!(parent instanceof HTMLElement)) return null;
          const elementRect = element.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
          return Math.abs((elementRect.top + elementRect.height / 2) - (parentRect.top + parentRect.height / 2));
        })
        .filter((value) => Number.isFinite(value));
      const maxRowObjectCenterOffset = centeredObjects.reduce((maxOffset, offset) => Math.max(maxOffset, offset), 0);
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
        maxRowObjectCenterOffset,
        tableScrollWidth: scroller instanceof HTMLElement ? scroller.scrollWidth : 0,
        tableClientWidth: scroller instanceof HTMLElement ? scroller.clientWidth : 0,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`,
    returnByValue: true,
  });
  return evaluation?.result?.value || {};
}

async function verifyRoute(cdp, { path, playerId, compactName }, origin) {
  for (const [width, height, expectedGap] of [[390, 844, 1.14], [380, 800, 1.09]]) {
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
    assert.ok(Math.abs(Number.parseFloat(state.ageGap) - expectedGap) <= 0.08, `Age/marker spacing is wrong on ${path}: ${detail}`);
    assert.ok(state.maxRowObjectCenterOffset <= 1, `A visible row object is not vertically centered on ${path}: ${detail}`);
    assert.ok(state.tableScrollWidth >= state.tableClientWidth, `Player table scroller has invalid geometry on ${path}: ${detail}`);
    assert.ok(state.documentOverflow <= 1, `Player table leaked horizontal overflow to the document on ${path}: ${detail}`);
  }
}


async function runTableProbe(cdp, targetUrl) {
  await setPhoneViewport(cdp, 390, 844);
  await cdp.send("Page.navigate", { url: targetUrl });

  const initial = await waitForShell(cdp);
  assert.equal(initial.viewport, "width=device-width, initial-scale=1, viewport-fit=cover");
  assert.equal(initial.width, 390, `Initial mobile layout viewport is wrong: ${JSON.stringify(initial)}`);
  assert.equal(initial.clientWidth, 390, `Initial mobile document viewport is wrong: ${JSON.stringify(initial)}`);
  assert.equal(initial.visualViewportWidth, 390, `Initial mobile visual viewport is wrong: ${JSON.stringify(initial)}`);
  assert.equal(initial.coarsePointer, true, `Initial mobile pointer is not coarse: ${JSON.stringify(initial)}`);
  assert.equal(initial.hoverNone, true, `Initial mobile hover capability is not none: ${JSON.stringify(initial)}`);

  await installProbeRow(cdp);

  const contracts = [
    { width: 900, name: "N. Barella", listing: "none", gap: 3.48, icon: 8, joined: "17/09/2026 12:30" },
    { width: 700, name: "N. Barella", listing: "none", gap: 2.56, icon: 8, joined: "17/09/2026 12:30" },
    { width: 520, name: "N. Barella", listing: "none", gap: 1.74, icon: 7, joined: "17/09/2026" },
    { width: 380, name: "N. Barella", listing: "none", gap: 1.09, icon: 6, joined: "17/09/2026" },
    { width: 360, name: "N. Barella", listing: "none", gap: 1.00, icon: 6, joined: "17/09/2026" },
  ];

  for (const contract of contracts) {
    const state = await snapshot(cdp, contract.width);
    const detail = JSON.stringify(state);
    assert.equal(state.width, contract.width, `Layout viewport mismatch at ${contract.width}px: ${detail}`);
    assert.equal(state.clientWidth, contract.width, `Document viewport mismatch at ${contract.width}px: ${detail}`);
    assert.equal(state.visualViewportWidth, contract.width, `Visual viewport mismatch at ${contract.width}px: ${detail}`);
    assert.equal(state.dpr, 3, `Mobile DPR mismatch at ${contract.width}px: ${detail}`);
    assert.equal(state.mobileMedia, true, `Mobile media query is inactive at ${contract.width}px: ${detail}`);
    assert.equal(state.coarsePointer, true, `Pointer is not coarse at ${contract.width}px: ${detail}`);
    assert.equal(state.hoverNone, true, `Hover capability is not none at ${contract.width}px: ${detail}`);
    assert.equal(state.fullNameDisplay, "none", `Full player name is still visible at ${contract.width}px: ${detail}`);
    assert.notEqual(state.compactNameDisplay, "none", `Compact player name is hidden at ${contract.width}px: ${detail}`);
    assert.equal(state.renderedName, contract.name, `Player name presentation is wrong at ${contract.width}px: ${detail}`);
    assert.equal(state.listingDisplay, contract.listing, `Listing price is still visible at ${contract.width}px: ${detail}`);
    assert.equal(state.listingIconWidth, contract.icon, `Listing icon size is wrong at ${contract.width}px: ${detail}`);
    assert.ok(Math.abs(Number.parseFloat(state.ageGap) - contract.gap) <= 0.08, `Age/marker spacing is wrong at ${contract.width}px: ${detail}`);
    assert.ok(state.maxRowObjectCenterOffset <= 1, `A visible row object is not vertically centered at ${contract.width}px: ${detail}`);
    assert.equal(state.renderedJoined, contract.joined, `Joined Agency presentation is wrong at ${contract.width}px: ${detail}`);
    assert.ok(state.documentOverflow <= 1, `Mobile table leaked horizontal overflow to the document at ${contract.width}px: ${detail}`);
  }

  console.log("Real Next mobile table browser probe passed.");
}

async function runRoutesProbe(cdp, origin) {
  await verifyRoute(cdp, {
    path: "/mfl/attributes",
    playerId: "1",
    compactName: "N. Barella",
  }, origin);
  await verifyRoute(cdp, {
    path: "/agents/0x2222222222222222/attributes",
    playerId: "2",
    compactName: "A. Bastoni",
  }, origin);

  console.log("Real Next MFL and Agent mobile route probe passed.");
}

export async function runNextMobileTableProbe(mode, input) {
  assert.ok(mode === "table" || mode === "routes", "Specify Next mobile table probe: table or routes.");
  const targetUrl = String(input || "").trim();
  assert(targetUrl, mode === "table"
    ? "Next mobile table browser probe requires a target URL."
    : "Next mobile table route probe requires a server origin.");
  const origin = mode === "routes" ? targetUrl.replace(/\/$/u, "") : "";
  const executable = browserExecutable(mode);
  const debuggingPort = await reserveTcpPort();
  const userDataDirectory = await mkdtemp(join(tmpdir(), mode === "table"
    ? "mfl-next-mobile-table-" : "mfl-next-mobile-table-routes-"));
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
    if (mode === "table") await runTableProbe(cdp, targetUrl);
    else await runRoutesProbe(cdp, origin);
  } catch (error) {
    throw new Error(`${error.message}\n${stderr.slice(mode === "table" ? -2000 : -2500)}`, { cause: error });
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
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runNextMobileTableProbe("table", process.argv[2]);
}
