import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { browserExecutable, reserveTcpPort, waitForPageTarget, connectCdp } from "./next-browser-cdp.mjs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const targetUrl = String(process.argv[2] || "").trim();
assert(targetUrl, "Next rendered-shell browser probe requires a target URL.");

async function verifyRefreshTitleStability(cdp, expectedTitle) {
  await cdp.send("Page.enable");
  await cdp.send("Page.reload", { ignoreCache: true });

  const observedTitles = [];
  const deadline = Date.now() + 15_000;
  let settled = false;
  while (Date.now() < deadline) {
    try {
      const evaluation = await cdp.send("Runtime.evaluate", {
        expression: `(() => ({
          title: document.title,
          readyState: document.readyState,
          routeReady: document.documentElement.dataset.mflRouteReady === "true",
        }))()`,
        returnByValue: true,
      });
      const value = evaluation?.result?.value;
      const title = String(value?.title || "");
      if (title && observedTitles.at(-1) !== title) observedTitles.push(title);
      if (value?.readyState === "complete" && value?.routeReady && title === expectedTitle) {
        settled = true;
        break;
      }
    } catch {
      // The previous execution context can disappear briefly during reload.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }

  assert(settled, `Refresh did not settle on ${expectedTitle}. Observed titles: ${JSON.stringify(observedTitles)}`);
  assert(
    !observedTitles.some((title) => /page not found/i.test(title)),
    `Refresh must never expose a Page not found title. Observed titles: ${JSON.stringify(observedTitles)}`,
  );
  return observedTitles;
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
          documentTitle: document.title,
          viewportMetaCount: document.querySelectorAll('meta[name="viewport"]').length,
          viewportContent: String(document.querySelector('meta[name="viewport"]')?.getAttribute("content") || ""),
          devAssetToken: String(document.documentElement.dataset.mflDevAssets || ""),
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
    // The Next dev-tools portal can appear before the route title runtime has
    // reconciled the document. Wait for the route-owned title on every probe.
    const pathname = new URL(targetUrl).pathname;
    const expectedTitle = pathname === "/planner" ? "Planner - MFL Front Office" : "MFL Front Office";
    const titleReady = value?.documentTitle === expectedTitle && value?.readyState === "complete";
    const developmentRuntimeReady = Boolean(value?.badge)
      || (
        value?.nextDevClientId !== null
        && Array.isArray(value?.nextScripts)
        && value.nextScripts.some((src) => String(src).includes("/_next/static/development/"))
      );
    if (value?.nextMount && value?.appShell && value?.topbar && value?.modal && value?.portal && developmentRuntimeReady && titleReady) {
      return value;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Next-rendered shell or development runtime did not become available before timeout. Last state: ${JSON.stringify(lastValue)}`);
}

async function waitForLegacyAutoRefresh(cdp, {
  originalToken,
  marker,
  expectMarker,
}) {
  const deadline = Date.now() + 20_000;
  let lastValue = null;

  while (Date.now() < deadline) {
    try {
      const evaluation = await cdp.send("Runtime.evaluate", {
        expression: `(async () => {
          const response = await fetch("/responsive.css?mfl_dev_refresh=" + Date.now(), { cache: "no-store" });
          const css = await response.text();
          return {
            token: String(document.documentElement.dataset.mflDevAssets || ""),
            markerPresent: css.includes(${JSON.stringify(marker)}),
            readyState: document.readyState,
          };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      const value = evaluation?.result?.value;
      lastValue = value;
      const tokenReady = expectMarker
        ? Boolean(value?.token) && value.token !== originalToken
        : value?.token === originalToken;
      // The served legacy asset content is the authoritative refresh signal.
      // Next dev may serve the updated asset without rotating the document-level
      // diagnostic token, so keep tokenReady for diagnostics without making it
      // a hard requirement for a successful refresh probe.
      if (value?.markerPresent === expectMarker && value?.readyState === "complete") {
        return { ...value, tokenReady };
      }
    } catch {
      // A full Fast Refresh reload can destroy the old execution context briefly.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error(
    `Legacy asset change did not automatically refresh the Next document before timeout. Last state: ${JSON.stringify(lastValue)}`,
  );
}

async function runRenderedShellProbe() {
const executable = browserExecutable("Next rendered-shell browser probe requires Chrome or Chromium on PATH.");
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
let responsiveSource = null;
let initialDevAssetToken = "";
const responsivePath = resolve(process.cwd(), "responsive.css");
const refreshMarker = "/* mfl-next-auto-refresh-probe */";

try {
  const target = await waitForPageTarget(debuggingPort, targetUrl);
  cdp = await connectCdp(target.webSocketDebuggerUrl, "Node runtime must expose WebSocket for the Chrome DevTools Protocol.");
  await cdp.send("Runtime.enable");
  const state = await waitForRenderedShell(cdp);
  initialDevAssetToken = state.devAssetToken;
  assert(initialDevAssetToken && initialDevAssetToken !== "production-static", "Development document did not receive the Webpack legacy-asset watch token.");
  if (new URL(targetUrl).pathname === "/planner") {
    const check = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const planner = document.querySelector(".navPlannerIcon");
        return {
          hasPlanner: Boolean(document.querySelector("#plannerPage")),
          navFill: planner ? getComputedStyle(planner).fill : "",
          hasNotFound: Boolean(document.querySelector("#notFoundPage:not([hidden])")),
        };
      })()`,
      returnByValue: true,
    });
    assert(check?.result?.value?.hasPlanner, "Planner Next route must include the full Planner document.");
    assert.equal(check.result.value.navFill, "none", "Planner sidebar glyph must not render as a filled black square.");
    assert(!check.result.value.hasNotFound, "Planner direct navigation must not show the Page not found shell.");
  }

  const targetPathname = new URL(targetUrl).pathname;
  const expectedDocumentTitle = targetPathname === "/planner"
    ? "Planner - MFL Front Office"
    : "MFL Front Office";
  assert.equal(state.documentTitle, expectedDocumentTitle, `Next-rendered ${targetPathname} document title is incorrect.`);
  const refreshTitles = await verifyRefreshTitleStability(cdp, expectedDocumentTitle);
  assert.equal(state.viewportMetaCount, 1, "Next-rendered shell must expose exactly one viewport meta tag.");
  assert.equal(
    state.viewportContent,
    "width=device-width, initial-scale=1, viewport-fit=cover",
    "Next-rendered viewport metadata does not match the legacy responsive contract.",
  );

  let refreshed = null;
  if (targetPathname === "/") {
    responsiveSource = await readFile(responsivePath, "utf8");
    await writeFile(responsivePath, `${responsiveSource.trimEnd()}\n${refreshMarker}\n`, "utf8");
    refreshed = await waitForLegacyAutoRefresh(cdp, {
      originalToken: initialDevAssetToken,
      marker: refreshMarker,
      expectMarker: true,
    });
  }

  console.log(`Next-rendered shell browser probe passed: ${JSON.stringify({ ...state, refreshTitles, autoRefresh: refreshed })}`);
} catch (error) {
  throw new Error(`${error.message}\n${stderr.slice(-2000)}`, { cause: error });
} finally {
  if (responsiveSource !== null) {
    await writeFile(responsivePath, responsiveSource, "utf8");
    if (cdp && initialDevAssetToken) {
      await waitForLegacyAutoRefresh(cdp, {
        originalToken: initialDevAssetToken,
        marker: refreshMarker,
        expectMarker: false,
      }).catch(() => null);
    }
  }
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

for (let attempt = 1; attempt <= 2; attempt += 1) {
  try {
    await runRenderedShellProbe();
    break;
  } catch (error) {
    const message = String(error?.message || error || "");
    const transient = message.includes("Chrome debugging target did not become ready.")
      || message.includes("Chrome DevTools request timed out:");
    if (!transient || attempt === 2) throw error;
    console.warn(`Retrying transient Next rendered-shell Chrome failure: ${message.split("\\n")[0]}`);
  }
}
