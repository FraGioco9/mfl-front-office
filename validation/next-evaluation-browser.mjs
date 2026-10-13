// Real-browser Evaluation interaction smoke against the production Next build.
// The Site quality job starts the local server; this test never touches Vercel.
import assert from "node:assert/strict";
import { browserExecutable, startChromium, stopChromium, waitForPageTarget, connectCdp } from "./next-browser-cdp.mjs";

const base = new URL(process.argv[2] || "http://127.0.0.1:4010/");
assert(["127.0.0.1", "localhost", "::1", "[::1]"].includes(base.hostname),
  "Evaluation browser smoke must target a local Next build.");

let browser;
try {
  browser = browserExecutable("Evaluation browser smoke requires Chrome/Chromium.");
} catch {
  assert.fail("Evaluation browser smoke requires Chrome/Chromium.");
}
const target = new URL("/evaluation", base).toString();
const { port: debugPort, profile, child, stderr: readStderr } = await startChromium({
  executable: browser, prefix: "mfl-evaluation-next-browser-", target,
  flags: ["--window-size=1280,900"], stderrText: false,
});
let cdp;
try {
  let page;
  try {
    page = await waitForPageTarget(debugPort, target);
  } catch {
    assert.fail(`Could not start Evaluation Chrome: ${readStderr()}`);
  }
  if (typeof WebSocket === "undefined") throw new ReferenceError("WebSocket is not defined");
  if (typeof WebSocket !== "function") throw new TypeError("WebSocket is not a constructor");
  cdp = await connectCdp(page.webSocketDebuggerUrl, "Node runtime must expose WebSocket for the Chrome DevTools Protocol.");
  const send = (method, params = {}) => cdp.send(method, params);
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
  await stopChromium({ child, cdp, profile, signal: "SIGTERM" });
}
