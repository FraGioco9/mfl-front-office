const APP_VERSION = "1.118.27";
const APP_RELEASES = [
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
  ["v1.118.1", "Keep the Evaluation header sticky and focus empty Evaluation search"],
  ["v1.118.0", "Use Supabase season ratios for Evaluation discount rates"],
  ["v1.117.6", "Keep Search, Advanced Settings, and Saved Evaluations above page content"],
  ["v1.117.5", "Keep Search and Advanced Settings above page content"],
  ["v1.117.4", "Extend the empty Evaluation page to the footer"],
  ["v1.117.3", "Layer Evaluation search results above page content without changing overflow"],
  ["v1.117.2", "Keep Evaluation search results above page content"],
  ["v1.117.1", "Prioritize Search results and hide Evaluation scrollbars"],
  ["v1.117.0", "Build player batches from PlayMFL instead of Flow"],
];

const EARLY_FIX_SOURCE = String.raw`(() => {
  const evaluationRoute = location.pathname === "/evaluation";
  const statsRoute = location.pathname === "/mfl/stats";
  if (!evaluationRoute && !statsRoute) return;

  const FILTER_SELECTOR = "#mflStatsOverallFilters .mflStatsFilterButton";
  const FILTER_IDS = new Map([
    ["All", "all"], ["90-94", "90-94"], ["Legendary", "legendary"],
    ["85-89", "85-89"], ["80-84", "80-84"], ["Rare", "rare"],
    ["75-79", "75-79"], ["70-74", "70-74"], ["Uncommon", "uncommon"],
    ["65-69", "65-69"], ["60-64", "60-64"], ["55-59", "55-59"],
    ["50-54", "50-54"], ["Common", "common"],
  ]);
  let statsFrame = 0;
  let ratioApplyFrame = 0;

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

  function syncEvaluationInitialState() {
    if (!evaluationRoute) return;
    let optedIn = storedWalletOptIn();
    try {
      if (typeof hasWalletOptIn === "function") optedIn = hasWalletOptIn();
    } catch {
      // Stored proof is available before application state.
    }
    const showLoad = optedIn && !evaluationHasSelection();
    document.documentElement.classList.toggle("mflEvaluationInitialLoadVisible", showLoad);
    document.documentElement.classList.add("mflEvaluationInitialStateReady");
    document.body?.classList.toggle("evaluationPlayerRoute", Boolean(new URLSearchParams(location.search).get("player")));
    document.body?.classList.add("evaluationRouteResolved");
    const button = document.getElementById("evaluationLoadButton");
    if (button) {
      button.hidden = !showLoad;
      button.toggleAttribute("aria-hidden", !showLoad);
    }
  }

  function calculateDiscountRate(rows) {
    const ordered = (Array.isArray(rows) ? rows : [])
      .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
      .filter((row) => Number.isInteger(row.season) && Number.isFinite(row.ratio) && row.ratio > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-5);
    if (ordered.length !== 5) return null;
    const product = ordered.slice(1).reduce((value, row, index) => (
      value * (row.ratio / ordered[index].ratio)
    ), 1);
    const rate = Math.pow(product, 1 / 4) - 1;
    return Number.isFinite(rate) ? { rate, ordered } : null;
  }

  function formatRate(rate) {
    try {
      if (typeof formatEvaluationRate === "function") return formatEvaluationRate(rate);
    } catch {
      // Equivalent formatting below.
    }
    return (Number(rate) * 100).toFixed(2) + "%";
  }

  function applyRatioResult(detail, attempts = 0) {
    if (!evaluationRoute) return;
    const calculated = calculateDiscountRate(detail?.rows);
    let rate = calculated?.rate;
    if (!Number.isFinite(rate)) {
      try {
        if (typeof evaluationDiscountRateValue === "function") rate = Number(evaluationDiscountRateValue());
      } catch {
        rate = NaN;
      }
    }
    const value = document.getElementById("evaluationDiscountRate");
    if ((!value || !Number.isFinite(rate)) && attempts < 180) {
      ratioApplyFrame = requestAnimationFrame(() => applyRatioResult(detail, attempts + 1));
      return;
    }
    if (Number.isFinite(rate)) {
      try {
        evaluationDiscountRateValue = () => rate;
      } catch {
        // The displayed value is still updated below.
      }
      if (calculated) {
        window.mflSeasonRatios = Object.freeze(
          calculated.ordered.map((row) => Object.freeze({ ...row })),
        );
      }
      const label = formatRate(rate);
      if (value) value.textContent = label;
      const advanced = document.getElementById("advancedDiscountRateValue");
      if (advanced) advanced.textContent = label;
      document.body?.classList.add("evaluationDiscountRateReady");
    }
    document.documentElement.classList.remove("mflEvaluationRatioPending");
  }

  if (evaluationRoute) {
    syncEvaluationInitialState();
    window.addEventListener("mfl:season-ratios-ready", (event) => {
      if (ratioApplyFrame) cancelAnimationFrame(ratioApplyFrame);
      applyRatioResult(event.detail || {});
    });
    if (window.__mflSeasonRatioResult) applyRatioResult(window.__mflSeasonRatioResult);
    const evaluationObserver = new MutationObserver(syncEvaluationInitialState);
    const startEvaluationObserver = () => evaluationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-page"],
      childList: true,
      subtree: true,
    });
    if (document.body) startEvaluationObserver();
    else document.addEventListener("DOMContentLoaded", startEvaluationObserver, { once: true });
  }

  function statsReady() {
    if (!statsRoute) return false;
    const page = document.getElementById("mflStatsPage");
    if (!page || page.hidden) return false;
    const total = String(document.getElementById("mflStatsTotalPlayers")?.textContent || "").trim();
    const loadingMessage = Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || "")));
    return /^\d[\d,.]*$/.test(total) && !loadingMessage;
  }

  function removeInert(element) {
    if (!(element instanceof HTMLElement)) return;
    element.inert = false;
    element.removeAttribute("inert");
  }

  function releaseStatsInteractions() {
    if (!statsRoute) return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch {
      // DOM cleanup below remains authoritative.
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending", "mflStatsLoading");
    document.body?.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching", "mflStatsLoading",
    );
    document.body?.classList.add("mflStatsInteractive");
    document.body?.setAttribute("aria-busy", "false");
    [document.body, document.getElementById("appShell"), document.querySelector("main"),
      document.getElementById("mflStatsPage"), document.getElementById("mflStatsOverallFilters")]
      .forEach(removeInert);
    document.querySelectorAll("#mflStatsPage [inert]").forEach(removeInert);
    document.querySelectorAll(FILTER_SELECTOR + ", .mflStatsDistributionModeButton").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.style.pointerEvents = "auto";
    });
    return true;
  }

  function filterButton(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest(FILTER_SELECTOR) || null;
  }

  if (statsRoute) {
    ["pointerdown", "mousedown"].forEach((name) => {
      window.addEventListener(name, (event) => {
        if (!filterButton(event)) return;
        releaseStatsInteractions();
        event.stopPropagation();
      }, true);
    });
    window.addEventListener("click", (event) => {
      const button = filterButton(event);
      if (!button) return;
      const filterId = FILTER_IDS.get(String(button.textContent || "").trim());
      if (!filterId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      releaseStatsInteractions();
      try {
        if (typeof state !== "object") return;
        state.mflStatsOverallFilter = filterId;
        if (typeof renderMflStatsPage === "function") renderMflStatsPage();
      } catch (error) {
        console.error("Could not apply the MFL Stats filter.", error);
      }
      queueMicrotask(releaseStatsInteractions);
      requestAnimationFrame(releaseStatsInteractions);
    }, true);

    const frame = () => {
      if (!statsRoute || location.pathname !== "/mfl/stats") {
        statsFrame = 0;
        return;
      }
      const ready = statsReady();
      document.documentElement.classList.toggle("mflStatsStableLoading", !ready);
      if (ready) releaseStatsInteractions();
      statsFrame = requestAnimationFrame(frame);
    };
    statsFrame = requestAnimationFrame(frame);
  }
})();`;

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
  const initialPayload = JSON.stringify({
    version: APP_VERSION,
    releases: APP_RELEASES,
    rows: [],
    warning: "",
  });
  const earlyFixSource = JSON.stringify(EARLY_FIX_SOURCE);
  return `(() => {
  const evaluationRoute = location.pathname === "/evaluation";
  const statsRoute = location.pathname === "/mfl/stats";
  window.__mflSeasonRatioPayload = ${initialPayload};

  let critical = document.getElementById("mflCriticalRuntimeStyles");
  if (!critical) {
    critical = document.createElement("style");
    critical.id = "mflCriticalRuntimeStyles";
    document.head.appendChild(critical);
  }

  if (evaluationRoute) {
    document.documentElement.classList.add("mflEvaluationRatioPending");
    let initialOptIn = false;
    try {
      const address = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim();
      const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
      initialOptIn = Boolean(address && proof?.address && proof?.message
        && Array.isArray(proof?.signatures) && proof.signatures.length);
    } catch {
      initialOptIn = false;
    }
    const params = new URLSearchParams(location.search);
    const hasSelection = Boolean(params.get("player") || params.get("share") || params.get("saved"));
    document.documentElement.classList.toggle("mflEvaluationInitialLoadVisible", initialOptIn && !hasSelection);
    document.documentElement.classList.add("mflEvaluationInitialStateReady");
  }
  if (statsRoute) document.documentElement.classList.add("mflStatsStableLoading");

  critical.textContent = \`
    html body[data-page="evaluation"] #evaluationPage,
    html body[data-page="evaluation"]:not(.evaluationPageReady) #evaluationPage {
      display: block !important; visibility: visible !important; opacity: 1 !important;
    }
    body[data-page="evaluation"]::after { display: none !important; pointer-events: none !important; }
    html.mflEvaluationRatioPending #evaluationDiscountRate,
    body[data-page="evaluation"]:not(.evaluationDiscountRateReady) #evaluationDiscountRate {
      visibility: hidden !important;
    }
    html.mflEvaluationInitialLoadVisible #evaluationLoadButton,
    html.mflEvaluationInitialLoadVisible #evaluationLoadButton[hidden] {
      display: inline-flex !important; visibility: visible !important; opacity: 1 !important;
      pointer-events: auto !important;
    }
    html.mflEvaluationInitialStateReady:not(.mflEvaluationInitialLoadVisible) #evaluationLoadButton,
    body.evaluationPlayerRoute #evaluationLoadButton { display: none !important; }
    html.mflStatsStableLoading,
    html.mflStatsStableLoading * { cursor: wait !important; }
  \`;

  if (evaluationRoute || statsRoute) {
    document.getElementById("mflEarlyRouteFixes")?.remove();
    const earlyFixes = document.createElement("script");
    earlyFixes.id = "mflEarlyRouteFixes";
    earlyFixes.textContent = ${earlyFixSource};
    document.head.appendChild(earlyFixes);
  }

  document.getElementById("mflSeasonRatioRuntime")?.remove();
  const runtime = document.createElement("script");
  runtime.id = "mflSeasonRatioRuntime";
  runtime.src = "/mfl-season-ratios-runtime.js?v=${APP_VERSION}";
  runtime.async = false;
  document.head.appendChild(runtime);

  if (evaluationRoute) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    fetch("/api/mfl-season-ratios?v=${APP_VERSION}", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load MFL season ratios.");
        return { rows: data.ratios || [], warning: "" };
      })
      .catch((error) => ({
        rows: [],
        warning: error?.name === "AbortError"
          ? "MFL season ratio request timed out. Using the built-in discount-rate history."
          : String(error?.message || "Could not load MFL season ratios. Using the built-in history."),
      }))
      .then((detail) => {
        window.__mflSeasonRatioResult = detail;
        window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail }));
      })
      .finally(() => clearTimeout(timeout));
  }
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
