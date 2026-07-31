const APP_VERSION = "1.118.26";
const APP_RELEASES = [
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
  const FILTER_SELECTOR = "#mflStatsOverallFilters .mflStatsFilterButton";
  const FILTER_IDS = new Map([
    ["All", "all"], ["90-94", "90-94"], ["Legendary", "legendary"],
    ["85-89", "85-89"], ["80-84", "80-84"], ["Rare", "rare"],
    ["75-79", "75-79"], ["70-74", "70-74"], ["Uncommon", "uncommon"],
    ["65-69", "65-69"], ["60-64", "60-64"], ["55-59", "55-59"],
    ["50-54", "50-54"], ["Common", "common"],
  ]);
  let scheduled = false;
  let statsFrame = 0;

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

  function evaluationRouteActive() {
    return location.pathname === "/evaluation" || document.body?.dataset?.page === "evaluation";
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
    const active = evaluationRouteActive();
    if (!active) {
      document.documentElement.classList.remove(
        "mflEvaluationInitialStateReady",
        "mflEvaluationInitialLoadVisible",
      );
      return;
    }

    let optedIn = storedWalletOptIn();
    try {
      if (typeof hasWalletOptIn === "function") optedIn = hasWalletOptIn();
    } catch {
      // Stored proof is available before the application state finishes loading.
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

  function statsRouteActive() {
    return location.pathname === "/mfl/stats" || document.body?.dataset?.page === "mflstats";
  }

  function statsReady() {
    if (!statsRouteActive()) return false;
    const page = document.getElementById("mflStatsPage");
    if (!page || page.hidden) return false;
    const total = String(document.getElementById("mflStatsTotalPlayers")?.textContent || "").trim();
    const loadingMessage = Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || "")));
    return /^\d[\d,.]*$/.test(total)
      && !loadingMessage
      && Boolean(page.querySelector(FILTER_SELECTOR));
  }

  function removeInert(element) {
    if (!(element instanceof HTMLElement)) return;
    if (element.inert) element.inert = false;
    element.removeAttribute("inert");
  }

  function releaseStatsInteractions() {
    if (!statsReady()) return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch {
      // DOM state below remains authoritative.
    }

    document.documentElement.classList.remove(
      "appBusy", "loading", "bootPending", "table-layout-pending",
      "mflStatsLoading", "mflStatsStableLoading",
    );
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

  function syncStatsState() {
    const active = statsRouteActive();
    if (!active) {
      document.documentElement.classList.remove("mflStatsStableLoading");
      if (statsFrame) cancelAnimationFrame(statsFrame);
      statsFrame = 0;
      return;
    }

    const ready = statsReady();
    document.documentElement.classList.toggle("mflStatsStableLoading", !ready);
    if (ready) releaseStatsInteractions();

    if (!statsFrame) {
      const frame = () => {
        statsFrame = 0;
        if (!statsRouteActive()) return;
        const nowReady = statsReady();
        document.documentElement.classList.toggle("mflStatsStableLoading", !nowReady);
        if (nowReady) releaseStatsInteractions();
        statsFrame = requestAnimationFrame(frame);
      };
      statsFrame = requestAnimationFrame(frame);
    }
  }

  function filterButton(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest(FILTER_SELECTOR) || null;
  }

  window.addEventListener("click", (event) => {
    const button = filterButton(event);
    if (!button || !statsReady()) return;
    const filterId = FILTER_IDS.get(String(button.textContent || "").trim());
    if (!filterId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    releaseStatsInteractions();
    try {
      if (typeof state !== "object" || typeof renderMflStatsPage !== "function") return;
      state.mflStatsOverallFilter = filterId;
      renderMflStatsPage();
      queueMicrotask(releaseStatsInteractions);
      requestAnimationFrame(releaseStatsInteractions);
    } catch (error) {
      console.error("Could not apply the MFL Stats filter.", error);
    }
  }, true);

  function run() {
    scheduled = false;
    syncEvaluationInitialState();
    syncStatsState();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(run);
  }

  const observer = new MutationObserver(schedule);
  const startObserver = () => {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-page", "hidden", "inert", "aria-busy"],
      childList: true,
      subtree: true,
    });
    run();
  };
  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  window.addEventListener("popstate", schedule);
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
  window.__mflSeasonRatioPayload = ${initialPayload};

  let critical = document.getElementById("mflCriticalRuntimeStyles");
  if (!critical) {
    critical = document.createElement("style");
    critical.id = "mflCriticalRuntimeStyles";
    document.head.appendChild(critical);
  }

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
  const evaluationRoute = location.pathname === "/evaluation";
  const evaluationHasSelection = evaluationRoute
    && Boolean(params.get("player") || params.get("share") || params.get("saved"));
  document.documentElement.classList.toggle(
    "mflEvaluationInitialLoadVisible",
    evaluationRoute && initialOptIn && !evaluationHasSelection,
  );
  if (evaluationRoute) document.documentElement.classList.add("mflEvaluationInitialStateReady");
  if (location.pathname === "/mfl/stats") document.documentElement.classList.add("mflStatsStableLoading");

  critical.textContent = \`
    html body[data-page="evaluation"] #evaluationPage,
    html body[data-page="evaluation"]:not(.evaluationPageReady) #evaluationPage {
      display: block !important; visibility: visible !important; opacity: 1 !important;
    }
    body[data-page="evaluation"]::after { display: none !important; pointer-events: none !important; }
    html[data-initial-page="evaluation"] body:not(.evaluationDiscountRateReady) #evaluationDiscountRate,
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

  document.getElementById("mflEarlyRouteFixes")?.remove();
  const earlyFixes = document.createElement("script");
  earlyFixes.id = "mflEarlyRouteFixes";
  earlyFixes.textContent = ${earlyFixSource};
  document.head.appendChild(earlyFixes);

  let runtimeLoaded = false;
  const loadRuntime = (rows = [], warning = "") => {
    if (runtimeLoaded) return;
    runtimeLoaded = true;
    window.__mflSeasonRatioPayload = {
      version: ${JSON.stringify(APP_VERSION)},
      releases: ${JSON.stringify(APP_RELEASES)},
      rows: Array.isArray(rows) ? rows : [],
      warning: String(warning || ""),
    };
    document.getElementById("mflSeasonRatioRuntime")?.remove();
    const script = document.createElement("script");
    script.id = "mflSeasonRatioRuntime";
    script.src = "/mfl-season-ratios-runtime.js?v=${APP_VERSION}";
    script.async = false;
    document.head.appendChild(script);
  };

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
      loadRuntime(data.ratios || []);
    })
    .catch((error) => {
      loadRuntime([], error?.name === "AbortError"
        ? "MFL season ratio request timed out. Using the built-in discount-rate history."
        : String(error?.message || "Could not load MFL season ratios. Using the built-in history."));
    })
    .finally(() => clearTimeout(timeout));
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
