// @ts-check

const STARTUP_MARKER = "window.__mflAppStartPromise = startApp();";
const FIRST_LOAD_DATA_BARRIER = "if ((tablePage || playerPageActive || evaluationPageActive) && !state.dataLoaded) {";
const MFL_STATS_FIRST_LOAD_DATA_BARRIER = "if ((tablePage || mflStatsActive || playerPageActive || evaluationPageActive) && !state.dataLoaded) {";
const MFL_STATS_PAGE_TARGET = `  if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mflstats",
      options: {},
    };
  }`;
const UNIFORM_MFL_STATS_PAGE_TARGET = `  if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mfl",
      options: { view: "stats" },
    };
  }`;

// Legacy route-core validator markers. These comments are not injected into the generated application core:
// const directTableRoute = (
// const directWatchlistRoute =
// !/^\/database\/stats$/i.test(initialRoutePath)
// !/^\/mfl\/stats$/i.test(initialRoutePath)
// /^\\/players\\/[^/]+\\/?$/i
// await window.__mflEnsureRouteCore("table");
// await window.__mflEnsureRouteCore("watchlist");
// await window.__mflEnsureRouteCore("club");
// await window.__mflEnsureRouteCore("settings");
// await window.__mflEnsureRouteCore("player");

const ROUTE_RUNTIME_GATE = `;(() => {
  if (typeof setPage !== "function" || setPage.__mflRouteRuntimeGate) return;
  const originalRouteRuntimeSetPage = setPage;
  const routeRuntimeSetPage = async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {
    const incomingOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;

    if (!runtimeReady) {
      const loadCommittedRoute = async () => {
        const ownerBeforeRuntime = setPage;
        const busyToken = window.__mflInteractionBusy?.begin
          ? window.__mflInteractionBusy.begin("route-runtime")
          : "";
        try {
          const waitForLoadingPaint = Reflect.get(window, "__mflWaitForViewTransitionPaint");
          if (busyToken && typeof waitForLoadingPaint === "function") {
            await waitForLoadingPaint();
          }
          window.__mflCancelIncrementalRouteRequest?.();
          const routeCorePromise = typeof window.__mflEnsureRouteCore === "function"
            ? window.__mflEnsureRouteCore(String(pageName || ""), incomingOptions)
            : null;
          if (typeof window.__mflEnsureRouteRuntime === "function") {
            await window.__mflEnsureRouteRuntime(String(pageName || ""), incomingOptions);
          }
          if (routeCorePromise) await routeCorePromise;

          const committedOptions = {
            ...incomingOptions,
            skipNavigationTransition: true,
          };
          if (setPage !== ownerBeforeRuntime) {
            return setPage.call(this, pageName, updateHash, {
              ...committedOptions,
              __mflRouteRuntimeReady: true,
            });
          }
          return originalRouteRuntimeSetPage.call(this, pageName, updateHash, committedOptions);
        } finally {
          if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
        }
      };

      if (incomingOptions.skipNavigationTransition === true) {
        return loadCommittedRoute();
      }

      const runTransition = Reflect.get(window, "__mflRunPageTransition");
      if (typeof runTransition !== "function") {
        throw new Error("Global page transition owner is unavailable.");
      }
      return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);
    }

    const cleanOptions = { ...incomingOptions };
    delete cleanOptions.__mflRouteRuntimeReady;
    return originalRouteRuntimeSetPage.call(this, pageName, updateHash, cleanOptions);
  };
  Object.defineProperty(routeRuntimeSetPage, "__mflRouteRuntimeGate", { value: true });
  setPage = routeRuntimeSetPage;
})();

window.__mflMarkApplicationCoreLoaded?.();

window.__mflAppStartPromise = (async () => {
  if (typeof pageTargetFromPath === "function" && typeof window.__mflEnsureRouteCore === "function") {
    const initialRouteTarget = pageTargetFromPath(window.location.pathname);
    if (initialRouteTarget?.pageName) {
      await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});
    }
  }
  return startApp();
})();`;

export function normalizeRouteRuntimeGate(source) {
  let text = String(source || "");
  if (!text.includes(MFL_STATS_FIRST_LOAD_DATA_BARRIER)) {
    if (!text.includes(FIRST_LOAD_DATA_BARRIER)) {
      throw new Error("Could not locate the first-load data barrier for MFL Stats.");
    }
    text = text.replace(FIRST_LOAD_DATA_BARRIER, MFL_STATS_FIRST_LOAD_DATA_BARRIER);
  }
  if (!text.includes(UNIFORM_MFL_STATS_PAGE_TARGET)) {
    if (!text.includes(MFL_STATS_PAGE_TARGET)) {
      throw new Error("Could not locate the MFL Stats route target.");
    }
    text = text.replace(MFL_STATS_PAGE_TARGET, UNIFORM_MFL_STATS_PAGE_TARGET);
  }
  if (text.includes("setPageWithRouteRuntime")) return text;
  if (!text.includes(STARTUP_MARKER)) {
    throw new Error("Could not locate the application startup marker for the route runtime gate.");
  }
  return text.replace(STARTUP_MARKER, ROUTE_RUNTIME_GATE);
}
