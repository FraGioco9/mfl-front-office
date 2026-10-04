/* Test-only LOAD-01B probe: injected by a temporary browser fixture, never bundled. */
(() => {
  "use strict";
  const kind = "__LOAD01B_KIND__";
  const targetTheme = "__LOAD01B_THEME__";
  try { localStorage.setItem("mfl-theme", targetTheme); } catch {}
  const state = {
    kind, targetTheme, requestsHeld: 0, requestsReleased: 0, waiting: [],
    observe: false, cls: 0, shifts: [], observed: 0,
  };
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      state.observed++;
      if (state.observe && !entry.hadRecentInput) {
        state.cls += entry.value;
        state.shifts.push({ value: entry.value, at: Math.round(entry.startTime) });
      }
    }
  });
  try { observer.observe({ type: "layout-shift", buffered: true }); }
  catch { /* Older Chromium: report observer unavailability in measurements. */ }
  const originalFetch = window.fetch.bind(window);
  const requestKind = (url, method) => {
    if (method !== "GET") return "";
    if (kind === "planner-squad" && url.pathname === "/api/data"
      && url.searchParams.get("mode") === "page"
      && url.searchParams.get("scope") === "club") return "squad";
    if (kind === "planner-search" && url.pathname === "/api/data"
      && url.searchParams.get("mode") === "my-clubs") return "search";
    if (kind === "myclubs" && url.pathname === "/api/data"
      && url.searchParams.get("mode") === "my-clubs-competitions") return "clubs";
    if (kind === "database" && url.pathname === "/api/data"
      && url.searchParams.get("mode") === "page") return "table";
    if (kind === "player" && url.pathname === "/api/data"
      && url.searchParams.get("mode") === "page"
      && url.searchParams.get("scope") === "player") return "player";
    if (kind === "plans"
      && (url.pathname === "/api/planner-save" || url.pathname === "/api/planner-share")) return "plans";
    return "";
  };
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const method = String(init.method || input?.method || "GET").toUpperCase();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (kind === "plans" && (url.pathname === "/api/planner-save" || url.pathname === "/api/planner-share")) {
      headers.set("x-browser-ux03-actions", "1");
    }
    const gated = requestKind(url, method);
    // Gate only the first measured request wave: canonical SPA/cached returns must never be held.\n    if (!gated || state.requestsReleased > 0) return originalFetch(input, { ...init, headers });
    state.requestsHeld++;
    return new Promise((resolve, reject) => {
      state.waiting.push({ gated, url: url.pathname + url.search, release: () => {
        state.requestsReleased++;
        Promise.resolve(originalFetch(input, { ...init, headers })).then(resolve, reject);
      }});
    });
  };
  const selectors = {
    "planner-squad": ["#plannerWorkspace", "#plannerRosterPanel", ".plannerRosterTable", "#plannerRosterBody", "#plannerRosterBody tr", "#plannerRosterBody tr td", "#plannerPitchPanel", "#plannerSquadStatusStrip"],
    plans: ["#plannerPlansModal", ".plannerPlansDialog", ".plannerPlansModalBody", "#plannerPlansStatus", "#plannerPlansList", ".plannerPlanItem", ".plannerPlanCard"],
    "planner-search": ["#plannerTeamSelector", "#plannerTeamSearchInput", "#plannerTeamSearchResults", "#plannerTeamResults", ".searchHint"],
    myclubs: ["#myClubsPage", "#myClubsGrid", ".myClubCard", ".myClubCardLoading", ".myClubCardBody"],
    database: ["#progressionPage", "#tableHead", "#tableBody", "#tableBody tr", ".playerTableScroller", "#progressionPage nav.pager"],
    player: ["#playerPage", "#playerDetail", ".playerHero", ".playerTitle", "#playerAttributes", "#playerPage .playerTitle"],
  };
  const rect = element => {
    if (!element) return null;
    const b = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100,
      width: Math.round(b.width * 100) / 100, height: Math.round(b.height * 100) / 100,
      display: style.display, visibility: style.visibility,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
    };
  };
  state.snapshot = () => {
    const regions = {};
    for (const selector of selectors[kind] || []) {
      const nodes = Array.from(document.querySelectorAll(selector)).slice(0, 8);
      regions[selector] = { count: document.querySelectorAll(selector).length, samples: nodes.map(rect) };
    }
    return {
      kind, themeRequested: targetTheme, themeActual: document.documentElement.dataset.theme || "",
      ready: document.documentElement.dataset.mflRouteReady || "",
      viewport: [innerWidth, innerHeight], devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      requestsHeld: state.requestsHeld, requestsReleased: state.requestsReleased,
      cls: Math.round(state.cls * 1e6) / 1e6,
      shifts: state.shifts.slice(), regions,
      synthetic: true,
    };
  };
  state.startMeasurement = () => { state.cls = 0; state.shifts = []; state.observe = true; };
  state.release = () => {
    const pending = state.waiting.splice(0);
    for (const item of pending) item.release();
    return pending.map(item => item.gated);
  };
  window.__load01b = state;
})();
