const APP_VERSION = "1.118.25";
const APP_RELEASES = [
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
  const CONTRACT_TEAM_SELECTOR = "#playerDetail .contractDetailCard .playerContractTeam";
  let playerRenderWrapped = false;

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

  function evaluationHasRouteSelection() {
    if (location.pathname !== "/evaluation") return false;
    const params = new URLSearchParams(location.search);
    return Boolean(params.get("player") || params.get("share") || params.get("saved"));
  }

  function syncEarlyEvaluationLoadButton() {
    const evaluationRoute = location.pathname === "/evaluation" || document.body?.dataset?.page === "evaluation";
    if (!evaluationRoute) {
      document.documentElement.classList.remove("mflEvaluationInitialLoadVisible");
      return;
    }
    let optedIn = storedWalletOptIn();
    try {
      if (typeof hasWalletOptIn === "function") optedIn = hasWalletOptIn();
    } catch {
      // Stored proof remains the initial source of truth.
    }
    let selected = evaluationHasRouteSelection();
    try {
      selected = selected || Boolean(typeof state === "object" && state?.evaluationPlayerId);
    } catch {
      // URL state remains available.
    }
    const show = optedIn && !selected;
    document.documentElement.classList.toggle("mflEvaluationInitialLoadVisible", show);
    const button = document.getElementById("evaluationLoadButton");
    if (button) {
      button.hidden = !show;
      button.toggleAttribute("aria-hidden", !show);
    }
  }

  function forceStatsInteractive() {
    if (location.pathname !== "/mfl/stats" && document.body?.dataset?.page !== "mflstats") return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch {
      // DOM cleanup below remains authoritative.
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending", "mflStatsLoading");
    document.body.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching", "mflStatsLoading",
    );
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    document.querySelectorAll("[inert]").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    document.querySelectorAll(FILTER_SELECTOR + ", .mflStatsDistributionModeButton").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.style.pointerEvents = "auto";
    });
    return true;
  }

  function statsButton(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest(FILTER_SELECTOR) || null;
  }

  ["pointerdown", "mousedown"].forEach((name) => {
    window.addEventListener(name, (event) => {
      if (!statsButton(event)) return;
      forceStatsInteractive();
      event.stopImmediatePropagation();
    }, true);
  });

  window.addEventListener("click", (event) => {
    const button = statsButton(event);
    if (!button || !forceStatsInteractive()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const options = typeof mflStatsOverallFilterOptions !== "undefined" ? mflStatsOverallFilterOptions : [];
      const option = options.find((entry) => String(entry?.label || "").trim() === String(button.textContent || "").trim());
      if (!option || typeof state !== "object" || typeof renderMflStatsPage !== "function") return;
      state.mflStatsOverallFilter = option.id;
      renderMflStatsPage();
      queueMicrotask(forceStatsInteractive);
      requestAnimationFrame(forceStatsInteractive);
    } catch (error) {
      console.error("Could not apply the MFL Stats filter.", error);
    }
  }, true);

  function currentPlayerId() {
    try {
      if (typeof playerIdFromUrl === "function") return String(playerIdFromUrl() || "").trim();
    } catch {
      // Path fallback below.
    }
    const match = location.pathname.match(/^\/players?\/([^/]+)\/?$/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function currentPlayerRow() {
    const playerId = currentPlayerId();
    try {
      return playerId && typeof rowByPlayerId === "function" ? rowByPlayerId(playerId) : null;
    } catch {
      return null;
    }
  }

  function rowClubId(row) {
    if (!row) return "";
    try {
      if (typeof getValue === "function") {
        return String(getValue(row, "active_contract_club_id") || "").trim();
      }
    } catch {
      // Direct object fallback below.
    }
    return String(row.active_contract_club_id || "").trim();
  }

  function linkContractTeam() {
    if (location.pathname !== "/player" && !/^\/players?\/[^/]+\/?$/i.test(location.pathname)
        && document.body?.dataset?.page !== "player") return;
    const team = document.querySelector(CONTRACT_TEAM_SELECTOR);
    if (!team || team.tagName === "A") return;
    const name = String(team.textContent || "").trim();
    if (!name || /^(free agent|development center)$/i.test(name)) return;
    const clubId = rowClubId(currentPlayerRow());
    if (!clubId) return;
    const link = document.createElement("a");
    link.className = team.className + " clubPageLink playerContractTeamLink";
    link.textContent = name;
    link.href = "/clubs/" + encodeURIComponent(clubId) + "/attributes";
    link.dataset.clubId = clubId;
    team.replaceWith(link);
  }

  function wrapPlayerRender() {
    if (playerRenderWrapped || typeof renderPlayerPage !== "function") return;
    const original = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithContractLink() {
      const result = original.apply(this, arguments);
      queueMicrotask(linkContractTeam);
      requestAnimationFrame(linkContractTeam);
      return result;
    };
    renderPlayerPage.__mflContractLink = true;
    playerRenderWrapped = true;
  }

  function maintain() {
    syncEarlyEvaluationLoadButton();
    wrapPlayerRender();
    linkContractTeam();
    if (document.body?.dataset?.page === "mflstats" || location.pathname === "/mfl/stats") {
      const filters = document.querySelectorAll(FILTER_SELECTOR);
      if (filters.length) forceStatsInteractive();
    }
  }

  syncEarlyEvaluationLoadButton();
  maintain();
  window.addEventListener("popstate", maintain);
  window.setInterval(maintain, 100);
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

function loaderScript(rows, warning = "") {
  const payload = JSON.stringify({
    version: APP_VERSION,
    releases: APP_RELEASES,
    rows,
    warning: String(warning || ""),
  });
  const earlyFixSource = JSON.stringify(EARLY_FIX_SOURCE);
  return `(() => {
  window.__mflSeasonRatioPayload = ${payload};
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
  const evaluationParams = new URLSearchParams(location.search);
  const evaluationPlayerRoute = location.pathname === "/evaluation" && Boolean(evaluationParams.get("player"));
  const evaluationHasSelection = location.pathname === "/evaluation"
    && Boolean(evaluationParams.get("player") || evaluationParams.get("share") || evaluationParams.get("saved"));
  document.documentElement.classList.toggle(
    "mflEvaluationInitialLoadVisible",
    location.pathname === "/evaluation" && initialOptIn && !evaluationHasSelection,
  );
  critical.textContent = \`
    html body[data-page="evaluation"] #evaluationPage,
    html body[data-page="evaluation"]:not(.evaluationPageReady) #evaluationPage {
      display: block !important; visibility: visible !important; opacity: 1 !important;
    }
    body[data-page="evaluation"]::after { display: none !important; pointer-events: none !important; }
    body[data-page="evaluation"]:not(.evaluationDiscountRateReady) #evaluationDiscountRate { visibility: hidden !important; }
    body.evaluationPlayerRoute #evaluationLoadButton { display: none !important; }
    html.mflEvaluationInitialLoadVisible #evaluationLoadButton,
    html.mflEvaluationInitialLoadVisible #evaluationLoadButton[hidden] {
      display: inline-flex !important; visibility: visible !important; opacity: 1 !important;
      pointer-events: auto !important;
    }
    html[data-initial-page^="players/"] body[data-page="player"]:not(.playerRouteGuardReady) #playerDetail > .emptyState {
      visibility: hidden !important;
    }
    html.mflStatsLoading, html.mflStatsLoading *, body.mflStatsLoading, body.mflStatsLoading * { cursor: wait !important; }
  \`;
  document.body.classList.toggle("evaluationPlayerRoute", evaluationPlayerRoute);
  if (location.pathname === "/evaluation") document.body.classList.add("evaluationRouteResolved");
  if (location.pathname === "/mfl/stats") {
    document.documentElement.classList.add("mflStatsLoading");
    document.body.classList.add("mflStatsLoading");
  }
  document.getElementById("mflEarlyRouteFixes")?.remove();
  const earlyFixes = document.createElement("script");
  earlyFixes.id = "mflEarlyRouteFixes";
  earlyFixes.textContent = ${earlyFixSource};
  document.head.appendChild(earlyFixes);
  document.getElementById("mflSeasonRatioRuntime")?.remove();
  const script = document.createElement("script");
  script.id = "mflSeasonRatioRuntime";
  script.src = "/mfl-season-ratios-runtime.js?v=${APP_VERSION}";
  script.async = false;
  document.head.appendChild(script);
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
  try {
    const ratios = await loadRatios(request);
    if (ratios.length !== 5) throw new Error(`Expected 5 MFL season ratios, received ${ratios.length}.`);
    if (scriptMode) {
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.status(200).send(loaderScript(ratios));
    } else {
      response.status(200).json({ ratios });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load MFL season ratios.";
    console.error(message);
    if (scriptMode) {
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.status(200).send(loaderScript([], `${message} Using the built-in discount-rate history.`));
    } else {
      response.status(500).json({ error: message });
    }
  }
};
