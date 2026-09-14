import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

const targetUrl = String(process.argv[2] || "").trim();
assert(targetUrl, "Next rendered-shell browser probe requires a target URL.");

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
  throw new Error("Next rendered-shell browser probe requires Chrome or Chromium on PATH.");
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
          ? targets.find((entry) => entry?.type === "page" && String(entry?.url || "").startsWith(targetUrl))
          : null;
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      // Chrome may not have exposed the debugging target yet.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Chrome debugging target did not become ready.");
}

async function connectCdp(webSocketUrl) {
  assert(typeof WebSocket === "function", "Node runtime must expose WebSocket for the Chrome DevTools Protocol.");
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

async function waitForRenderedShell(cdp) {
  const deadline = Date.now() + 20_000;
  let lastValue = null;
  while (Date.now() < deadline) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const portals = Array.from(document.querySelectorAll("nextjs-portal"));
        const portalStates = portals.map((portal) => {
          const shadow = portal.shadowRoot || null;
          const indicator = shadow?.querySelector("#devtools-indicator, [data-next-badge], [data-indicator-status], [data-next-mark-loading]");
          return {
            hasShadow: Boolean(shadow),
            indicator: Boolean(indicator),
            elementCount: shadow?.querySelectorAll("*").length || 0,
            tail: String(shadow?.innerHTML || "").slice(-1800),
          };
        });
        return {
          nextMount: Boolean(document.querySelector("body > #__next")),
          appShell: Boolean(document.querySelector("body > #appShell")),
          topbar: Boolean(document.querySelector("body > .topbar")),
          modal: Boolean(document.querySelector("body > .modalBackdrop")),
          portal: portals.length > 0,
          portalCount: portals.length,
          badge: portalStates.some((state) => state.indicator),
          indicatorPosition: String(window.__NEXT_DEV_INDICATOR_POSITION || ""),
          nextDevClientId: window.__nextDevClientId ?? null,
          nextDataPage: String(window.__NEXT_DATA__?.page || ""),
          nextVersion: String(window.next?.version || ""),
          nextRouterReady: Boolean(window.next?.router),
          readyState: document.readyState,
          nextScripts: Array.from(document.scripts)
            .map((script) => String(script.src || ""))
            .filter((src) => src.includes("/_next/"))
            .slice(-12),
          portalStates,
        };
      })()`,
      returnByValue: true,
    });
    const value = evaluation?.result?.value;
    lastValue = value;
    if (value?.nextMount && value?.appShell && value?.topbar && value?.modal && value?.portal && value?.badge) {
      return value;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Next-rendered shell or development indicator did not become available before timeout. Last state: ${JSON.stringify(lastValue)}`);
}

const executable = browserExecutable();
const debuggingPort = await reserveTcpPort();
const userDataDirectory = await mkdtemp(join(tmpdir(), "mfl-next-rendered-shell-"));
const child = spawn(executable, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--window-size=1280,900",
  `--remote-debugging-port=${debuggingPort}`,
  "--remote-debugging-address=127.0.0.1",
  `--user-data-dir=${userDataDirectory}`,
  targetUrl,
], { stdio: ["ignore", "ignore", "pipe"] });

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { stderr += chunk; });
let cdp = null;

try {
  const target = await waitForPageTarget(debuggingPort);
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  const state = await waitForRenderedShell(cdp);
  console.log(`Next-rendered shell browser probe passed: ${JSON.stringify(state)}`);
} catch (error) {
  throw new Error(`${error.message}\n${stderr.slice(-2000)}`, { cause: error });
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
