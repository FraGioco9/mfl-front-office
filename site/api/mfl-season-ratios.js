const APP_VERSION = "1.119.28";
const APP_RELEASES = [
  ["v1.119.28", "Keep loaded club views available throughout the session"],
  ["v1.119.27", "Keep Changelog geometry stable and restore cached club views instantly"],
  ["v1.119.26", "Cache club views and stabilize player and refresh rendering"],
  ["v1.119.25", "Use native footer text and stable first-paint layout"],
  ["v1.119.24", "Fix player team links, footer label, and refresh alignment"],
  ["v1.119.23", "Restore navigation, player links, Watchlists, and stable release UI"],
  ["v1.118.33", "Preserve native MFL Stats filters, keep the loading cursor, and link player contract teams"],
  ["v1.118.32", "Make player contract teams native links and restore MFL Stats filter clicks"],
  ["v1.118.31", "Remove the legacy Evaluation rate, stabilize Stats filters, and link player contracts"],
  ["v1.118.30", "Remove the legacy Evaluation rate, link player contracts, and restore MFL Stats controls"],
  ["v1.118.29", "Restore native MFL Stats filter interactions after loading"],
  ["v1.118.28", "Prevent Evaluation refresh stalls and require Supabase for the Discount Rate"],
  ["v1.118.27", "Restore immediate Home startup while keeping Evaluation and MFL Stats fixes route-scoped"],
  ["v1.118.26", "Prevent Evaluation value flashes, synchronize the Load action, and stabilize MFL Stats controls"],
  ["v1.118.25", "Link contract teams, reveal the Evaluation Load action early, and restore Stats filter clicks"],
  ["v1.118.24", "Prevent Home boot stalls and keep route fixes scoped to their pages"],
  ["v1.118.23", "Prevent false player-not-found flashes, link contract teams, and reveal the Evaluation shell immediately"],
  ["v1.118.22", "Keep player routes loading, link teams, restore Stats controls, and reveal the Evaluation shell"],
  ["v1.118.21", "Fix tooltip placement, player team links, Stats loading controls, and the Evaluation loading shell"],
  ["v1.118.20", "Keep tooltips clear of the header, link player teams, restore Stats filters, and reveal Evaluation together"],
  ["v1.118.19", "Reset Evaluation routes, link player teams, align loading UI, and restore MFL Stats filters"],
  ["v1.118.18", "Remove loading header rounding, prevent Evaluation flashes, and restore MFL Stats filters"],
  ["v1.118.17", "Restore Evaluation metric formatting, hide Load on player routes, and enable MFL Stats filters"],
  ["v1.118.16", "Synchronize the Evaluation discount-rate display with the active calculation"],
  ["v1.118.15", "Preserve Evaluation player and share routes and restore Stats filters"],
  ["v1.118.14", "Keep the Evaluation search inactive when a player is selected"],
  ["v1.118.13", "Allow opted-out evaluation shares, restore Stats filters, and focus empty Evaluation search"],
  ["v1.118.12", "Animate the discount tooltip, restore Stats filters, and support local season ratios"],
  ["v1.118.11", "Fix Evaluation tooltip placement, Stats filters, and Season 16 discount history"],
  ["v1.118.10", "Fix Evaluation tooltip, Stats interactions, footer timing, and season ratios"],
  ["v1.118.9", "Restore MFL Stats interactions after loading"],
  ["v1.118.8", "Complete SemVer changelog history and keep the latest version current"],
  ["v1.118.7", "Enforce API limits, lock loading views, and rebuild version history"],
  ["v1.118.6", "Show the content-area scrollbar from the first page render"],
  ["v1.118.5", "Extend the global shell to the right edge and keep version UI current"],
  ["v1.118.4", "Keep page scrollbars between the header and footer and sync the latest version"],
  ["v1.118.3", "Layer Evaluation search results above page content"],
  ["v1.118.2", "Fix Evaluation tooltip and empty height; cap MFL API at 50/min"],
  ["v1.118.1", "Keep the Evaluation header sticky and focus empty player search"],
  ["v1.118.0", "Use Supabase season ratios for Evaluation discount rates"],
  ["v1.117.6", "Keep Search, Advanced Settings, and Saved Evaluations above page content"],
  ["v1.117.5", "Keep Search and Advanced Settings above page content"],
  ["v1.117.4", "Extend the empty Evaluation page to the footer"],
  ["v1.117.3", "Layer Evaluation search results above page content without changing overflow"],
  ["v1.117.2", "Keep Evaluation search results above page content"],
  ["v1.117.1", "Prioritize Search results and hide Evaluation scrollbars"],
  ["v1.117.0", "Build player batches from PlayMFL instead of Flow"],
];

const PRODUCTION_ORIGIN = String(
  process.env.MFL_FRONT_OFFICE_PRODUCTION_ORIGIN || "https://mfl-front-office.vercel.app",
).replace(/\/+$/, "");
const RATIO_REQUEST_TIMEOUT_MS = 5000;

function normalizeRows(value) {
  return (Array.isArray(value) ? value : [])
    .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
    .filter((row) => Number.isInteger(row.season) && row.season > 0
      && Number.isFinite(row.ratio) && row.ratio > 0)
    .sort((a, b) => b.season - a.season)
    .slice(0, 5);
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  return url && key ? { url, key } : null;
}

function requestHostname(request) {
  const value = String(request?.headers?.["x-forwarded-host"] || request?.headers?.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (value.startsWith("[")) return value.slice(1, value.indexOf("]"));
  return value.split(":")[0];
}

function isLocalRequest(request) {
  const hostname = requestHostname(request);
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.endsWith(".localhost");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = RATIO_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`MFL season ratio request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function loadFromSupabase(config) {
  const response = await fetchWithTimeout(
    `${config.url}/rest/v1/mfl_season_ratios?select=season,ratio&order=season.desc&limit=5`,
    {
      cache: "no-store",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`MFL season ratio query failed with ${response.status}: ${await response.text()}`);
  }
  return normalizeRows(await response.json());
}

async function loadFromDeployment() {
  const response = await fetchWithTimeout(`${PRODUCTION_ORIGIN}/api/mfl-season-ratios?source=vercel-dev`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Deployed MFL season ratio fallback failed with ${response.status}.`);
  return normalizeRows((await response.json())?.ratios);
}

async function loadRatios(request) {
  const config = supabaseConfig();
  if (config) return loadFromSupabase(config);
  if (isLocalRequest(request)) return loadFromDeployment();
  throw new Error("Supabase is not configured for MFL season ratios.");
}

function loaderScript() {
  const payload = JSON.stringify({ version: APP_VERSION, releases: APP_RELEASES, rows: [], warning: "" });
  const criticalCss = `
    .siteFooter a[data-page="changelog"] { font-size: 14px !important; }

    html:not(.mflEvaluationRateResolved) body[data-page="evaluation"] #evaluationDiscountRate,
    html:not(.mflEvaluationRateResolved) body[data-page="evaluation"] #advancedDiscountRateValue {
      color: transparent !important;
      position: relative !important;
      text-align: right !important;
    }
    html:not(.mflEvaluationRateResolved) body[data-page="evaluation"] #evaluationDiscountRate::after,
    html:not(.mflEvaluationRateResolved) body[data-page="evaluation"] #advancedDiscountRateValue::after {
      content: "-" !important;
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      color: var(--text, #f5f5f5) !important;
      text-align: right !important;
      pointer-events: none !important;
    }
    html.mflEvaluationRateResolved body[data-page="evaluation"] #evaluationDiscountRate::after,
    html.mflEvaluationRateResolved body[data-page="evaluation"] #advancedDiscountRateValue::after {
      content: none !important;
      display: none !important;
    }

    html.mflEvaluationInitialLoadVisible #evaluationLoadButton,
    html.mflEvaluationInitialLoadVisible #evaluationLoadButton[hidden] {
      display: inline-flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    html.mflEvaluationInitialStateReady:not(.mflEvaluationInitialLoadVisible) #evaluationLoadButton,
    body.evaluationPlayerRoute #evaluationLoadButton { display: none !important; }

    html.mflStatsStableLoading,
    html.mflStatsStableLoading *,
    body.mflStatsStableLoading,
    body.mflStatsStableLoading * {
      cursor: wait !important;
    }
    html.mflStatsNativeReady body::after,
    body[data-page="mflstats"].mflStatsNativeReady::after {
      display: none !important;
      pointer-events: none !important;
    }
    html.mflStatsNativeReady #loadingScreen,
    body[data-page="mflstats"].mflStatsNativeReady #loadingScreen {
      pointer-events: none !important;
    }
    body[data-page="mflstats"] #mflStatsPage,
    body[data-page="mflstats"] .mflStatsFilters,
    body[data-page="mflstats"] #mflStatsOverallFilters,
    body[data-page="mflstats"] .mflStatsFilterButton {
      pointer-events: auto !important;
    }

    #playerDetail .contractDetailCard strong .playerContractTeamLink {
      color: var(--text) !important;
      font-weight: 600 !important;
      text-decoration: none !important;
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    #playerDetail .contractDetailCard strong .playerContractTeamLink:hover,
    #playerDetail .contractDetailCard strong .playerContractTeamLink:focus-visible {
      color: var(--primary) !important;
      text-decoration: none !important;
    }
  `;

  return `(() => {
  const VERSION = ${JSON.stringify(APP_VERSION)};
  window.__mflSeasonRatioPayload = ${payload};

  const FILTER_SELECTOR = "#mflStatsOverallFilters .mflStatsFilterButton";
  const BUSY_EVENTS = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  const CLUB_ID_COLUMNS = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];

  let evaluationRequestStarted = false;
  let evaluationResolvedRate = null;
  let evaluationResolvedLabel = "";
  let evaluationController = null;
  let maintainQueued = false;
  let bootstrapClubsPromise = null;
  let statsRendererWrapped = false;
  let statsBlockerWrapped = false;
  let playerRendererWrapped = false;

  function cleanPath() {
    return String(location.pathname || "/").replace(/\\/+$/, "") || "/";
  }

  function isEvaluationRoute() {
    return cleanPath() === "/evaluation" || document.body?.dataset.page === "evaluation";
  }

  function isStatsRoute() {
    return cleanPath() === "/mfl/stats" || document.body?.dataset.page === "mflstats";
  }

  function currentPlayerId() {
    const match = cleanPath().match(/^\\/players?\\/([^/]+)$/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  let critical = document.getElementById("mflCriticalRuntimeStyles");
  if (!critical) {
    critical = document.createElement("style");
    critical.id = "mflCriticalRuntimeStyles";
    document.head.appendChild(critical);
  }
  critical.textContent = ${JSON.stringify(criticalCss)};

  function syncVersion() {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = "MFL Front Office v" + VERSION;
  }

  function storedWalletOptIn() {
    try {
      const address = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim();
      const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
      return Boolean(address && proof?.address && proof?.message
        && Array.isArray(proof?.signatures) && proof.signatures.length);
    } catch {
      return false;
    }
  }

  function evaluationHasSelection() {
    const params = new URLSearchParams(location.search);
    if (params.get("player") || params.get("share") || params.get("saved")) return true;
    try {
      return Boolean(typeof state === "object" && state?.evaluationPlayerId);
    } catch {
      return false;
    }
  }

  function syncEvaluationShell() {
    if (!isEvaluationRoute()) return;
    let optedIn = storedWalletOptIn();
    try {
      if (typeof hasWalletOptIn === "function") optedIn = hasWalletOptIn();
    } catch {
      // Stored proof is available before application state.
    }
    const showLoad = optedIn && !evaluationHasSelection();
    document.documentElement.classList.add("mflEvaluationInitialStateReady");
    document.documentElement.classList.toggle("mflEvaluationInitialLoadVisible", showLoad);
    document.body?.classList.toggle("evaluationPlayerRoute", Boolean(new URLSearchParams(location.search).get("player")));
    document.body?.classList.add("evaluationRouteResolved", "evaluationDiscountRateReady", "evaluationPageReady");
    const button = document.getElementById("evaluationLoadButton");
    if (button) {
      button.hidden = !showLoad;
      button.toggleAttribute("aria-hidden", !showLoad);
    }
  }

  function assignEvaluationRateFunction(rate) {
    try {
      if (typeof evaluationDiscountRateValue === "function") {
        evaluationDiscountRateValue = () => Number.isFinite(rate) ? rate : 0;
      }
    } catch {
      // The DOM remains authoritative.
    }
  }

  function enforceEvaluationRate() {
    if (!isEvaluationRoute()) return;
    syncEvaluationShell();
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (evaluationResolvedLabel) {
      document.documentElement.classList.add("mflEvaluationRateResolved");
      assignEvaluationRateFunction(evaluationResolvedRate);
      if (value && value.textContent !== evaluationResolvedLabel) value.textContent = evaluationResolvedLabel;
      if (advanced && advanced.textContent !== evaluationResolvedLabel) advanced.textContent = evaluationResolvedLabel;
    } else {
      document.documentElement.classList.remove("mflEvaluationRateResolved");
      assignEvaluationRateFunction(0);
      if (value && value.textContent !== "-") value.textContent = "-";
      if (advanced && advanced.textContent !== "-") advanced.textContent = "-";
    }
  }

  function calculateRate(rows) {
    const ordered = (Array.isArray(rows) ? rows : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && row.season > 0
        && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-5);
    if (ordered.length !== 5) return null;
    const product = ordered.slice(1).reduce((result, row, index) => (
      result * (row.ratio / ordered[index].ratio)
    ), 1);
    const rate = Math.pow(product, 1 / 4) - 1;
    return Number.isFinite(rate) ? { rate, ordered } : null;
  }

  function startEvaluationRequest() {
    if (!isEvaluationRoute() || evaluationRequestStarted) return;
    evaluationRequestStarted = true;
    evaluationResolvedRate = null;
    evaluationResolvedLabel = "";
    enforceEvaluationRate();
    evaluationController?.abort();
    evaluationController = new AbortController();
    const timeout = setTimeout(() => evaluationController?.abort(), 5500);
    fetch("/api/mfl-season-ratios?v=" + encodeURIComponent(VERSION), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: evaluationController.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
        const calculated = calculateRate(data.ratios);
        if (!calculated) throw new Error("Supabase did not return five valid season ratios.");
        evaluationResolvedRate = calculated.rate;
        evaluationResolvedLabel = (calculated.rate * 100).toFixed(2) + "%";
        window.mflSeasonRatios = Object.freeze(calculated.ordered.map((row) => Object.freeze({ ...row })));
        window.__mflSeasonRatioResult = { rows: calculated.ordered, warning: "" };
        const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
        if (box) {
          box.dataset.tooltip = "Discount Rate is calculated from the latest five completed seasons stored in Supabase (Seasons "
            + calculated.ordered[0].season + "-" + calculated.ordered[4].season + ").";
        }
        enforceEvaluationRate();
        try {
          if (typeof renderEvaluationPage === "function") renderEvaluationPage();
        } catch {
          // An empty evaluation has no player panel to render.
        }
        queueMicrotask(enforceEvaluationRate);
        requestAnimationFrame(enforceEvaluationRate);
        window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", {
          detail: window.__mflSeasonRatioResult,
        }));
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.error("Could not load the Evaluation Discount Rate from Supabase.", error);
        }
        enforceEvaluationRate();
      })
      .finally(() => clearTimeout(timeout));
  }

  function statsFilterTarget(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest(FILTER_SELECTOR) || null;
  }

  function syncNativeStatsButtons() {
    if (!isStatsRoute()) return;
    let activeId = "all";
    try {
      if (typeof state === "object" && state?.mflStatsOverallFilter) activeId = state.mflStatsOverallFilter;
    } catch {
      activeId = "all";
    }
    document.querySelectorAll(FILTER_SELECTOR).forEach((button) => {
      button.disabled = false;
      button.removeAttribute("disabled");
      button.removeAttribute("aria-disabled");
      button.style.pointerEvents = "auto";
      try {
        if (typeof mflStatsOverallFilterOptions !== "undefined") {
          const option = mflStatsOverallFilterOptions.find((item) => (
            String(item?.label || "").trim() === String(button.textContent || "").trim()
          ));
          if (option?.id) button.classList.toggle("active", option.id === activeId);
        }
      } catch {
        // Native render state remains available.
      }
    });
  }

  function installStatsRendererGuard() {
    if (statsRendererWrapped || typeof renderMflStatsFilterButtons !== "function") return;
    const originalRender = renderMflStatsFilterButtons;
    renderMflStatsFilterButtons = function stableMflStatsFilterButtons() {
      const filters = document.getElementById("mflStatsOverallFilters");
      if (filters?.querySelector(".mflStatsFilterButton")) {
        syncNativeStatsButtons();
        return;
      }
      const result = originalRender.apply(this, arguments);
      queueMicrotask(syncNativeStatsButtons);
      return result;
    };
    renderMflStatsFilterButtons.__mflStableRenderer = true;
    statsRendererWrapped = true;
  }

  function installStatsBusyBypass() {
    if (statsBlockerWrapped || typeof blockInteractionWhileBusy !== "function") return;
    const originalBlocker = blockInteractionWhileBusy;
    BUSY_EVENTS.forEach((eventName) => document.removeEventListener(eventName, originalBlocker, true));
    const replacement = (event) => {
      if (isStatsRoute() && statsFilterTarget(event)) return;
      originalBlocker(event);
    };
    BUSY_EVENTS.forEach((eventName) => document.addEventListener(eventName, replacement, true));
    blockInteractionWhileBusy.__mflStatsBypass = true;
    statsBlockerWrapped = true;
  }

  function statsDataReady() {
    if (!isStatsRoute()) return false;
    const page = document.getElementById("mflStatsPage");
    const filters = document.getElementById("mflStatsOverallFilters");
    if (!page || page.hidden || !filters?.querySelector(".mflStatsFilterButton")) return false;
    const loadingMessage = Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || "")));
    const total = String(document.getElementById("mflStatsTotalPlayers")?.textContent || "")
      .replace(/,/g, "")
      .trim();
    let incrementalApplying = false;
    try {
      incrementalApplying = Boolean(typeof state === "object" && state?.incrementalApplying);
    } catch {
      incrementalApplying = false;
    }
    return !loadingMessage && !incrementalApplying && total !== "" && Number.isFinite(Number(total));
  }

  function clearInert(element) {
    if (!(element instanceof HTMLElement)) return;
    element.inert = false;
    element.removeAttribute("inert");
  }

  function releaseStatsWhenReady() {
    if (!statsDataReady()) return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch {
      // DOM cleanup remains authoritative.
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending");
    document.body?.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching",
    );
    document.documentElement.classList.add("mflStatsNativeReady");
    document.body?.classList.add("mflStatsInteractive", "mflStatsNativeReady");
    document.body?.setAttribute("aria-busy", "false");
    const filters = document.getElementById("mflStatsOverallFilters");
    for (let element = filters; element; element = element.parentElement) clearInert(element);
    [document.body, document.getElementById("appShell"), document.querySelector("main"), document.getElementById("mflStatsPage")]
      .forEach(clearInert);
    document.getElementById("mflStatsPage")?.querySelectorAll("[inert]").forEach(clearInert);
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) {
      loadingScreen.hidden = true;
      loadingScreen.setAttribute("aria-hidden", "true");
      loadingScreen.style.pointerEvents = "none";
    }
    syncNativeStatsButtons();
    return true;
  }

  function syncStatsLoading() {
    const active = isStatsRoute();
    const loading = active && !statsDataReady();
    document.documentElement.classList.toggle("mflStatsStableLoading", loading);
    document.body?.classList.toggle("mflStatsStableLoading", loading);
    if (!active) {
      document.documentElement.classList.remove("mflStatsNativeReady");
      document.body?.classList.remove("mflStatsNativeReady", "mflStatsInteractive");
      return;
    }
    if (!loading) releaseStatsWhenReady();
  }

  ["pointerdown", "mousedown", "click"].forEach((eventName) => {
    window.addEventListener(eventName, (event) => {
      if (!isStatsRoute() || !statsFilterTarget(event) || !statsDataReady()) return;
      try {
        if (typeof state === "object" && state) state.interactionBusyDepth = 0;
        if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
      } catch {
        // The document blocker replacement still permits the event.
      }
    }, true);
  });

  function rowForPlayer(playerId) {
    try {
      if (typeof rowByPlayerId === "function") return rowByPlayerId(playerId);
      if (typeof state === "object" && Array.isArray(state?.rows) && Array.isArray(state?.columns)) {
        const index = state.columns.indexOf("player_id");
        return index >= 0 ? state.rows.find((row) => String(row[index]) === String(playerId)) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  function clubIdFromRow(row) {
    if (!row) return "";
    try {
      if (typeof getValue === "function") {
        for (const column of CLUB_ID_COLUMNS) {
          const value = String(getValue(row, column) || "").trim();
          if (value) return value;
        }
      }
      if (typeof state === "object" && Array.isArray(state?.columns)) {
        for (const column of CLUB_ID_COLUMNS) {
          const index = state.columns.indexOf(column);
          const value = index >= 0 ? String(row[index] || "").trim() : "";
          if (value) return value;
        }
      }
    } catch {
      return "";
    }
    return "";
  }

  function clubIdFromIndexes(teamName) {
    const normalized = String(teamName || "").trim().toLowerCase();
    try {
      const clubs = [
        ...(Array.isArray(state?.clubSearchIndex) ? state.clubSearchIndex : []),
        ...(Array.isArray(state?.bootstrapData?.clubs) ? state.bootstrapData.clubs : []),
      ];
      const match = clubs.find((club) => String(club?.name || "").trim().toLowerCase() === normalized);
      return String(match?.clubId || "").trim();
    } catch {
      return "";
    }
  }

  function loadBootstrapClubs() {
    if (bootstrapClubsPromise) return bootstrapClubsPromise;
    bootstrapClubsPromise = new Promise((resolve) => {
      const request = new XMLHttpRequest();
      request.open("GET", "/api/data?mode=bootstrap&v=" + encodeURIComponent(VERSION), true);
      request.timeout = 6000;
      request.onload = () => {
        try {
          const payload = JSON.parse(request.responseText || "{}");
          resolve(Array.isArray(payload?.clubs) ? payload.clubs : []);
        } catch {
          resolve([]);
        }
      };
      request.onerror = () => resolve([]);
      request.ontimeout = () => resolve([]);
      request.send(null);
    }).finally(() => {
      bootstrapClubsPromise = null;
    });
    return bootstrapClubsPromise;
  }

  async function resolveClubId(teamName, playerId) {
    const row = rowForPlayer(playerId);
    let clubId = clubIdFromRow(row) || clubIdFromIndexes(teamName);
    if (clubId) return clubId;
    const clubs = await loadBootstrapClubs();
    const normalized = String(teamName || "").trim().toLowerCase();
    const match = clubs.find((club) => String(club?.name || "").trim().toLowerCase() === normalized);
    return String(match?.clubId || "").trim();
  }

  function bindPlayerContractLink() {
    const playerId = currentPlayerId();
    if (!playerId) return false;
    const team = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam");
    if (!team) return false;
    if (team.tagName === "A" && team.dataset.mflContractLink === VERSION) return true;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return false;

    const immediateClubId = clubIdFromRow(rowForPlayer(playerId)) || clubIdFromIndexes(teamName);
    const link = document.createElement("a");
    link.className = String(team.className || "playerContractTeam") + " clubPageLink playerContractTeamLink";
    link.textContent = teamName;
    link.dataset.mflContractLink = VERSION;
    link.dataset.playerId = playerId;
    link.dataset.teamName = teamName;
    link.dataset.clubId = immediateClubId;
    link.href = immediateClubId ? "/clubs/" + encodeURIComponent(immediateClubId) + "/attributes" : "#";
    link.addEventListener("click", async (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button === 1) return;
      let clubId = String(link.dataset.clubId || "").trim();
      if (!clubId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clubId = await resolveClubId(teamName, playerId);
        if (!clubId) {
          if (typeof showToast === "function") showToast("Club page could not be loaded.");
          return;
        }
        link.dataset.clubId = clubId;
        link.href = "/clubs/" + encodeURIComponent(clubId) + "/attributes";
      }
      if (typeof window.mflOpenClubPage === "function") {
        event.preventDefault();
        window.mflOpenClubPage(clubId, "attributes");
      }
    }, true);
    team.replaceWith(link);
    return true;
  }

  function installPlayerRendererHook() {
    if (playerRendererWrapped || typeof renderPlayerPage !== "function") return;
    const originalRender = renderPlayerPage;
    renderPlayerPage = function linkedPlayerContractRender() {
      const result = originalRender.apply(this, arguments);
      queueMicrotask(bindPlayerContractLink);
      requestAnimationFrame(bindPlayerContractLink);
      return result;
    };
    renderPlayerPage.__mflContractLink = true;
    playerRendererWrapped = true;
  }

  function maintain() {
    syncVersion();
    installStatsRendererGuard();
    installStatsBusyBypass();
    installPlayerRendererHook();
    if (isEvaluationRoute()) {
      syncEvaluationShell();
      enforceEvaluationRate();
      startEvaluationRequest();
    }
    syncStatsLoading();
    if (currentPlayerId()) bindPlayerContractLink();
  }

  function scheduleMaintain() {
    if (maintainQueued) return;
    maintainQueued = true;
    requestAnimationFrame(() => {
      maintainQueued = false;
      maintain();
    });
  }

  const observer = new MutationObserver(scheduleMaintain);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "hidden", "disabled", "inert", "aria-disabled"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  ["popstate", "hashchange", "mfl:season-ratios-ready"].forEach((name) => {
    window.addEventListener(name, scheduleMaintain);
  });
  document.addEventListener("focusin", scheduleMaintain, true);

  if (isStatsRoute()) {
    document.documentElement.classList.add("mflStatsStableLoading");
    document.body?.classList.add("mflStatsStableLoading");
  }

  maintain();
  [0, 50, 150, 400, 1000, 2000].forEach((delay) => setTimeout(maintain, delay));

  document.getElementById("mflSeasonRatioRuntime")?.remove();
  const runtime = document.createElement("script");
  runtime.id = "mflSeasonRatioRuntime";
  runtime.src = "/mfl-season-ratios-runtime.js?v=" + encodeURIComponent(VERSION);
  runtime.async = false;
  document.head.appendChild(runtime);
})();
`;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const scriptMode = String(request.query?.format || "").toLowerCase() === "script";
  if (scriptMode) {
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.status(200).send(loaderScript());
    return;
  }

  try {
    const ratios = await loadRatios(request);
    if (ratios.length !== 5) throw new Error(`Expected 5 MFL season ratios, received ${ratios.length}.`);
    response.status(200).json({ ratios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load MFL season ratios.";
    console.error(message);
    response.status(500).json({ error: message });
  }
};
