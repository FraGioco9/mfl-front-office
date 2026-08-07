(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.37");
  const BOOT_COLUMNS = [
    "player_id", "wallet_address", "wallet_name", "name", "positions", "age", "nationality",
    "preferred_foot", "height", "retirement_years", "owned_since", "active_contract_revenue_share",
    "active_contract_club_id", "active_contract_club_name", "active_contract_club_division", "overall",
    "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping", "player_seasons",
    "next_overall", "next_overall_gap", "pace_to_next_overall", "shooting_to_next_overall",
    "passing_to_next_overall", "dribbling_to_next_overall", "defense_to_next_overall",
    "physical_to_next_overall", "goalkeeping_to_next_overall", "overall_prog_current_season",
    "pace_prog_current_season", "shooting_prog_current_season", "passing_prog_current_season",
    "dribbling_prog_current_season", "defense_prog_current_season", "physical_prog_current_season",
    "goalkeeping_prog_current_season", "overall_prog_all", "pace_prog_all", "shooting_prog_all",
    "passing_prog_all", "dribbling_prog_all", "defense_prog_all", "physical_prog_all", "goalkeeping_prog_all",
  ];
  const VIEW_FROM_SLUG = {
    attributes: "attributes",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  };
  const WATCHLIST_VIEWS = new Set(Object.values(VIEW_FROM_SLUG));
  const DEFAULT_MFL_PER_USD = 400;

  window.__mflStartupIntegrityRuntime?.destroy?.();
  window.__mflReleaseVersion = VERSION;

  let destroyed = false;
  let frame = 0;
  let interval = 0;
  let observer = null;
  let preparedWatchlistView = "";
  let statsPromise = null;
  let statsPayload = null;
  let appliedStatsRows = null;
  let discountPromise = null;
  let discountResult = null;
  let discountMflPerUsd = null;
  let discountRetryAt = 0;
  let discountFunction = null;

  const path = () => String(location.pathname || "/").replace(/\/+$/, "") || "/";
  const isEvaluation = () => path() === "/evaluation" || document.body?.dataset.page === "evaluation";
  const isMflStats = () => path() === "/mfl/stats" || document.body?.dataset.page === "mflstats";
  const isWatchlist = () => /^\/watchlist(?:\/|$)/i.test(path());

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function setData(element, key, value) {
    if (!(element instanceof HTMLElement)) return;
    const text = String(value);
    if (element.dataset[key] !== text) element.dataset[key] = text;
  }

  function showPage(id, pageName) {
    const target = document.getElementById(id);
    if (!(target instanceof HTMLElement)) return false;
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (!(page instanceof HTMLElement)) return;
      const hidden = page !== target;
      if (page.hidden !== hidden) page.hidden = hidden;
    });
    if (target.hidden) target.hidden = false;
    if (document.body.dataset.page !== pageName) document.body.dataset.page = pageName;
    return true;
  }

  function revealShell() {
    document.documentElement.classList.remove("bootPending", "mflInitialChromePreparing");
    document.body?.classList.remove("booting");
    const loading = document.getElementById("loadingScreen");
    if (loading instanceof HTMLElement && !loading.hidden) loading.hidden = true;
  }

  function syncFooter() {
    const label = `MFL Front Office v${VERSION}`;
    document.querySelectorAll('.siteFooter a[href="/changelog"],.siteFooter a[data-page="changelog"]')
      .forEach((link) => {
        setText(link, label);
        setData(link, "releaseLabel", label);
        const aria = `${label}, open Changelog`;
        if (link.getAttribute("aria-label") !== aria) link.setAttribute("aria-label", aria);
        const footer = link.closest(".siteFooter");
        if (footer?.getAttribute("data-release-version") !== VERSION) {
          footer?.setAttribute("data-release-version", VERSION);
        }
      });
    document.querySelectorAll("[data-app-version],.footerVersion,#footerVersion")
      .forEach((element) => setText(element, `v${VERSION}`));
  }

  function storedOptIn() {
    try {
      const address = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim();
      const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
      return Boolean(address && proof?.address && proof?.message
        && Array.isArray(proof.signatures) && proof.signatures.length);
    } catch {
      return false;
    }
  }

  function watchlistView() {
    const slug = path().split("/").filter(Boolean).at(-1)?.toLowerCase();
    return VIEW_FROM_SLUG[slug] || "attributes";
  }

  function syncStaticRoutes() {
    if (path() === "/" && showPage("homePage", "home")) {
      document.querySelectorAll(".navButton").forEach((button) => {
        const active = button.dataset.page === "home";
        if (button.classList.contains("active") !== active) button.classList.toggle("active", active);
      });
      revealShell();
      return;
    }

    if (path() === "/changelog" && showPage("changelogPage", "changelog")) {
      revealShell();
      return;
    }

    if (!isWatchlist() || !storedOptIn() || !showPage("progressionPage", "watchlist")) return;
    const view = watchlistView();
    setText(document.getElementById("tablePageTitle"), "Watchlist");
    document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
      const allowed = WATCHLIST_VIEWS.has(button.dataset.view);
      const active = allowed && button.dataset.view === view;
      if (button.hidden === allowed) button.hidden = !allowed;
      if (button.classList.contains("active") !== active) button.classList.toggle("active", active);
    });

    const body = document.getElementById("tableBody");
    const head = document.getElementById("tableHead");
    const hasRows = Boolean(body?.querySelector("tr"));
    const needsHeader = !hasRows && (!head?.children.length || preparedWatchlistView !== view);
    try {
      if (typeof state === "object" && state) {
        state.currentPage = "watchlist";
        state.view = view;
        if (needsHeader && (!Array.isArray(state.columns) || !state.columns.length)) {
          state.columns = [...BOOT_COLUMNS];
          if (typeof rebuildColumnIndexMap === "function") rebuildColumnIndexMap();
          if (typeof clearRowSortCache === "function") clearRowSortCache();
        }
      }
      if (needsHeader) {
        if (typeof updateViewButtons === "function") updateViewButtons();
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof buildHeader === "function") buildHeader();
        if (typeof renderWatchlistSwitcher === "function") renderWatchlistSwitcher();
        preparedWatchlistView = view;
      }
    } catch (error) {
      console.warn("Could not prepare static Watchlist content.", error);
    }

    const switcher = document.getElementById("watchlistSwitcher");
    if (switcher instanceof HTMLElement) {
      if (switcher.hidden) switcher.hidden = false;
      switcher.removeAttribute("aria-hidden");
    }
    const table = document.querySelector("#progressionPage .tableScroller table");
    if (table instanceof HTMLElement && table.hidden) table.hidden = false;
    if (head instanceof HTMLElement) {
      if (head.hidden) head.hidden = false;
      head.removeAttribute("aria-hidden");
    }
    document.body.classList.add("mflStaticWatchlistLoading");
    document.body.classList.toggle("tableRowsLoading", !hasRows);
    const empty = document.getElementById("emptyState");
    if (!hasRows && empty instanceof HTMLElement) {
      if (empty.hidden) empty.hidden = false;
      setText(empty, "Loading players...");
    }
    revealShell();
  }

  function currentMflPerUsd() {
    try {
      if (typeof state === "object" && state) {
        const value = Number(state.evaluationMflPerUsd);
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch {}
    try {
      const value = Number(String(localStorage.getItem("mfl-evaluation-mfl-per-usd") || "").replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    } catch {}
    return DEFAULT_MFL_PER_USD;
  }

  function normalizedRatios(value) {
    const rows = (Array.isArray(value) ? value : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0
        && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-4);
    if (rows.length !== 4) return null;
    return rows.every((row, index) => !index || row.season === rows[index - 1].season + 1) ? rows : null;
  }

  function calculateRate(rows, currentValue, requestedAt) {
    const ordered = normalizedRatios(rows);
    if (!ordered) return null;
    const factors = ordered.slice(1).map((row, index) => row.ratio / ordered[index].ratio);
    factors.push(currentValue / ordered.at(-1).ratio);
    if (factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;
    const rate = Math.pow(factors.reduce((product, factor) => product * factor, 1), 1 / 4) - 1;
    if (!Number.isFinite(rate)) return null;
    const currentSeason = ordered.at(-1).season + 1;
    return Object.freeze({
      rows: Object.freeze(ordered.map((row) => Object.freeze({ ...row }))),
      factors: Object.freeze(factors),
      currentMflPerUsd: currentValue,
      currentSeason,
      rate,
      label: `${(rate * 100).toFixed(2)}%`,
      requestedAt,
      source: "supabase-live-request",
      tooltip: `Discount Rate is the geometric mean of four MFL/USD conversion growth rates. Current season is ${currentSeason}, so it uses seasons ${currentSeason - 4}–${currentSeason}, with the current season based on the MFL/USD value currently set.`,
    });
  }

  function installRateFunction() {
    if (!discountFunction) {
      discountFunction = function liveSupabaseDiscountRate() {
        return discountResult?.rate ?? null;
      };
      discountFunction.__mflSupabaseAuthority = VERSION;
    }
    window.__mflSupabaseDiscountRateFunction = discountFunction;
    try { window.evaluationDiscountRateValue = discountFunction; } catch {}
    try { window.eval("evaluationDiscountRateValue = window.__mflSupabaseDiscountRateFunction"); } catch {}
  }

  function paintRate() {
    if (!isEvaluation()) return;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (!discountResult) {
      setText(value, "-");
      setText(advanced, "-");
      setData(document.documentElement, "mflDiscountRate", "-");
      setData(document.documentElement, "mflDiscountRateSource", "supabase-loading");
      return;
    }
    installRateFunction();
    setText(value, discountResult.label);
    setText(advanced, discountResult.label);
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    setData(metric, "tooltip", discountResult.tooltip);
    setData(metric, "mflDiscountRate", discountResult.label);
    setData(metric, "mflDiscountRateSource", discountResult.source);
    setData(metric, "mflSupabaseTooltipVersion", VERSION);
    setData(metric, "mflCurrentSeason", discountResult.currentSeason);
    setData(metric, "mflCurrentValue", discountResult.currentMflPerUsd);
    setData(metric, "mflRatioSeasons", [
      ...discountResult.rows.map((row) => row.season),
      discountResult.currentSeason,
    ].join(","));
    setData(document.documentElement, "mflDiscountRate", discountResult.label);
    setData(document.documentElement, "mflDiscountRateSource", discountResult.source);
  }

  function publishRate(result) {
    discountResult = result;
    installRateFunction();
    window.mflSeasonRatios = result.rows;
    window.__mflSeasonRatioResult = result;
    window.__mflDynamicDiscountResult = result;
    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: result }));
    paintRate();
    if (typeof window.renderEvaluationPage === "function") {
      queueMicrotask(() => {
        try { window.renderEvaluationPage(); } catch {}
        requestAnimationFrame(paintRate);
      });
    }
  }

  function requestRate(force = false) {
    if (!isEvaluation()) return Promise.resolve(null);
    const mflPerUsd = currentMflPerUsd();
    if (!force && discountPromise) return discountPromise;
    if (!force && discountResult && discountMflPerUsd === mflPerUsd) return Promise.resolve(discountResult);
    discountMflPerUsd = mflPerUsd;
    discountResult = null;
    paintRate();
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    discountPromise = fetch(`/api/mfl-season-ratios-v2?fresh=${encodeURIComponent(nonce)}&v=${VERSION}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
        const result = calculateRate(data.ratios, mflPerUsd, String(data.requestedAt || ""));
        if (!result) throw new Error("The live MFL season ratios are incomplete.");
        publishRate(result);
        discountRetryAt = 0;
        return result;
      })
      .catch((error) => {
        console.error("Could not calculate the Evaluation Discount Rate.", error);
        discountRetryAt = Date.now() + 4000;
        return null;
      })
      .finally(() => { discountPromise = null; });
    return discountPromise;
  }

  async function statsPage(page, pageSize) {
    const response = await fetch(`/api/data?mode=mfl-stats-all&page=${page}&pageSize=${pageSize}&v=${VERSION}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load complete MFL Stats.");
    return data;
  }

  function loadStats() {
    if (statsPromise) return statsPromise;
    const pageSize = 2000;
    statsPromise = statsPage(1, pageSize)
      .then(async (first) => {
        const totalPages = Math.max(1, Number(first.totalPages) || 1);
        const remaining = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) => statsPage(index + 2, pageSize)),
        );
        const columns = Array.isArray(first.columns) ? first.columns : [];
        const idIndex = columns.indexOf("player_id");
        const seen = new Set();
        const rows = [];
        [first, ...remaining].forEach((payload) => {
          (Array.isArray(payload.rows) ? payload.rows : []).forEach((row) => {
            const id = idIndex >= 0 ? String(row?.[idIndex] ?? "") : "";
            if (id && seen.has(id)) return;
            if (id) seen.add(id);
            rows.push(row);
          });
        });
        statsPayload = {
          columns,
          rows,
          totalRows: Number(first.totalRows) || rows.length,
          sourceRows: Number(first.sourceRows) || rows.length,
        };
        return statsPayload;
      })
      .catch((error) => {
        statsPromise = null;
        console.error("Could not load all MFL Stats players.", error);
        return null;
      });
    return statsPromise;
  }

  function applyStats() {
    if (!isMflStats()) return;
    if (!statsPayload) {
      void loadStats();
      return;
    }
    try {
      if (typeof state !== "object" || !state || typeof renderMflStatsPage !== "function") return;
      if (state.rows === appliedStatsRows && state.rows.length === statsPayload.rows.length) return;
      state.currentPage = "mflstats";
      state.columns = [...statsPayload.columns];
      state.rows = [...statsPayload.rows];
      appliedStatsRows = state.rows;
      state.filteredRows = [...state.rows];
      state.tableSourceRowsCount = statsPayload.totalRows;
      state.incrementalTotalRows = statsPayload.totalRows;
      state.incrementalSourceRows = statsPayload.sourceRows;
      state.dataLoaded = true;
      state.dataAccess = "mfl";
      if (typeof rebuildColumnIndexMap === "function") rebuildColumnIndexMap();
      if (typeof clearRowSortCache === "function") clearRowSortCache();
      renderMflStatsPage();
    } catch (error) {
      console.error("Could not render complete MFL Stats.", error);
    }
  }

  function syncDynamic() {
    if (isEvaluation()) {
      const value = currentMflPerUsd();
      if (!discountPromise && (!discountResult || discountMflPerUsd !== value)) void requestRate(Boolean(discountResult));
      else if (!discountResult && discountRetryAt && Date.now() >= discountRetryAt) void requestRate(true);
      paintRate();
    }
    applyStats();
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    syncFooter();
    syncStaticRoutes();
    syncDynamic();
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  const style = document.createElement("style");
  style.id = "mflStartupIntegrityStyles";
  style.textContent = `
    body[data-page="watchlist"].mflStaticWatchlistLoading #watchlistSwitcher,
    body[data-page="watchlist"].mflStaticWatchlistLoading #watchlistSwitcher[hidden]{display:flex!important;visibility:visible!important;opacity:1!important}
    body[data-page="watchlist"].mflStaticWatchlistLoading #tableHead{display:table-header-group!important;visibility:visible!important;opacity:1!important}
  `;
  document.head.appendChild(style);

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  interval = setInterval(schedule, 150);
  addEventListener("popstate", schedule);
  addEventListener("storage", schedule);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    removeEventListener("popstate", schedule);
    removeEventListener("storage", schedule);
    style.remove();
  }

  installRateFunction();
  window.__mflDiscountRateAuthority = {
    version: VERSION,
    source: "supabase-live-request",
    get result() { return discountResult; },
    refresh: () => requestRate(true),
    sync: schedule,
    destroy: () => {},
  };
  window.__mflStartupIntegrityRuntime = {
    version: VERSION,
    sync: schedule,
    destroy,
    refreshDiscountRate: () => requestRate(true),
    loadFullMflStats: loadStats,
  };

  if (isEvaluation()) void requestRate(true);
  if (isMflStats()) void loadStats();
  sync();
})();
