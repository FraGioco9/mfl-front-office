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
const outputPath = String(process.env.MFL_BASELINE_OUTPUT || "").trim();

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
  const requests = new Map();

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
    const bytes = Math.max(0, Number(encodedDataLength) || 0);
    current.bytes += bytes;
    if (request?.api) current.apiBytes += bytes;
  });

  return Object.freeze({
    start() {
      requests.clear();
      current = {
        requestCount: 0,
        apiRequestCount: 0,
        bytes: 0,
        apiBytes: 0,
        serverTiming: {},
      };
      return current;
    },
    stop() {
      const completed = current;
      current = null;
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

async function resetBrowserObservers(cdp) {
  await evaluate(cdp, `(() => {
    window.__mflBaselineLongTasks = [];
    window.__mflBaselineLayoutShifts = [];
    return window.__mflClientPerformance?.snapshot?.().at(-1)?.sequence || 0;
  })()`);
}

async function collectBrowserMetrics(cdp, minimumSequence, phase) {
  const value = await evaluate(cdp, `(() => ({
    timeline: window.__mflClientPerformance?.snapshot?.() || [],
    longTasks: window.__mflBaselineLongTasks || [],
    layoutShifts: window.__mflBaselineLayoutShifts || []
  }))()`);
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

  const longTasks = Array.isArray(value?.longTasks) ? value.longTasks : [];
  const longTaskDurations = longTasks.map((entry) => Math.max(0, Number(entry?.duration) || 0));
  const layoutShifts = Array.isArray(value?.layoutShifts) ? value.layoutShifts : [];

  return {
    usefulContentMs,
    settledMs,
    longTaskCount: longTaskDurations.length,
    longTaskMs: longTaskDurations.reduce((total, duration) => total + duration, 0),
    longestTaskMs: longTaskDurations.length ? Math.max(...longTaskDurations) : 0,
    cls: layoutShifts.reduce((total, entry) => total + Math.max(0, Number(entry?.value) || 0), 0),
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

async function runMeasuredPhase(cdp, network, phase, action, expectedPath, timeoutMs) {
  const minimumSequence = phase === "cached"
    ? Number(await evaluate(cdp, "window.__mflClientPerformance?.snapshot?.().at(-1)?.sequence || 0")) || 0
    : 0;
  await resetBrowserObservers(cdp);
  const networkMetrics = network.start();
  await action();
  await waitForRouteReady(cdp, expectedPath, timeoutMs);
  const browserMetrics = await collectBrowserMetrics(cdp, minimumSequence, phase);
  network.stop();
  return { ...browserMetrics, ...networkMetrics };
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
    await applyProfile(cdp, profile);
    const network = createNetworkCollector(cdp);
    const targetUrl = `${baseUrl}${journey.path}`;
    const expectedPath = journey.expectedPath || journey.path;
    const routeTimeoutMs = Number(profile.routeTimeoutMs) || DEFAULT_ROUTE_TIMEOUT_MS;

    await cdp.send("Network.clearBrowserCache");
    const cold = await runMeasuredPhase(
      cdp,
      network,
      "cold",
      () => cdp.send("Page.navigate", { url: targetUrl }),
      expectedPath,
      routeTimeoutMs,
    );

    const refresh = await runMeasuredPhase(
      cdp,
      network,
      "refresh",
      () => cdp.send("Page.reload", { ignoreCache: false }),
      expectedPath,
      routeTimeoutMs,
    );

    await waitForSpaNavigationReady(cdp, routeTimeoutMs);
    await navigateSpa(cdp, "home", {});
    await waitForRouteReady(cdp, "/", routeTimeoutMs);
    const cached = await runMeasuredPhase(
      cdp,
      network,
      "cached",
      () => navigateSpa(cdp, journey.page, journey.options),
      expectedPath,
      routeTimeoutMs,
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
    serverTiming,
  };
}

function round(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return "-";
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

function baselineResumeKey(entities, journeys) {
  return JSON.stringify({
    baseUrl,
    environmentLabel,
    repetitions,
    profiles: profiles.map((profile) => profile.id),
    journeys: journeys.map(({ id, path, expectedPath = path }) => ({ id, path, expectedPath })),
    representativeEntities: entities,
  });
}

function buildReport(raw, entities, journeys, complete) {
  return {
    metadata: {
      capturedAt: new Date().toISOString(),
      baseUrl,
      environmentLabel,
      repetitions,
      profiles: profiles.map((profile) => profile.id),
      journeys: journeys.map(({ id, path, expectedPath = path }) => ({ id, path, expectedPath })),
      representativeEntities: entities,
      completedRuns: completedRunCount(raw, journeys),
      complete,
      resumeKey: baselineResumeKey(entities, journeys),
      note: "Real browser measurements against the configured base URL. Throttled profiles simulate client constraints; do not describe fixture/CI latency as production latency.",
    },
    summary: buildSummary(raw),
    raw,
  };
}

async function writeCheckpoint(raw, entities, journeys, complete = false) {
  if (!outputPath) return;
  const report = buildReport(raw, entities, journeys, complete);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function loadCheckpoint(entities, journeys) {
  if (!outputPath) return null;
  try {
    const parsed = JSON.parse(await readFile(outputPath, "utf8"));
    if (parsed?.metadata?.resumeKey !== baselineResumeKey(entities, journeys)) {
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
const entities = await discoverRepresentativeEntities();
const journeys = journeysFor(entities);
const raw = (await loadCheckpoint(entities, journeys)) || emptyRaw(journeys);

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
      await writeCheckpoint(raw, entities, journeys, false);
    }
  }
}

const summary = buildSummary(raw);
printSummary(summary);
if (outputPath) {
  await writeCheckpoint(raw, entities, journeys, true);
  console.log(`\nWrote full baseline report to ${outputPath}`);
} else {
  console.log("\nSet MFL_BASELINE_OUTPUT to persist and resume the full JSON report.");
}
