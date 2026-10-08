// Real-browser Evaluation interaction smoke against the production Next build.
// The Site quality job starts the local server; this test never touches Vercel.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

const base = new URL(process.argv[2] || "http://127.0.0.1:4010/");
assert(["127.0.0.1", "localhost", "::1", "[::1]"].includes(base.hostname),
  "Evaluation browser smoke must target a local Next build.");

const browser = [
  process.env.CHROME_PATH, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
].filter(Boolean).find((candidate) => {
  const result = spawnSync(candidate, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
});
assert(browser, "Evaluation browser smoke requires Chrome/Chromium.");

const tcp = createNetServer();
await new Promise((resolve, reject) => {
  tcp.once("error", reject);
  tcp.listen(0, "127.0.0.1", resolve);
});
const debugPort = tcp.address().port;
await new Promise((resolve) => tcp.close(resolve));
const profile = await mkdtemp(join(tmpdir(), "mfl-evaluation-next-browser-"));
const target = new URL("/evaluation", base).toString();
const child = spawn(browser, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--window-size=1280,900", `--remote-debugging-port=${debugPort}`,
  "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, target,
], { stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(-4000); });
let socket;
try {
  let page;
  const deadline = Date.now() + 15000;
  while (!page && Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) {
        const tabs = await response.json();
        page = tabs.find((tab) => tab.type === "page" && tab.url.startsWith(target));
      }
    } catch { /* Debug endpoint may not be ready yet. */ }
    if (!page?.webSocketDebuggerUrl) {
      page = null;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert(page?.webSocketDebuggerUrl, `Could not start Evaluation Chrome: ${stderr}`);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
    else callback.resolve(message.result || {});
  });
  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  await send("Runtime.enable");
  await send("Page.enable");
  async function readyEvaluation(label) {
    const timeout = Date.now() + 20000;
    let last = null;
    while (Date.now() < timeout) {
      try {
        const result = await send("Runtime.evaluate", {
          expression: `(() => {
            const page = document.getElementById("evaluationPage");
            const input = document.getElementById("evaluationSearchInput");
            const rect = input?.getBoundingClientRect();
            return {
              ready: document.readyState,
              routeReady: document.documentElement.dataset.mflRouteReady || "",
              pageName: document.body.dataset.page || "",
              shown: page instanceof HTMLElement && !page.hidden,
              inputVisible: input instanceof HTMLInputElement && !input.disabled
                && Boolean(rect?.width > 10 && rect?.height > 10),
              corePresent: document.documentElement.dataset.mflRouteReady === "true",
              title: document.title,
            };
          })()`,
          returnByValue: true,
        });
        if (result.exceptionDetails) throw Error("Evaluation browser expression failed");
        const value = result.result?.value;
        last = value;
        if (value?.ready === "complete" && value?.pageName === "evaluation"
          && value?.shown && value?.inputVisible && value?.corePresent) return value;
      } catch { /* Navigation can replace the previous JS context. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error(`${label} Evaluation did not hydrate to an interactive search screen. Last: ${JSON.stringify(last)}`);
  }
  await readyEvaluation("desktop");
  const focus = await send("Runtime.evaluate", {
    expression: `(() => { const input = document.getElementById("evaluationSearchInput"); input?.focus(); return document.activeElement === input; })()`,
    returnByValue: true,
  });
  assert.equal(focus.result?.value, true, "Desktop Evaluation search must accept keyboard focus.");

  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, screenWidth: 390, screenHeight: 844, deviceScaleFactor: 3, mobile: true,
  });
  await send("Page.reload", { ignoreCache: true });
  await readyEvaluation("phone");
  console.log("Compiled Next Evaluation browser interaction passed on desktop and 390px phone.");
} finally {
  socket?.close();
  child.kill("SIGTERM");
  await rm(profile, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
}
