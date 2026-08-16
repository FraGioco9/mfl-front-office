// @ts-check

const STARTUP_MARKER = "window.__mflAppStartPromise = startApp();";

const ROUTE_RUNTIME_GATE = `;(() => {
  if (typeof setPage !== "function" || setPage.__mflRouteRuntimeGate) return;
  const originalRouteRuntimeSetPage = setPage;
  const routeRuntimeSetPage = async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {
    const incomingOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;
    const ownerBeforeRuntime = setPage;
    const busyToken = !runtimeReady && window.__mflInteractionBusy?.begin
      ? window.__mflInteractionBusy.begin("route-runtime")
      : "";
    try {
      if (!runtimeReady) window.__mflCancelIncrementalRouteRequest?.();
      const routeCorePromise = !runtimeReady && typeof window.__mflEnsureRouteCore === "function"
        ? window.__mflEnsureRouteCore(String(pageName || ""), incomingOptions)
        : null;
      if (!runtimeReady && typeof window.__mflEnsureRouteRuntime === "function") {
        await window.__mflEnsureRouteRuntime(String(pageName || ""), incomingOptions);
      }
      if (routeCorePromise) await routeCorePromise;
      if (!runtimeReady && setPage !== ownerBeforeRuntime) {
        return setPage.call(this, pageName, updateHash, {
          ...incomingOptions,
          __mflRouteRuntimeReady: true,
        });
      }

      if (!runtimeReady) {
        return originalRouteRuntimeSetPage.call(this, pageName, updateHash, incomingOptions);
      }

      const cleanOptions = { ...incomingOptions };
      delete cleanOptions.__mflRouteRuntimeReady;
      return originalRouteRuntimeSetPage.call(this, pageName, updateHash, cleanOptions);
    } finally {
      if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
    }
  };
  Object.defineProperty(routeRuntimeSetPage, "__mflRouteRuntimeGate", { value: true });
  setPage = routeRuntimeSetPage;
})();

window.__mflMarkApplicationCoreLoaded?.();

window.__mflAppStartPromise = (async () => {
  const initialRoutePath = window.location.pathname.replace(/\\/+$/, "") || "/";
  const directTableRoute = (
    (/^\\/database(?:\\/|$)/i.test(initialRoutePath) && !/^\\/database\\/stats$/i.test(initialRoutePath))
    || (/^\\/mfl(?:\\/|$)/i.test(initialRoutePath) && !/^\\/mfl\\/stats$/i.test(initialRoutePath))
    || /^\\/(?:agents|progression|watchlist|my-players)(?:\\/|$)/i.test(initialRoutePath)
  );
  if (directTableRoute && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("table");
  }
  if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(window.location.pathname)
    && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("club");
  }
  if (/^\\/settings\\/?$/i.test(window.location.pathname)
    && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("settings");
  }
  if (/^\\/players\\/[^/]+\\/?$/i.test(window.location.pathname)
    && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("player");
  }
  return startApp();
})();`;

export function normalizeRouteRuntimeGate(source) {
  const text = String(source || "");
  if (text.includes("setPageWithRouteRuntime")) return text;
  if (!text.includes(STARTUP_MARKER)) {
    throw new Error("Could not locate the application startup marker for the route runtime gate.");
  }
  return text.replace(STARTUP_MARKER, ROUTE_RUNTIME_GATE);
}
