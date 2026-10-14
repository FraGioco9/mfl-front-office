import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer as createNetServer } from "node:net";

export function browserExecutable(failureMessage) {
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
  throw new Error(failureMessage);
}

export async function reserveTcpPort() {
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

export async function waitForPageTarget(port, targetUrlPrefix = "") {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = Array.isArray(targets)
          ? targets.find((entry) => entry?.type === "page" && String(entry?.url || "").startsWith(targetUrlPrefix))
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

export async function connectCdp(webSocketUrl, missingWebSocketMessage, defaultTimeoutMs = 0, events = false) {
  assert(typeof WebSocket === "function", missingWebSocketMessage);
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  const listeners = events ? new Map() : null;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message?.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (defaultTimeoutMs) clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result || {});
      return;
    }
    const handlers = listeners?.get(String(message?.method || ""));
    if (!handlers) return;
    for (const handler of handlers) handler(message.params || {});
  });

  return {
    send(method, params = {}, timeoutMs = defaultTimeoutMs) {
      const id = ++sequence;
      return new Promise((resolvePromise, rejectPromise) => {
        const timer = defaultTimeoutMs ? setTimeout(() => {
          pending.delete(id);
          rejectPromise(new Error(`Chrome DevTools request timed out: ${method}`));
        }, timeoutMs) : null;
        pending.set(id, { resolve: resolvePromise, reject: rejectPromise, timer });
        if (!defaultTimeoutMs) return socket.send(JSON.stringify({ id, method, params }));
        try {
          socket.send(JSON.stringify({ id, method, params }));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          rejectPromise(error);
        }
      });
    },
    ...(events ? { on(method, handler) {
      const handlers = listeners.get(method) || new Set();
      handlers.add(handler);
      listeners.set(method, handlers);
      return () => handlers.delete(handler);
    } } : {}),
    close() {
      socket.close();
    },
  };
}


export async function startChromium({ executable, prefix, target, flags = [], stderrText = true }) {
  const port = await reserveTcpPort();
  const profile = await mkdtemp(join(tmpdir(), prefix));
  const child = spawn(executable, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    ...flags, `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, target],
    { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  if (stderrText) child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { stderr += stderrText ? chunk : String(chunk).slice(-4000); });
  return { port, profile, child, stderr: () => stderr };
}

export async function stopChromium({ child, cdp, profile, signal = "SIGKILL" }) {
  cdp?.close();
  if (signal === "SIGTERM") child.kill("SIGTERM");
  else if (child.exitCode === null) await new Promise(resolvePromise => {
    child.once("close", resolvePromise);
    child.kill("SIGKILL");
  });
  await rm(profile, signal === "SIGTERM"
    ? { force: true, recursive: true, maxRetries: 5, retryDelay: 100 }
    : { recursive: true, force: true });
}
