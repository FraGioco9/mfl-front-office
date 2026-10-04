/* LOAD-01B.4 standalone synthetic, parser-time-only browser probe. Never ship in site. */
(() => {
  "use strict";
  const kind = "__KIND__";
  const theme = "__THEME__";
  try { localStorage.setItem("mfl-theme", theme); } catch {}
  const state = {
    kind, theme, held: [], heldCount: 0, releasedCount: 0, released: false,
    apiRequests: [], cls: 0, shifts: [], observing: false, observed: 0,
  };
  const originalFetch = window.fetch.bind(window);
  const shouldHold = (url, method) => {
    if (method !== "GET" || url.pathname !== "/api/data") return false;
    const mode = url.searchParams.get("mode");
    const scope = url.searchParams.get("scope");
    if (kind === "myclubs") return mode === "my-clubs-competitions";
    if (kind === "home" || kind === "evaluation") return mode === "bootstrap";
    if (kind === "club" || kind === "planner") return mode === "page" && scope === "club";
    if (kind === "database") return mode === "page";
    return false;
  };
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const method = String(init.method || input?.method || "GET").toUpperCase();
    if (url.pathname.startsWith("/api/")) {
      state.apiRequests.push({ path: url.pathname, mode: url.searchParams.get("mode"), scope: url.searchParams.get("scope") });
    }
    if (state.released || !shouldHold(url, method)) return originalFetch(input, init);
    state.heldCount++;
    return new Promise((resolve, reject) => {
      state.held.push(() => {
        state.releasedCount++;
        Promise.resolve(originalFetch(input, init)).then(resolve, reject);
      });
    });
  };
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        state.observed++;
        if (!state.observing || entry.hadRecentInput) continue;
        state.cls += entry.value;
        state.shifts.push({
          value: +entry.value.toFixed(7), time: Math.round(entry.startTime),
          sources: (entry.sources || []).slice(0, 3).map(s => s.node?.id || s.node?.className || "anonymous"),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch { state.observerMissing = true; }
  const selectors = {
    myclubs: ["#myClubsPage", "#myClubsGrid", "#myClubsGrid .myClubCardLoading",
      "#myClubsGrid .myClubCard:not(.myClubCardLoading)", "#myClubsStatus"],
    home: ["#homePage", "#homePlayers", "#homeWallets", "#homeSummaryLoadError"],
    club: ["#clubPage", "#clubIdentity", "#clubIdentityName", "#clubIdentityOwnerName", "#clubSquadTable"],
    evaluation: ["#evaluationPage", "#evaluationSearchInput", "#evaluationPanel",
      "#evaluationSummaryBody", "#evaluationTableBody"],
    database: ["#progressionPage", "#tableHead", "#tableBody", "#tableBody tr", ".playerTableScroller"],
    planner: ["#plannerPage", "#plannerWorkspace", ".plannerRosterTable", "#plannerRosterBody tr"],
  };
  const rect = node => {
    const r = node.getBoundingClientRect();
    const s = getComputedStyle(node);
    return {
      x: +r.x.toFixed(2), y: +r.y.toFixed(2),
      width: +r.width.toFixed(2), height: +r.height.toFixed(2),
      display: s.display, visibility: s.visibility,
    };
  };
  state.snapshot = () => {
    const regions = {};
    for (const query of selectors[kind] || []) {
      const elements = document.querySelectorAll(query);
      regions[query] = { count: elements.length, samples: [...elements].slice(0, 5).map(rect) };
    }
    return {
      kind, themeExpected: theme, themeActual: document.documentElement.dataset.theme,
      path: location.pathname, initialPage: document.documentElement.dataset.initialPage,
      routeReady: document.documentElement.dataset.mflRouteReady === "true",
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      heldCount: state.heldCount, releasedCount: state.releasedCount,
      apiRequests: state.apiRequests.slice(),
      cls: +state.cls.toFixed(7), shifts: state.shifts.slice(),
      regions, synthetic: true,
    };
  };
  state.startWindow = () => {
    state.cls = 0;
    state.shifts = [];
    state.observing = true;
  };
  state.endWindow = () => { state.observing = false; };
  state.release = () => {
    state.released = true;
    const tasks = state.held.splice(0);
    for (const task of tasks) task();
    return tasks.length;
  };
  window.__load01b4 = state;
})();
