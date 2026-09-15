import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_RUNS = 5;
const DEFAULT_ROUTE_TIMEOUT_MS = 60_000;
const SLOW_ROUTE_TIMEOUT_MS = 240_000;
const SETTLE_GRACE_MS = 150;
const NETWORK_IDLE_GRACE_MS = 250;
const BASELINE_SCHEMA_VERSION = 13;

function integerEnv(name, fallback, minimum = 1, maximum = 50) {
  const value = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function normalizedBaseUrl(value) {
  const url = new URL(String(value || DEFAULT_BASE_URL));
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

const baseUrl = normalizedBaseUrl(process.env.MFL_BASE_URL);
const repetitions = integerEnv("MFL_BASELINE_RUNS", DEFAULT_RUNS, 1, 20);
const environmentLabel = String(process.env.MFL_BASELINE_LABEL || baseUrl);
const requestedProfiles = String(process.env.MFL_BASELINE_PROFILES || "desktop,mobile-slow")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const requestedJourneyIds = [...new Set(
  String(process.env.MFL_BASELINE_JOURNEYS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
)];
const outputPath = String(process.env.MFL_BASELINE_OUTPUT || "").trim();
const sourceCommit = String(process.env.MFL_BASELINE_SOURCE_COMMIT || "").trim();
const sourceRef = String(process.env.MFL_BASELINE_SOURCE_REF || "").trim();
const accessContext = String(process.env.MFL_BASELINE_ACCESS_CONTEXT || "guest/public-database").trim();

const PROFILES = Object.freeze({
  desktop: Object.freeze({
    id: "desktop",
    width: 1280,
    height: 900,
    mobile: false,
    cpuRate: 1,
    routeTimeoutMs: DEFAULT_ROUTE_TIMEOUT_MS,
    network: null,
  }),
  "mobile-slow": Object.freeze({
    id: "mobile-slow",
    width: 390,
    height: 844,
    mobile: true,
    cpuRate: 4,
    routeTimeoutMs: SLOW_ROUTE_TIMEOUT_MS,
    network: Object.freeze({
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 100_000,
      connectionType: "cellular3g",
    }),
  }),
});

const profiles = requestedProfiles.map((id) => {
  const profile = PROFILES[id];
  if (!profile) throw new Error(`Unknown MFL_BASELINE_PROFILES entry: ${id}`);
  return profile;
});

function browserExecutable() {
  const windowsRoots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);
  const windowsCandidates = process.platform === "win32"
    ? windowsRoots.flatMap((root) => [
        join(root, "Google", "Chrome", "Application", "chrome.exe"),
        join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
        join(root, "Chromium", "Application", "chrome.exe"),
      ])
    : [];
  const candidates = [
    process.env.CHROME_PATH,
    ...windowsCandidates,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "chrome",
    "msedge",
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error(
    "Performance baseline could not find Chrome/Chromium/Edge. "
      + "Install a Chromium browser in its standard location or set CHROME_PATH to the browser executable.",
  );
}

function browserVersion(executable) {
  const probe = spawnSync(executable, ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) return "";
  return String(probe.stdout || probe.stderr || "").trim();
}

async function baselineTargetContext(executable) {
  const response = await fetch(new URL("/api/data?mode=bootstrap", baseUrl), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Could not capture baseline dataset context: HTTP ${response.status}.`);
  }
  const payload = await response.json();
  const manifest = payload?.manifest && typeof payload.manifest === "object" ? payload.manifest : {};
  const datasetGeneratedAt = String(manifest.generated_at || "").trim();
  assert(datasetGeneratedAt && !Number.isNaN(Date.parse(datasetGeneratedAt)),
    "Baseline target did not expose a valid manifest.generated_at.");
  return Object.freeze({
    sourceCommit,
    sourceRef,
    datasetGeneratedAt,
    datasetRowCount: Number(manifest.row_count) || 0,
    datasetWalletCount: Number(manifest.wallet_count) || 0,
    datasetSource: String(manifest.source || "").trim(),
    accessContext,
    browserVersion: browserVersion(executable),
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
  });
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function discoverRepresentativeEntities() {
  const url = new URL("/api/data", baseUrl);
  const params = {
    mode: "page",
    scope: "database",
    view: "contracts",
    page: "1",
    pageSize: "25",
    sortKey: "overall",
    sortDirection: "desc",
    filters: JSON.stringify([
      { column: "contract_status", operator: "is", value: "under_contract" },
    ]),
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not discover representative entities: HTTP ${response.status} from ${url}`);
  }
  const payload = await response.json();
  const columns = Array.isArray(payload?.columns) ? payload.columns.map(String) : [];
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const playerIdIndex = columns.indexOf("player_id");
  const clubIdIndex = columns.indexOf("active_contract_club_id");
  assert(playerIdIndex >= 0, "Database discovery payload does not include player_id.");

  let playerId = "";
  let clubId = "";
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const candidatePlayerId = String(row[playerIdIndex] ?? "").trim();
    const candidateClubId = clubIdIndex >= 0 ? String(row[clubIdIndex] ?? "").trim() : "";
    if (!playerId && candidatePlayerId) playerId = candidatePlayerId;
    if (candidatePlayerId && candidateClubId) {
      playerId = candidatePlayerId;
      clubId = candidateClubId;
      break;
    }
  }

  assert(playerId, "Could not discover a representative Player ID.");
  assert(clubId, "Could not discover a representative contracted Club ID.");
  return Object.freeze({ playerId, clubId });
}

function journeysFor({ playerId, clubId }) {
  return Object.freeze([
    Object.freeze({
      id: "database",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
    }),
    Object.freeze({
      id: "database-100",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-250",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 250,
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-100-no-paint",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      cachedProbe: "table-body-invisible",
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-100-no-layout",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      cachedProbe: "table-display-none",
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-100-no-scroll-state",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      cachedProbe: "name-no-scroll-state",
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-100-no-sticky-name",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      cachedProbe: "name-no-sticky",
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-100-keep-parked-layout",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      preParkProbe: "keep-table-layout",
      profileOnly: true,
    }),
    Object.freeze({
      id: "database-100-keep-layout-no-scroll-state",
      path: "/database/attributes",
      page: "database",
      options: Object.freeze({ view: "attributes" }),
      pageSize: 100,
      preParkProbe: "keep-layout-no-scroll-state",
      profileOnly: true,
    }),
    Object.freeze({
      id: "player",
      path: `/players/${encodeURIComponent(playerId)}`,
      page: "player",
      options: Object.freeze({ playerId }),
    }),
    Object.freeze({
      id: "club",
      path: `/clubs/${encodeURIComponent(clubId)}/squad`,
      page: "club",
      options: Object.freeze({ clubId, view: "squad" }),
    }),
    Object.freeze({
      id: "my-clubs",
      path: "/my-clubs",
      expectedPath: "/my-clubs/opted-out",
      page: "my-clubs",
      options: Object.freeze({}),
    }),
    Object.freeze({
      id: "evaluation",
      path: `/evaluation?player=${encodeURIComponent(playerId)}`,
      page: "evaluation",
      options: Object.freeze({ playerId }),
    }),
    Object.freeze({
      id: "stats",
      path: "/mfl/stats",
      page: "mfl",
      options: Object.freeze({ view: "stats" }),
    }),
  ]);
}

function selectedJourneys(journeys) {
  if (!requestedJourneyIds.length) return Object.freeze(journeys.filter((journey) => journey.profileOnly !== true));
  const byId = new Map(journeys.map((journey) => [journey.id, journey]));
  return Object.freeze(requestedJourneyIds.map((id) => {
    const journey = byId.get(id);
    if (!journey) {
      throw new Error(
        `Unknown MFL_BASELINE_JOURNEYS entry: ${id}. Expected one of: ${[...byId.keys()].join(", ")}`,
      );
    }
    return journey;
  }));
}

async function reserveTcpPort() {
  const { createServer } = await import("node:net");
  const probe = createServer();
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
      // Chrome may still be starting.
    }
    await delay(50);
  }
  throw new Error("Chrome debugging target did not become ready.");
}

async function connectCdp(webSocketUrl) {
  const WebSocketConstructor = globalThis.WebSocket;
  if (typeof WebSocketConstructor !== "function") {
    throw new Error("Node runtime does not expose WebSocket for Chrome DevTools Protocol.");
  }

  const socket = new WebSocketConstructor(webSocketUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message?.id && pending.has(message.id)) {
      const { resolve: resolvePromise, reject: rejectPromise } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectPromise(new Error(JSON.stringify(message.error)));
      else resolvePromise(message.result || {});
      return;
    }
    const handlers = listeners.get(String(message?.method || ""));
    if (!handlers) return;
    for (const handler of handlers) handler(message.params || {});
  });

  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolvePromise, rejectPromise) => {
      pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function on(method, handler) {
    const handlers = listeners.get(method) || new Set();
    handlers.add(handler);
    listeners.set(method, handlers);
    return () => handlers.delete(handler);
  }

  return Object.freeze({
    send,
    on,
    close() {
      socket.close();
    },
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails?.exception?.description || result.exceptionDetails?.text || "Runtime evaluation failed.");
  }
  return result?.result?.value;
}

const observerBootstrap = `(() => {
  window.__mflBaselineLongTasks = [];
  window.__mflBaselineLongAnimationFrames = [];
  window.__mflBaselineLayoutShifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__mflBaselineLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__mflBaselineLongAnimationFrames.push({
          startTime: entry.startTime,
          duration: entry.duration,
          blockingDuration: Number(entry.blockingDuration) || 0,
          renderStart: Number(entry.renderStart) || 0,
          styleAndLayoutStart: Number(entry.styleAndLayoutStart) || 0,
          scripts: Array.from(entry.scripts || []).map((script) => ({
            duration: Number(script.duration) || 0,
            forcedStyleAndLayoutDuration: Number(script.forcedStyleAndLayoutDuration) || 0,
            sourceFunctionName: String(script.sourceFunctionName || ""),
            sourceURL: String(script.sourceURL || ""),
            invoker: String(script.invoker || ""),
          })),
        });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__mflBaselineLayoutShifts.push({ startTime: entry.startTime, value: entry.value });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
})();`;

function parseServerTiming(header) {
  const metrics = [];
  for (const part of String(header || "").split(",")) {
    const [rawName, ...parameters] = part.trim().split(";");
    const name = String(rawName || "").trim();
    if (!name) continue;
    const durationParameter = parameters.find((value) => /^\s*dur=/i.test(value));
    const duration = durationParameter
      ? Number(String(durationParameter).replace(/^\s*dur=/i, ""))
      : NaN;
    metrics.push({ name, duration: Number.isFinite(duration) ? duration : null });
  }
  return metrics;
}

function createNetworkCollector(cdp) {
  let current = null;
  let activitySequence = 0;
  const requests = new Map();
  const pendingRequestIds = new Set();

  cdp.on("Network.requestWillBeSent", ({ requestId, request, type }) => {
    if (!current) return;
    const url = String(request?.url || "");
    const api = (() => {
      try {
        const parsed = new URL(url);
        return parsed.origin === new URL(baseUrl).origin && parsed.pathname.startsWith("/api/");
      } catch {
        return false;
      }
    })();
    current.requestCount += 1;
    if (api) current.apiRequestCount += 1;
    requests.set(requestId, { api, url, type: String(type || "") });
    pendingRequestIds.add(requestId);
    activitySequence += 1;
  });

  cdp.on("Network.responseReceived", ({ requestId, response }) => {
    if (!current) return;
    const request = requests.get(requestId);
    if (!request?.api) return;
    const headers = response?.headers && typeof response.headers === "object" ? response.headers : {};
    const serverTimingEntry = Object.entries(headers)
      .find(([key]) => String(key).toLowerCase() === "server-timing");
    for (const metric of parseServerTiming(serverTimingEntry?.[1])) {
      if (metric.duration === null) continue;
      const bucket = current.serverTiming[metric.name] || { count: 0, total: 0, max: 0 };
      bucket.count += 1;
      bucket.total += metric.duration;
      bucket.max = Math.max(bucket.max, metric.duration);
      current.serverTiming[metric.name] = bucket;
    }
  });

  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    if (!current) return;
    const request = requests.get(requestId);
    if (!request) return;
    const bytes = Math.max(0, Number(encodedDataLength) || 0);
    current.bytes += bytes;
    if (request.api) current.apiBytes += bytes;
    pendingRequestIds.delete(requestId);
    requests.delete(requestId);
    activitySequence += 1;
  });

  cdp.on("Network.loadingFailed", ({ requestId }) => {
    if (!current || !requests.has(requestId)) return;
    pendingRequestIds.delete(requestId);
    requests.delete(requestId);
    activitySequence += 1;
  });

  return Object.freeze({
    start() {
      requests.clear();
      pendingRequestIds.clear();
      activitySequence = 0;
      current = {
        requestCount: 0,
        apiRequestCount: 0,
        bytes: 0,
        apiBytes: 0,
        serverTiming: {},
      };
      return current;
    },
    async waitForIdle(timeoutMs = DEFAULT_ROUTE_TIMEOUT_MS) {
      assert(current, "Network collector is not active.");
      const deadline = Date.now() + timeoutMs;
      let observedActivitySequence = activitySequence;
      let quietSince = Date.now();
      while (Date.now() < deadline) {
        if (activitySequence !== observedActivitySequence) {
          observedActivitySequence = activitySequence;
          quietSince = Date.now();
        }
        if (
          pendingRequestIds.size === 0
          && Date.now() - quietSince >= NETWORK_IDLE_GRACE_MS
        ) {
          return;
        }
        await delay(25);
      }
      throw new Error(
        `Network did not become idle before timeout (${pendingRequestIds.size} measured requests still pending).`,
      );
    },
    stop() {
      const completed = current;
      current = null;
      requests.clear();
      pendingRequestIds.clear();
      return completed;
    },
  });
}

async function waitForRouteReady(cdp, expectedPath, timeoutMs = DEFAULT_ROUTE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let state = null;
    try {
      state = await evaluate(cdp, `(() => ({
        ready: document.documentElement?.dataset?.mflRouteReady === "true",
        loading: !document.body || document.body.classList.contains("loading"),
        path: window.location.pathname + window.location.search
      }))()`);
    } catch (error) {
      const message = String(error?.message || error);
      if (!/execution context|cannot find context|context was destroyed/i.test(message)) throw error;
    }
    if (state?.ready && !state?.loading) {
      if (expectedPath && state.path !== expectedPath) {
        throw new Error(`Expected route ${expectedPath}, got ${state.path}.`);
      }
      await delay(SETTLE_GRACE_MS);
      return;
    }
    await delay(50);
  }
  throw new Error(`Route did not settle before timeout: ${expectedPath}`);
}

async function waitForSpaNavigationReady(cdp, timeoutMs = DEFAULT_ROUTE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let ready = false;
    try {
      ready = Boolean(await evaluate(
        cdp,
        'typeof Reflect.get(window, "setPage") === "function"',
      ));
    } catch (error) {
      const message = String(error?.message || error);
      if (!/execution context|cannot find context|context was destroyed/i.test(message)) throw error;
    }
    if (ready) return;
    await delay(50);
  }
  throw new Error("Canonical SPA navigation owner did not become ready before timeout.");
}

async function waitForDocumentNavigation(cdp, previousTimeOrigin, timeoutMs = DEFAULT_ROUTE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let timeOrigin = null;
    try {
      timeOrigin = Number(await evaluate(cdp, "performance.timeOrigin"));
    } catch (error) {
      const message = String(error?.message || error);
      if (!/execution context|cannot find context|context was destroyed/i.test(message)) throw error;
    }
    if (Number.isFinite(timeOrigin) && timeOrigin !== previousTimeOrigin) return;
    await delay(25);
  }
  throw new Error("Document navigation did not commit before timeout.");
}

async function resetBrowserObservers(cdp) {
  await evaluate(cdp, `(() => {
    window.__mflBaselineLongTasks = [];
    window.__mflBaselineLongAnimationFrames = [];
    window.__mflBaselineLayoutShifts = [];
    return window.__mflClientPerformance?.snapshot?.().at(-1)?.sequence || 0;
  })()`);
}

async function collectBrowserMetrics(cdp, minimumSequence, phase) {
  const value = await evaluate(cdp, `(() => {
    const table = document.querySelector("#progressionPage .playerTableScroller table");
    const body = document.getElementById("tableBody");
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    const tableRect = table instanceof HTMLElement ? table.getBoundingClientRect() : null;
    const scrollerRect = scroller instanceof HTMLElement ? scroller.getBoundingClientRect() : null;
    return {
      timeline: window.__mflClientPerformance?.snapshot?.() || [],
      longTasks: window.__mflBaselineLongTasks || [],
      longAnimationFrames: window.__mflBaselineLongAnimationFrames || [],
      layoutShifts: window.__mflBaselineLayoutShifts || [],
      tableDiagnostics: {
        renderedRows: body instanceof HTMLTableSectionElement ? body.rows.length : 0,
        renderedCells: body instanceof HTMLTableSectionElement
          ? Array.from(body.rows).reduce((total, row) => total + row.cells.length, 0)
          : 0,
        tableWidth: tableRect ? tableRect.width : 0,
        tableHeight: tableRect ? tableRect.height : 0,
        scrollerWidth: scrollerRect ? scrollerRect.width : 0,
        scrollerHeight: scrollerRect ? scrollerRect.height : 0,
        tableScrollWidth: table instanceof HTMLElement ? table.scrollWidth : 0,
        tableScrollHeight: table instanceof HTMLElement ? table.scrollHeight : 0,
      },
    };
  })()`);
  const timeline = Array.isArray(value?.timeline)
    ? value.timeline.filter((entry) => Number(entry?.sequence || 0) > minimumSequence)
    : [];
  const startPhase = phase === "cached" ? "route-transition-start" : "bootstrap-start";
  const start = timeline.find((entry) => entry?.phase === startPhase) || timeline[0] || null;
  const contentCommit = [...timeline].reverse().find((entry) => entry?.phase === "content-commit") || null;
  const settled = [...timeline].reverse().find((entry) => entry?.phase === "route-visually-settled") || null;
  const dataResponses = timeline.filter((entry) => entry?.phase === "data-response");

  const startAt = Number(start?.at);
  const usefulContentMs = Number.isFinite(startAt) && Number.isFinite(Number(contentCommit?.at))
    ? Number(contentCommit.at) - startAt
    : null;
  const settledMs = Number.isFinite(startAt) && Number.isFinite(Number(settled?.at))
    ? Number(settled.at) - startAt
    : null;

  const firstStageAt = (stage) => {
    const entry = timeline.find((candidate) => candidate?.phase === stage);
    const at = Number(entry?.at);
    return Number.isFinite(at) ? at : null;
  };
  const stageDelta = (from, to) => (
    Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from : null
  );
  const stageEntries = (stage) => timeline.filter((entry) => entry?.phase === stage);
  const summedStageDurationInWindow = (stage, from, to) => {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
    return stageEntries(stage).reduce((total, entry) => {
      const at = Number(entry?.at);
      const duration = Number(entry?.detail?.durationMs);
      return Number.isFinite(at) && at >= from && at <= to && Number.isFinite(duration)
        ? total + Math.max(0, duration)
        : total;
    }, 0);
  };
  const shellSyncStartAt = firstStageAt("route-shell-sync-start");
  const shellSyncCompleteAt = firstStageAt("route-shell-sync-complete");
  const preloaderPaintEntry = timeline.find((entry) => entry?.phase === "route-preloader-paint-complete") || null;
  const preloaderPaintAt = Number.isFinite(Number(preloaderPaintEntry?.at)) ? Number(preloaderPaintEntry.at) : null;
  const loaderCompleteAt = firstStageAt("route-loader-complete");
  const postloaderPaintAt = firstStageAt("route-postloader-paint-complete");
  const contentCommitAt = Number.isFinite(Number(contentCommit?.at)) ? Number(contentCommit.at) : null;
  const settledAt = Number.isFinite(Number(settled?.at)) ? Number(settled.at) : null;
  const settleFrameOneAt = firstStageAt("route-settle-frame-one");
  const longTasks = Array.isArray(value?.longTasks) ? value.longTasks : [];
  const settlementLongTaskMs = Number.isFinite(contentCommitAt) && Number.isFinite(settledAt)
    ? longTasks.reduce((total, entry) => {
        const startTime = Number(entry?.startTime);
        const duration = Math.max(0, Number(entry?.duration) || 0);
        if (!Number.isFinite(startTime) || !duration) return total;
        const overlapStart = Math.max(contentCommitAt, startTime);
        const overlapEnd = Math.min(settledAt, startTime + duration);
        return total + Math.max(0, overlapEnd - overlapStart);
      }, 0)
    : null;
  const settlementLoafs = Number.isFinite(contentCommitAt) && Number.isFinite(settledAt)
    ? (Array.isArray(value?.longAnimationFrames) ? value.longAnimationFrames : []).filter((entry) => {
        const startTime = Number(entry?.startTime);
        const duration = Math.max(0, Number(entry?.duration) || 0);
        return Number.isFinite(startTime)
          && duration > 0
          && startTime < settledAt
          && startTime + duration > contentCommitAt;
      })
    : [];
  const settlementLoaf = settlementLoafs.reduce((slowest, entry) => (
    !slowest || Number(entry?.duration || 0) > Number(slowest?.duration || 0) ? entry : slowest
  ), null);
  const settlementLoafScripts = Array.isArray(settlementLoaf?.scripts) ? settlementLoaf.scripts : [];
  const settlementLoafScriptMs = settlementLoafScripts.reduce(
    (total, script) => total + Math.max(0, Number(script?.duration) || 0),
    0,
  );
  const settlementLoafForcedStyleLayoutMs = settlementLoafScripts.reduce(
    (total, script) => total + Math.max(0, Number(script?.forcedStyleAndLayoutDuration) || 0),
    0,
  );
  const settlementLoafTopScript = settlementLoafScripts.reduce((slowest, script) => (
    !slowest || Number(script?.duration || 0) > Number(slowest?.duration || 0) ? script : slowest
  ), null);
  const settlementLoafEndAt = settlementLoaf
    ? Number(settlementLoaf.startTime || 0) + Math.max(0, Number(settlementLoaf.duration) || 0)
    : null;
  const settlementLoafRenderStart = Number(settlementLoaf?.renderStart);
  const settlementLoafStyleLayoutStart = Number(settlementLoaf?.styleAndLayoutStart);
  const settlementLoafRenderPhaseMs = Number.isFinite(settlementLoafEndAt)
    && Number.isFinite(settlementLoafRenderStart)
    && settlementLoafRenderStart > 0
    ? Math.max(0, settlementLoafEndAt - settlementLoafRenderStart)
    : null;
  const settlementLoafStyleLayoutPhaseMs = Number.isFinite(settlementLoafEndAt)
    && Number.isFinite(settlementLoafStyleLayoutStart)
    && settlementLoafStyleLayoutStart > 0
    ? Math.max(0, settlementLoafEndAt - settlementLoafStyleLayoutStart)
    : null;
  const releaseStartAt = Number.isFinite(postloaderPaintAt) ? postloaderPaintAt : loaderCompleteAt;
  const routeStages = phase === "cached"
    ? {
        commitPrepMs: stageDelta(startAt, shellSyncStartAt),
        shellSyncMs: stageDelta(shellSyncStartAt, shellSyncCompleteAt),
        revealPaintMs: stageDelta(shellSyncCompleteAt, preloaderPaintAt),
        preloaderPaintSkipped: preloaderPaintEntry?.detail?.skipped === true ? 1 : 0,
        loaderMs: stageDelta(preloaderPaintAt, loaderCompleteAt),
        postloaderPaintMs: stageDelta(loaderCompleteAt, postloaderPaintAt),
        releaseMs: stageDelta(releaseStartAt, contentCommitAt),
        settlePaintMs: stageDelta(contentCommitAt, settledAt),
        settleFirstFrameMs: stageDelta(contentCommitAt, settleFrameOneAt),
        settleSecondFrameMs: stageDelta(settleFrameOneAt, settledAt),
        settlementLongTaskMs,
        settlementLoafDurationMs: settlementLoaf ? Math.max(0, Number(settlementLoaf.duration) || 0) : null,
        settlementLoafBlockingMs: settlementLoaf ? Math.max(0, Number(settlementLoaf.blockingDuration) || 0) : null,
        settlementLoafScriptMs: settlementLoaf ? settlementLoafScriptMs : null,
        settlementLoafForcedStyleLayoutMs: settlementLoaf ? settlementLoafForcedStyleLayoutMs : null,
        settlementLoafRenderPhaseMs,
        settlementLoafStyleLayoutPhaseMs,
        settlementLoafTopScriptMs: settlementLoafTopScript ? Math.max(0, Number(settlementLoafTopScript.duration) || 0) : null,
        settlementLoafTopScriptLabel: settlementLoafTopScript
          ? String(
              settlementLoafTopScript.sourceFunctionName
              || settlementLoafTopScript.invoker
              || settlementLoafTopScript.sourceURL
              || "(anonymous)"
            )
          : "",
        settlePlayerImmediateMs: summedStageDurationInWindow("route-settle-player-immediate-complete", contentCommitAt, settledAt),
        settleViewFrameMs: summedStageDurationInWindow("route-settle-view-frame-complete", contentCommitAt, settledAt),
        settlePlayerFrameMs: summedStageDurationInWindow("route-settle-player-frame-complete", contentCommitAt, settledAt),
      }
    : null;

  const shellStaticStartAt = firstStageAt("route-shell-static-start");
  const shellFooterCompleteAt = firstStageAt("route-shell-footer-complete");
  const shellNavigationCompleteAt = firstStageAt("route-shell-navigation-complete");
  const shellViewsCompleteAt = firstStageAt("route-shell-views-complete");
  const shellShowStartAt = firstStageAt("route-shell-show-start");
  const shellTableChromeCompleteAt = firstStageAt("route-shell-table-chrome-complete");
  const shellPrimeCompleteAt = firstStageAt("route-shell-prime-complete");
  const shellVisibilityCompleteAt = firstStageAt("route-shell-visibility-complete");
  const shellHorizontalCuesCompleteAt = firstStageAt("route-shell-horizontal-cues-complete");
  const shellShowCompleteAt = firstStageAt("route-shell-show-complete");
  const shellStaticCompleteAt = firstStageAt("route-shell-static-complete");
  const horizontalStartAt = firstStageAt("route-shell-horizontal-start");
  const horizontalWatchlistCompleteAt = firstStageAt("route-shell-horizontal-watchlist-complete");
  const horizontalEnsureViewsCompleteAt = firstStageAt("route-shell-horizontal-ensure-views-complete");
  const horizontalViewSyncCompleteAt = firstStageAt("route-shell-horizontal-view-sync-complete");
  const horizontalPlayerSyncCompleteAt = firstStageAt("route-shell-horizontal-player-sync-complete");
  const shellStages = phase === "cached"
    ? {
        footerMs: stageDelta(shellStaticStartAt, shellFooterCompleteAt),
        navigationMs: stageDelta(shellFooterCompleteAt, shellNavigationCompleteAt),
        viewsMs: stageDelta(shellNavigationCompleteAt, shellViewsCompleteAt),
        showPreludeMs: stageDelta(shellViewsCompleteAt, shellShowStartAt),
        tableChromeMs: stageDelta(shellShowStartAt, shellTableChromeCompleteAt),
        primeMs: stageDelta(shellTableChromeCompleteAt, shellPrimeCompleteAt),
        visibilityMs: stageDelta(shellPrimeCompleteAt, shellVisibilityCompleteAt),
        horizontalCuesMs: stageDelta(shellVisibilityCompleteAt, shellHorizontalCuesCompleteAt),
        horizontalWatchlistMs: stageDelta(horizontalStartAt, horizontalWatchlistCompleteAt),
        horizontalEnsureViewsMs: stageDelta(horizontalWatchlistCompleteAt, horizontalEnsureViewsCompleteAt),
        horizontalViewSyncMs: stageDelta(horizontalEnsureViewsCompleteAt, horizontalViewSyncCompleteAt),
        horizontalPlayerSyncMs: stageDelta(horizontalViewSyncCompleteAt, horizontalPlayerSyncCompleteAt),
        horizontalMeasuredTotalMs: stageDelta(horizontalStartAt, horizontalPlayerSyncCompleteAt),
        showTailMs: stageDelta(shellHorizontalCuesCompleteAt, shellShowCompleteAt),
        staticTailMs: stageDelta(shellShowCompleteAt, shellStaticCompleteAt),
        showTotalMs: stageDelta(shellShowStartAt, shellShowCompleteAt),
        staticTotalMs: stageDelta(shellStaticStartAt, shellStaticCompleteAt),
      }
    : null;

  const loaderTraceEntry = phase === "cached"
    ? timeline.find((entry) => entry?.phase === "route-loader-request-start")
    : null;
  const loaderTraceId = String(loaderTraceEntry?.detail?.traceId || "");
  const loaderStageEntry = (stage) => {
    if (phase !== "cached") return null;
    return timeline.find((entry) => (
      entry?.phase === stage
      && (!loaderTraceId || String(entry?.detail?.traceId || "") === loaderTraceId)
    )) || null;
  };
  const loaderStageAt = (stage) => {
    const at = Number(loaderStageEntry(stage)?.at);
    return Number.isFinite(at) ? at : null;
  };
  const requestStartAt = loaderStageAt("route-loader-request-start");
  const requestCompleteAt = loaderStageAt("route-loader-request-complete");
  const outerRestoreStartAt = loaderStageAt("route-loader-outer-restore-start");
  const outerRestoreCompleteAt = loaderStageAt("route-loader-outer-restore-complete");
  const renderPageStartAt = loaderStageAt("route-loader-render-page-start");
  const pageChromeStartAt = loaderStageAt("route-loader-page-chrome-start");
  const pageChromeCompleteAt = loaderStageAt("route-loader-page-chrome-complete");
  const tableControlsStartAt = loaderStageAt("route-loader-table-controls-start");
  const tableControlsCompleteAt = loaderStageAt("route-loader-table-controls-complete");
  const quickFiltersStartAt = loaderStageAt("route-loader-quick-filters-start");
  const quickFiltersCompleteAt = loaderStageAt("route-loader-quick-filters-complete");
  const applyFiltersStartAt = loaderStageAt("route-loader-apply-filters-start");
  const filterPrepStartAt = loaderStageAt("route-loader-filter-prep-start");
  const filterSourceCompleteAt = loaderStageAt("route-loader-filter-source-complete");
  const filterRowsCompleteAt = loaderStageAt("route-loader-filter-rows-complete");
  const filterUiCompleteAt = loaderStageAt("route-loader-filter-ui-complete");
  const tableRenderStartAt = loaderStageAt("route-loader-table-render-start");
  const tableBuildCompleteEntry = loaderStageEntry("route-loader-table-build-complete");
  const tableBuildCompleteAt = loaderStageAt("route-loader-table-build-complete");
  const tableDomCommitCompleteAt = loaderStageAt("route-loader-table-dom-commit-complete");
  const tableRenderCompleteAt = loaderStageAt("route-loader-table-render-complete");
  const applyFiltersCompleteAt = loaderStageAt("route-loader-apply-filters-complete");
  const tailLoadingStartAt = loaderStageAt("route-loader-tail-loading-start");
  const tailLoadingCompleteAt = loaderStageAt("route-loader-tail-loading-complete");
  const tailNavigationCompleteAt = loaderStageAt("route-loader-tail-navigation-complete");
  const tailScrollCompleteAt = loaderStageAt("route-loader-tail-scroll-complete");
  const tailHomeSyncCompleteAt = loaderStageAt("route-loader-tail-home-sync-complete");
  const renderPageCompleteEntry = loaderStageEntry("route-loader-render-page-complete");
  const renderPageCompleteAt = loaderStageAt("route-loader-render-page-complete");
  const renderPageDirectMs = Number(renderPageCompleteEntry?.detail?.durationMs);
  const loaderStages = phase === "cached"
    ? {
        requestMs: stageDelta(requestStartAt, requestCompleteAt),
        outerRestoreMs: stageDelta(outerRestoreStartAt, outerRestoreCompleteAt),
        renderPagePreChromeMs: stageDelta(renderPageStartAt, pageChromeStartAt),
        pageChromeMs: stageDelta(pageChromeStartAt, pageChromeCompleteAt),
        tableControlsMs: stageDelta(tableControlsStartAt, tableControlsCompleteAt),
        quickFiltersMs: stageDelta(quickFiltersStartAt, quickFiltersCompleteAt),
        filterPrepMs: stageDelta(filterPrepStartAt, filterSourceCompleteAt),
        rowFilterMs: stageDelta(filterSourceCompleteAt, filterRowsCompleteAt),
        filterUiMs: stageDelta(filterRowsCompleteAt, filterUiCompleteAt),
        tableBuildMs: stageDelta(tableRenderStartAt, tableBuildCompleteAt),
        tableReused: tableBuildCompleteEntry?.detail?.reused === true ? 1 : 0,
        tableDomCommitMs: stageDelta(tableBuildCompleteAt, tableDomCommitCompleteAt),
        tablePostMs: stageDelta(tableDomCommitCompleteAt, tableRenderCompleteAt),
        applyFiltersTailMs: stageDelta(tableRenderCompleteAt, applyFiltersCompleteAt),
        tailLoadingMs: stageDelta(tailLoadingStartAt, tailLoadingCompleteAt),
        tailNavigationMs: stageDelta(tailLoadingCompleteAt, tailNavigationCompleteAt),
        tailScrollMs: stageDelta(tailNavigationCompleteAt, tailScrollCompleteAt),
        tailHomeSyncMs: stageDelta(tailScrollCompleteAt, tailHomeSyncCompleteAt),
        tailContinuationMs: stageDelta(tailHomeSyncCompleteAt, renderPageCompleteAt),
        renderPageTailMs: stageDelta(applyFiltersCompleteAt, renderPageCompleteAt),
        renderPageTotalMs: stageDelta(renderPageStartAt, renderPageCompleteAt),
        renderPageDirectMs: Number.isFinite(renderPageDirectMs) ? renderPageDirectMs : null,
        applyFiltersTotalMs: stageDelta(applyFiltersStartAt, applyFiltersCompleteAt),
        tableRenderTotalMs: stageDelta(tableRenderStartAt, tableRenderCompleteAt),
      }
    : null;

  assert(
    Number.isFinite(usefulContentMs),
    `Missing ${phase} useful-content timing; refusing to record a partial baseline sample.`,
  );
  assert(
    Number.isFinite(settledMs),
    `Missing ${phase} visually-settled timing; refusing to record a partial baseline sample.`,
  );

  const longTaskDurations = longTasks.map((entry) => Math.max(0, Number(entry?.duration) || 0));
  const layoutShifts = Array.isArray(value?.layoutShifts) ? value.layoutShifts : [];

  return {
    usefulContentMs,
    settledMs,
    longTaskCount: longTaskDurations.length,
    longTaskMs: longTaskDurations.reduce((total, duration) => total + duration, 0),
    longestTaskMs: longTaskDurations.length ? Math.max(...longTaskDurations) : 0,
    cls: layoutShifts.reduce((total, entry) => total + Math.max(0, Number(entry?.value) || 0), 0),
    routeStages,
    shellStages,
    loaderStages,
    tableDiagnostics: phase === "cached" ? (value?.tableDiagnostics || null) : null,
    dataSources: dataResponses.reduce((counts, entry) => {
      const source = String(entry?.detail?.source || "unknown");
      counts[source] = (counts[source] || 0) + 1;
      return counts;
    }, {}),
  };
}

async function applyProfile(cdp, profile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: 1,
    mobile: profile.mobile,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuRate });
  if (profile.network) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: profile.network.latency,
      downloadThroughput: profile.network.downloadThroughput,
      uploadThroughput: profile.network.uploadThroughput,
      connectionType: profile.network.connectionType,
    });
  } else {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "none",
    });
  }
}

async function runMeasuredPhase(
  cdp,
  network,
  phase,
  action,
  expectedPath,
  timeoutMs,
  progressLabel,
) {
  const minimumSequence = phase === "cached"
    ? Number(await evaluate(cdp, "window.__mflClientPerformance?.snapshot?.().at(-1)?.sequence || 0")) || 0
    : 0;
  const documentTimeOrigin = phase === "cached"
    ? null
    : Number(await evaluate(cdp, "performance.timeOrigin"));
  await resetBrowserObservers(cdp);
  const networkMetrics = network.start();
  const phaseStartedAt = Date.now();
  const label = `${progressLabel} / ${phase}`;
  console.log(`  ${label}: start`);
  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - phaseStartedAt) / 1000);
    console.log(`  ${label}: still running (${elapsedSeconds}s elapsed)`);
  }, 30_000);
  heartbeat.unref?.();

  try {
    await action();
    if (documentTimeOrigin !== null) {
      await waitForDocumentNavigation(cdp, documentTimeOrigin, timeoutMs);
    }
    await waitForRouteReady(cdp, expectedPath, timeoutMs);
    await network.waitForIdle(timeoutMs);
    const browserMetrics = await collectBrowserMetrics(cdp, minimumSequence, phase);
    const elapsedSeconds = Math.round((Date.now() - phaseStartedAt) / 1000);
    console.log(`  ${label}: complete (${elapsedSeconds}s)`);
    return { ...browserMetrics, ...networkMetrics };
  } finally {
    clearInterval(heartbeat);
    network.stop();
  }
}

async function navigateSpa(cdp, page, options) {
  const expression = `(async () => {
    const setPage = Reflect.get(window, "setPage");
    if (typeof setPage !== "function") throw new Error("Canonical setPage owner is unavailable.");
    await setPage(${JSON.stringify(page)}, true, ${JSON.stringify(options)});
    return true;
  })()`;
  await evaluate(cdp, expression);
}

function journeyBootstrapSource(journey) {
  const pageSize = Number(journey?.pageSize);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return "";
  return `(() => {
    try {
      const key = "mfl-table-filters-v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      const pages = saved && typeof saved === "object" && !Array.isArray(saved)
        && saved.pages && typeof saved.pages === "object" && !Array.isArray(saved.pages)
        ? saved.pages
        : {};
      const database = pages.database && typeof pages.database === "object" && !Array.isArray(pages.database)
        ? pages.database
        : {};
      localStorage.setItem(key, JSON.stringify({
        ...(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}),
        pages: {
          ...pages,
          database: {
            ...database,
            pageSize: ${JSON.stringify(pageSize)},
            view: "attributes",
          },
        },
      }));
    } catch {}
  })();`;
}

async function applyPreParkRenderProbe(cdp, probe) {
  const normalized = String(probe || "");
  await evaluate(cdp, `(() => {
    document.getElementById("mflBaselinePreParkProbe")?.remove();
    const probe = ${JSON.stringify(normalized)};
    if (!probe) return true;
    const style = document.createElement("style");
    style.id = "mflBaselinePreParkProbe";
    if (probe === "keep-table-layout") {
      style.textContent = "#progressionPage.mflCachedTablePageParked { content-visibility: visible !important; }";
    } else if (probe === "keep-layout-no-scroll-state") {
      style.textContent = "#progressionPage.mflCachedTablePageParked { content-visibility: visible !important; } #progressionPage .playerTableScroller td.col-name, #progressionPage .playerTableScroller td:has(> .playerNameCell) { container-type: normal !important; container-name: none !important; }";
    } else {
      throw new Error("Unknown baseline pre-park render probe: " + probe);
    }
    document.head.appendChild(style);
    return true;
  })()`);
}

async function applyCachedRenderProbe(cdp, probe) {
  const normalized = String(probe || "");
  await evaluate(cdp, `(() => {
    document.getElementById("mflBaselineRenderProbe")?.remove();
    const probe = ${JSON.stringify(normalized)};
    if (!probe) return true;
    const style = document.createElement("style");
    style.id = "mflBaselineRenderProbe";
    if (probe === "table-body-invisible") {
      style.textContent = "#tableBody { visibility: hidden !important; }";
    } else if (probe === "table-display-none") {
      style.textContent = ".playerTableScroller table { display: none !important; }";
    } else if (probe === "name-no-scroll-state") {
      style.textContent = "#progressionPage .playerTableScroller td.col-name, #progressionPage .playerTableScroller td:has(> .playerNameCell) { container-type: normal !important; container-name: none !important; }";
    } else if (probe === "name-no-sticky") {
      style.textContent = "#progressionPage .playerTableScroller :is(th.col-name, td.col-name, td:has(> .playerNameCell)) { position: static !important; left: auto !important; container-type: normal !important; container-name: none !important; }";
    } else {
      throw new Error("Unknown baseline cached render probe: " + probe);
    }
    document.head.appendChild(style);
    return true;
  })()`);
}

async function runJourney(executable, profile, journey) {
  const debuggingPort = await reserveTcpPort();
  const userDataDirectory = await mkdtemp(join(tmpdir(), "mfl-performance-baseline-"));
  const child = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1280,900",
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
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Network.enable"),
    ]);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: observerBootstrap });
    const bootstrapSource = journeyBootstrapSource(journey);
    if (bootstrapSource) {
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: bootstrapSource });
    }
    await applyProfile(cdp, profile);
    const network = createNetworkCollector(cdp);
    const targetUrl = `${baseUrl}${journey.path}`;
    const expectedPath = journey.expectedPath || journey.path;
    const routeTimeoutMs = Number(profile.routeTimeoutMs) || DEFAULT_ROUTE_TIMEOUT_MS;
    const progressLabel = `${profile.id} / ${journey.id}`;

    await cdp.send("Network.clearBrowserCache");
    const cold = await runMeasuredPhase(
      cdp,
      network,
      "cold",
      () => cdp.send("Page.navigate", { url: targetUrl }),
      expectedPath,
      routeTimeoutMs,
      progressLabel,
    );

    const refresh = await runMeasuredPhase(
      cdp,
      network,
      "refresh",
      () => cdp.send("Page.reload", { ignoreCache: false }),
      expectedPath,
      routeTimeoutMs,
      progressLabel,
    );

    await waitForSpaNavigationReady(cdp, routeTimeoutMs);
    await applyPreParkRenderProbe(cdp, journey.preParkProbe);
    await navigateSpa(cdp, "home", {});
    await waitForRouteReady(cdp, "/", routeTimeoutMs);
    await applyCachedRenderProbe(cdp, journey.cachedProbe);
    const cached = await runMeasuredPhase(
      cdp,
      network,
      "cached",
      () => navigateSpa(cdp, journey.page, journey.options),
      expectedPath,
      routeTimeoutMs,
      progressLabel,
    );

    return { cold, refresh, cached };
  } catch (error) {
    throw new Error(`${profile.id}/${journey.id}: ${error.message}\n${stderr.slice(-2000)}`, { cause: error });
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

function numericValues(runs, selector) {
  return runs
    .map(selector)
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
}

function median(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2;
}

function summarizeMetric(runs, selector) {
  const values = numericValues(runs, selector);
  return {
    median: median(values),
    slowest: values.length ? values.at(-1) : null,
  };
}

function summarizePhase(runs) {
  const serverTimingNames = new Set();
  for (const run of runs) {
    for (const name of Object.keys(run.serverTiming || {})) serverTimingNames.add(name);
  }
  const serverTiming = {};
  for (const name of serverTimingNames) {
    serverTiming[name] = summarizeMetric(
      runs,
      (run) => run.serverTiming?.[name]?.total,
    );
  }

  return {
    usefulContentMs: summarizeMetric(runs, (run) => run.usefulContentMs),
    settledMs: summarizeMetric(runs, (run) => run.settledMs),
    requestCount: summarizeMetric(runs, (run) => run.requestCount),
    apiRequestCount: summarizeMetric(runs, (run) => run.apiRequestCount),
    transferredBytes: summarizeMetric(runs, (run) => run.bytes),
    apiTransferredBytes: summarizeMetric(runs, (run) => run.apiBytes),
    longTaskCount: summarizeMetric(runs, (run) => run.longTaskCount),
    longTaskMs: summarizeMetric(runs, (run) => run.longTaskMs),
    longestTaskMs: summarizeMetric(runs, (run) => run.longestTaskMs),
    cls: summarizeMetric(runs, (run) => run.cls),
    tableDiagnostics: {
      renderedRows: summarizeMetric(runs, (run) => run.tableDiagnostics?.renderedRows),
      renderedCells: summarizeMetric(runs, (run) => run.tableDiagnostics?.renderedCells),
      tableWidth: summarizeMetric(runs, (run) => run.tableDiagnostics?.tableWidth),
      tableHeight: summarizeMetric(runs, (run) => run.tableDiagnostics?.tableHeight),
      tableScrollWidth: summarizeMetric(runs, (run) => run.tableDiagnostics?.tableScrollWidth),
      tableScrollHeight: summarizeMetric(runs, (run) => run.tableDiagnostics?.tableScrollHeight),
    },
    routeStages: {
      commitPrepMs: summarizeMetric(runs, (run) => run.routeStages?.commitPrepMs),
      shellSyncMs: summarizeMetric(runs, (run) => run.routeStages?.shellSyncMs),
      revealPaintMs: summarizeMetric(runs, (run) => run.routeStages?.revealPaintMs),
      preloaderPaintSkipped: summarizeMetric(runs, (run) => run.routeStages?.preloaderPaintSkipped),
      loaderMs: summarizeMetric(runs, (run) => run.routeStages?.loaderMs),
      postloaderPaintMs: summarizeMetric(runs, (run) => run.routeStages?.postloaderPaintMs),
      releaseMs: summarizeMetric(runs, (run) => run.routeStages?.releaseMs),
      settlePaintMs: summarizeMetric(runs, (run) => run.routeStages?.settlePaintMs),
      settleFirstFrameMs: summarizeMetric(runs, (run) => run.routeStages?.settleFirstFrameMs),
      settleSecondFrameMs: summarizeMetric(runs, (run) => run.routeStages?.settleSecondFrameMs),
      settlementLongTaskMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLongTaskMs),
      settlementLoafDurationMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafDurationMs),
      settlementLoafBlockingMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafBlockingMs),
      settlementLoafScriptMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafScriptMs),
      settlementLoafForcedStyleLayoutMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafForcedStyleLayoutMs),
      settlementLoafRenderPhaseMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafRenderPhaseMs),
      settlementLoafStyleLayoutPhaseMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafStyleLayoutPhaseMs),
      settlementLoafTopScriptMs: summarizeMetric(runs, (run) => run.routeStages?.settlementLoafTopScriptMs),
      settlementLoafTopScriptLabel: runs
        .map((run) => String(run.routeStages?.settlementLoafTopScriptLabel || ""))
        .find(Boolean) || "",
      settlePlayerImmediateMs: summarizeMetric(runs, (run) => run.routeStages?.settlePlayerImmediateMs),
      settleViewFrameMs: summarizeMetric(runs, (run) => run.routeStages?.settleViewFrameMs),
      settlePlayerFrameMs: summarizeMetric(runs, (run) => run.routeStages?.settlePlayerFrameMs),
    },
    shellStages: {
      footerMs: summarizeMetric(runs, (run) => run.shellStages?.footerMs),
      navigationMs: summarizeMetric(runs, (run) => run.shellStages?.navigationMs),
      viewsMs: summarizeMetric(runs, (run) => run.shellStages?.viewsMs),
      showPreludeMs: summarizeMetric(runs, (run) => run.shellStages?.showPreludeMs),
      tableChromeMs: summarizeMetric(runs, (run) => run.shellStages?.tableChromeMs),
      primeMs: summarizeMetric(runs, (run) => run.shellStages?.primeMs),
      visibilityMs: summarizeMetric(runs, (run) => run.shellStages?.visibilityMs),
      horizontalCuesMs: summarizeMetric(runs, (run) => run.shellStages?.horizontalCuesMs),
      horizontalWatchlistMs: summarizeMetric(runs, (run) => run.shellStages?.horizontalWatchlistMs),
      horizontalEnsureViewsMs: summarizeMetric(runs, (run) => run.shellStages?.horizontalEnsureViewsMs),
      horizontalViewSyncMs: summarizeMetric(runs, (run) => run.shellStages?.horizontalViewSyncMs),
      horizontalPlayerSyncMs: summarizeMetric(runs, (run) => run.shellStages?.horizontalPlayerSyncMs),
      horizontalMeasuredTotalMs: summarizeMetric(runs, (run) => run.shellStages?.horizontalMeasuredTotalMs),
      showTailMs: summarizeMetric(runs, (run) => run.shellStages?.showTailMs),
      staticTailMs: summarizeMetric(runs, (run) => run.shellStages?.staticTailMs),
      showTotalMs: summarizeMetric(runs, (run) => run.shellStages?.showTotalMs),
      staticTotalMs: summarizeMetric(runs, (run) => run.shellStages?.staticTotalMs),
    },
    loaderStages: {
      requestMs: summarizeMetric(runs, (run) => run.loaderStages?.requestMs),
      outerRestoreMs: summarizeMetric(runs, (run) => run.loaderStages?.outerRestoreMs),
      renderPagePreChromeMs: summarizeMetric(runs, (run) => run.loaderStages?.renderPagePreChromeMs),
      pageChromeMs: summarizeMetric(runs, (run) => run.loaderStages?.pageChromeMs),
      tableControlsMs: summarizeMetric(runs, (run) => run.loaderStages?.tableControlsMs),
      quickFiltersMs: summarizeMetric(runs, (run) => run.loaderStages?.quickFiltersMs),
      filterPrepMs: summarizeMetric(runs, (run) => run.loaderStages?.filterPrepMs),
      rowFilterMs: summarizeMetric(runs, (run) => run.loaderStages?.rowFilterMs),
      filterUiMs: summarizeMetric(runs, (run) => run.loaderStages?.filterUiMs),
      tableBuildMs: summarizeMetric(runs, (run) => run.loaderStages?.tableBuildMs),
      tableReused: summarizeMetric(runs, (run) => run.loaderStages?.tableReused),
      tableDomCommitMs: summarizeMetric(runs, (run) => run.loaderStages?.tableDomCommitMs),
      tablePostMs: summarizeMetric(runs, (run) => run.loaderStages?.tablePostMs),
      applyFiltersTailMs: summarizeMetric(runs, (run) => run.loaderStages?.applyFiltersTailMs),
      tailLoadingMs: summarizeMetric(runs, (run) => run.loaderStages?.tailLoadingMs),
      tailNavigationMs: summarizeMetric(runs, (run) => run.loaderStages?.tailNavigationMs),
      tailScrollMs: summarizeMetric(runs, (run) => run.loaderStages?.tailScrollMs),
      tailHomeSyncMs: summarizeMetric(runs, (run) => run.loaderStages?.tailHomeSyncMs),
      tailContinuationMs: summarizeMetric(runs, (run) => run.loaderStages?.tailContinuationMs),
      renderPageTailMs: summarizeMetric(runs, (run) => run.loaderStages?.renderPageTailMs),
      renderPageTotalMs: summarizeMetric(runs, (run) => run.loaderStages?.renderPageTotalMs),
      renderPageDirectMs: summarizeMetric(runs, (run) => run.loaderStages?.renderPageDirectMs),
      applyFiltersTotalMs: summarizeMetric(runs, (run) => run.loaderStages?.applyFiltersTotalMs),
      tableRenderTotalMs: summarizeMetric(runs, (run) => run.loaderStages?.tableRenderTotalMs),
    },
    serverTiming,
  };
}

function round(value, digits = 1) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(digits);
}

function kib(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return round(Number(value) / 1024, 1);
}

function printSummary(summary) {
  console.log("\nPerformance baseline summary (median / observed slowest)");
  console.log("Synthetic throttling describes the client profile only; fixture/CI latency must not be presented as production latency.");
  console.log("");
  console.log("| Profile | Journey | Phase | Useful ms | Settled ms | Requests | API req | KiB | API KiB | Long-task ms | CLS |");
  console.log("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      for (const phase of ["cold", "refresh", "cached"]) {
        const row = summary[profile][journey][phase];
        const pair = (metric, formatter = round) => `${formatter(metric.median)} / ${formatter(metric.slowest)}`;
        console.log(
          `| ${profile} | ${journey} | ${phase} | ${pair(row.usefulContentMs)} | ${pair(row.settledMs)} | ${pair(row.requestCount, (value) => round(value, 0))} | ${pair(row.apiRequestCount, (value) => round(value, 0))} | ${pair(row.transferredBytes, kib)} | ${pair(row.apiTransferredBytes, kib)} | ${pair(row.longTaskMs)} | ${pair(row.cls, (value) => round(value, 4))} |`,
        );
      }
    }
  }

  console.log("\nCached SPA stage breakdown (median / observed slowest)");
  console.log("| Profile | Journey | Commit prep ms | Shell sync ms | Reveal wait ms | Preloader wait skipped | Loader ms | Loading paint ms | Release ms | Settle paint ms |");
  console.log("| --- | --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.routeStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      const preloaderSkipped = stages.preloaderPaintSkipped.median >= 0.5 ? "yes" : "no";
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.commitPrepMs)} | ${pair(stages.shellSyncMs)} | ${pair(stages.revealPaintMs)} | ${preloaderSkipped} | ${pair(stages.loaderMs)} | ${pair(stages.postloaderPaintMs)} | ${pair(stages.releaseMs)} | ${pair(stages.settlePaintMs)} |`,
      );
    }
  }

  console.log("\nCached settlement breakdown (median / observed slowest)");
  console.log("| Profile | Journey | Commit → frame 1 ms | Frame 1 → frame 2 ms | Settlement long-task ms | Player immediate ms | View frame ms | Player frame ms |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.routeStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.settleFirstFrameMs)} | ${pair(stages.settleSecondFrameMs)} | ${pair(stages.settlementLongTaskMs)} | ${pair(stages.settlePlayerImmediateMs)} | ${pair(stages.settleViewFrameMs)} | ${pair(stages.settlePlayerFrameMs)} |`,
      );
    }
  }

  console.log("\nCached settlement long-animation-frame breakdown (median / observed slowest)");
  console.log("| Profile | Journey | LoAF ms | Blocking ms | Script ms | Forced style/layout ms | Render phase ms | Style/layout→end ms | Top script ms | Top script |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.routeStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.settlementLoafDurationMs)} | ${pair(stages.settlementLoafBlockingMs)} | ${pair(stages.settlementLoafScriptMs)} | ${pair(stages.settlementLoafForcedStyleLayoutMs)} | ${pair(stages.settlementLoafRenderPhaseMs)} | ${pair(stages.settlementLoafStyleLayoutPhaseMs)} | ${pair(stages.settlementLoafTopScriptMs)} | ${stages.settlementLoafTopScriptLabel || "-"} |`,
      );
    }
  }

  console.log("\nCached shell sync breakdown (median / observed slowest)");
  console.log("| Profile | Journey | Footer ms | Navigation ms | Views ms | Table chrome ms | Prime ms | Visibility ms | Horizontal cues ms | Show total ms | Static total ms |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.shellStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.footerMs)} | ${pair(stages.navigationMs)} | ${pair(stages.viewsMs)} | ${pair(stages.tableChromeMs)} | ${pair(stages.primeMs)} | ${pair(stages.visibilityMs)} | ${pair(stages.horizontalCuesMs)} | ${pair(stages.showTotalMs)} | ${pair(stages.staticTotalMs)} |`,
      );
    }
  }

  console.log("\nCached horizontal cue breakdown (median / observed slowest)");
  console.log("| Profile | Journey | Watchlist ms | Ensure views ms | View sync ms | Player sync ms | Measured total ms |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.shellStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.horizontalWatchlistMs)} | ${pair(stages.horizontalEnsureViewsMs)} | ${pair(stages.horizontalViewSyncMs)} | ${pair(stages.horizontalPlayerSyncMs)} | ${pair(stages.horizontalMeasuredTotalMs)} |`,
      );
    }
  }

  console.log("\nCached loader overview (median / observed slowest)");
  console.log("| Profile | Journey | Cache apply ms | Outer restore ms | Render pre-chrome ms | Page chrome ms | Table controls ms | Quick filters ms | RenderPage total ms | RenderPage direct ms |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.loaderStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.requestMs)} | ${pair(stages.outerRestoreMs)} | ${pair(stages.renderPagePreChromeMs)} | ${pair(stages.pageChromeMs)} | ${pair(stages.tableControlsMs)} | ${pair(stages.quickFiltersMs)} | ${pair(stages.renderPageTotalMs)} | ${pair(stages.renderPageDirectMs)} |`,
      );
    }
  }

  console.log("\nCached filter/render breakdown (median / observed slowest)");
  console.log("| Profile | Journey | ApplyFilters total ms | Filter prep ms | Row filter ms | Filter UI ms | Table render total ms | Table build ms | Body reused | DOM commit ms | Table post ms | Apply tail ms | Page tail ms |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.loaderStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      const reused = stages.tableReused.median >= 0.5 ? "yes" : "no";
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.applyFiltersTotalMs)} | ${pair(stages.filterPrepMs)} | ${pair(stages.rowFilterMs)} | ${pair(stages.filterUiMs)} | ${pair(stages.tableRenderTotalMs)} | ${pair(stages.tableBuildMs)} | ${reused} | ${pair(stages.tableDomCommitMs)} | ${pair(stages.tablePostMs)} | ${pair(stages.applyFiltersTailMs)} | ${pair(stages.renderPageTailMs)} |`,
      );
    }
  }

  console.log("\nCached table diagnostics (median / observed slowest)");
  console.log("| Profile | Journey | Rows | Cells | Table width | Table height | Scroll width | Scroll height |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const diagnostics = summary[profile][journey].cached.tableDiagnostics;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(diagnostics.renderedRows)} | ${pair(diagnostics.renderedCells)} | ${pair(diagnostics.tableWidth)} | ${pair(diagnostics.tableHeight)} | ${pair(diagnostics.tableScrollWidth)} | ${pair(diagnostics.tableScrollHeight)} |`,
      );
    }
  }

  console.log("\nCached renderPage tail breakdown (median / observed slowest)");
  console.log("| Profile | Journey | Loading finish ms | Navigation guard ms | Scroll reset ms | Home sync ms | Async continuation ms |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const profile of Object.keys(summary)) {
    for (const journey of Object.keys(summary[profile])) {
      const stages = summary[profile][journey].cached.loaderStages;
      const pair = (metric) => `${round(metric.median)} / ${round(metric.slowest)}`;
      console.log(
        `| ${profile} | ${journey} | ${pair(stages.tailLoadingMs)} | ${pair(stages.tailNavigationMs)} | ${pair(stages.tailScrollMs)} | ${pair(stages.tailHomeSyncMs)} | ${pair(stages.tailContinuationMs)} |`,
      );
    }
  }
}

function emptyRaw(journeys) {
  const raw = {};
  for (const profile of profiles) {
    raw[profile.id] = {};
    for (const journey of journeys) {
      raw[profile.id][journey.id] = { cold: [], refresh: [], cached: [] };
    }
  }
  return raw;
}

function normalizeRawShape(raw, journeys) {
  const normalized = emptyRaw(journeys);
  for (const profile of profiles) {
    for (const journey of journeys) {
      const source = raw?.[profile.id]?.[journey.id];
      const completed = Math.min(
        Array.isArray(source?.cold) ? source.cold.length : 0,
        Array.isArray(source?.refresh) ? source.refresh.length : 0,
        Array.isArray(source?.cached) ? source.cached.length : 0,
        repetitions,
      );
      for (const phase of ["cold", "refresh", "cached"]) {
        normalized[profile.id][journey.id][phase] = Array.isArray(source?.[phase])
          ? source[phase].slice(0, completed)
          : [];
      }
    }
  }
  return normalized;
}

function completedRunCount(raw, journeys) {
  let total = 0;
  for (const profile of profiles) {
    for (const journey of journeys) {
      total += Math.min(
        raw?.[profile.id]?.[journey.id]?.cold?.length || 0,
        raw?.[profile.id]?.[journey.id]?.refresh?.length || 0,
        raw?.[profile.id]?.[journey.id]?.cached?.length || 0,
      );
    }
  }
  return total;
}

function buildSummary(raw) {
  const summary = {};
  for (const profile of Object.keys(raw)) {
    summary[profile] = {};
    for (const journey of Object.keys(raw[profile])) {
      summary[profile][journey] = {};
      for (const phase of ["cold", "refresh", "cached"]) {
        summary[profile][journey][phase] = summarizePhase(raw[profile][journey][phase]);
      }
    }
  }
  return summary;
}

function baselineResumeKey(entities, journeys, targetContext) {
  return JSON.stringify({
    schemaVersion: BASELINE_SCHEMA_VERSION,
    baseUrl,
    environmentLabel,
    repetitions,
    profiles: profiles.map((profile) => profile.id),
    journeys: journeys.map(({ id, path, expectedPath = path, pageSize = null, cachedProbe = "", preParkProbe = "" }) => ({
      id,
      path,
      expectedPath,
      pageSize,
      cachedProbe,
      preParkProbe,
    })),
    representativeEntities: entities,
    targetContext,
  });
}

function buildReport(raw, entities, journeys, targetContext, complete) {
  return {
    metadata: {
      schemaVersion: BASELINE_SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      baseUrl,
      environmentLabel,
      repetitions,
      profiles: profiles.map((profile) => profile.id),
      journeys: journeys.map(({ id, path, expectedPath = path, pageSize = null, cachedProbe = "", preParkProbe = "" }) => ({
      id,
      path,
      expectedPath,
      pageSize,
      cachedProbe,
      preParkProbe,
    })),
      representativeEntities: entities,
      targetContext,
      completedRuns: completedRunCount(raw, journeys),
      complete,
      resumeKey: baselineResumeKey(entities, journeys, targetContext),
      note: "Real browser measurements against the configured base URL. Throttled profiles simulate client constraints; local/CI fixture latency must not be described as production latency.",
    },
    summary: buildSummary(raw),
    raw,
  };
}

async function writeCheckpoint(raw, entities, journeys, targetContext, complete = false) {
  if (!outputPath) return;
  const report = buildReport(raw, entities, journeys, targetContext, complete);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function loadCheckpoint(entities, journeys, targetContext) {
  if (!outputPath) return null;
  try {
    const parsed = JSON.parse(await readFile(outputPath, "utf8"));
    if (parsed?.metadata?.resumeKey !== baselineResumeKey(entities, journeys, targetContext)) {
      console.log(`Existing ${outputPath} does not match this baseline configuration; starting a new capture.`);
      return null;
    }
    const resumed = normalizeRawShape(parsed?.raw, journeys);
    const completed = completedRunCount(resumed, journeys);
    if (completed > 0) {
      console.log(`Resuming ${completed} completed journey repetitions from ${outputPath}.`);
    }
    return resumed;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.log(`Could not resume ${outputPath}: ${String(error?.message || error)}. Starting a new capture.`);
    }
    return null;
  }
}

const executable = browserExecutable();
const targetContext = await baselineTargetContext(executable);
console.log("Performance baseline context");
console.log(JSON.stringify({
  baseUrl,
  environmentLabel,
  repetitions,
  profiles: profiles.map((profile) => profile.id),
  sourceCommit: targetContext.sourceCommit,
  sourceRef: targetContext.sourceRef,
  datasetGeneratedAt: targetContext.datasetGeneratedAt,
  datasetRowCount: targetContext.datasetRowCount,
  datasetWalletCount: targetContext.datasetWalletCount,
  accessContext: targetContext.accessContext,
  browserVersion: targetContext.browserVersion,
  nodeVersion: targetContext.nodeVersion,
  platform: targetContext.platform,
}, null, 2));
const entities = await discoverRepresentativeEntities();
const journeys = selectedJourneys(journeysFor(entities));
const raw = (await loadCheckpoint(entities, journeys, targetContext)) || emptyRaw(journeys);

for (const profile of profiles) {
  for (const journey of journeys) {
    const completed = Math.min(
      raw[profile.id][journey.id].cold.length,
      raw[profile.id][journey.id].refresh.length,
      raw[profile.id][journey.id].cached.length,
    );
    for (let repetition = completed + 1; repetition <= repetitions; repetition += 1) {
      console.log(`Baseline ${profile.id} / ${journey.id} / run ${repetition} of ${repetitions}`);
      const result = await runJourney(executable, profile, journey);
      for (const phase of ["cold", "refresh", "cached"]) {
        raw[profile.id][journey.id][phase].push(result[phase]);
      }
      await writeCheckpoint(raw, entities, journeys, targetContext, false);
    }
  }
}

const summary = buildSummary(raw);
printSummary(summary);
if (outputPath) {
  await writeCheckpoint(raw, entities, journeys, targetContext, true);
  console.log(`\nWrote full baseline report to ${outputPath}`);
} else {
  console.log("\nSet MFL_BASELINE_OUTPUT to persist and resume the full JSON report.");
}