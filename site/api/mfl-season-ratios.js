const APP_VERSION = "1.118.23";
const APP_RELEASES = [
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


const CLIENT_FIX_SOURCE = String.raw`(() => {
  const clubIdColumns = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];
  const missingSince = new Map();
  let renderGuardInstalled = false;
  let scheduled = false;

  function playerIdFromRoute() {
    try {
      if (typeof playerIdFromUrl === "function") {
        const value = String(playerIdFromUrl() || "").trim();
        if (value) return value;
      }
    } catch {
      // Path fallback below.
    }
    const match = location.pathname.match(/^\/players?\/([^/]+)\/?$/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function playerRow(playerId) {
    try {
      return playerId && typeof rowByPlayerId === "function" ? rowByPlayerId(playerId) : null;
    } catch {
      return null;
    }
  }

  function playerDataPending() {
    try {
      if (typeof state === "object" && state) {
        if (state.incrementalApplying || state.dataLoadPromise) return true;
        if (state.incrementalRequestPromises instanceof Map && state.incrementalRequestPromises.size) return true;
      }
    } catch {
      // Busy classes remain available below.
    }
    return document.documentElement.classList.contains("bootPending")
      || document.documentElement.classList.contains("appBusy")
      || document.body.classList.contains("booting")
      || document.body.classList.contains("loading")
      || document.body.classList.contains("appBusy");
  }

  function showLoadingPlayer(playerId) {
    const detail = document.getElementById("playerDetail");
    if (!detail) return;
    const empty = detail.querySelector(":scope > .emptyState");
    if (empty) empty.textContent = "Loading player...";
    else if (!detail.children.length) detail.innerHTML = '<div class="emptyState">Loading player...</div>';
    document.body.classList.add("playerRouteGuardReady", "playerRoutePending");
    document.body.classList.remove("playerRouteResolved", "playerRouteNotFound");
    if (!missingSince.has(playerId)) missingSince.set(playerId, performance.now());
  }

  function clubIdForRow(row) {
    try {
      if (!row || typeof getValue !== "function") return "";
      for (const column of clubIdColumns) {
        const value = String(getValue(row, column) || "").trim();
        if (value) return value;
      }
    } catch {
      return "";
    }
    return "";
  }

  function linkContractTeam(row) {
    const team = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam");
    if (!team || team instanceof HTMLAnchorElement) return;
    const name = String(team.textContent || "").trim();
    if (!name || /^(free agent|development center)$/i.test(name)) return;
    const clubId = clubIdForRow(row);
    if (!clubId) return;
    const link = document.createElement("a");
    link.className = team.className + " playerContractTeamLink";
    link.textContent = name;
    link.href = "/clubs/" + encodeURIComponent(clubId) + "/attributes";
    link.dataset.clubId = clubId;
    link.addEventListener("click", (event) => {
      if (event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (typeof window.mflOpenClubPage === "function") window.mflOpenClubPage(clubId, "attributes");
      else if (typeof setPage === "function") void setPage("club", true, { clubId, view: "attributes" });
      else location.href = link.href;
    });
    team.replaceWith(link);
  }

  function syncPlayerRoute() {
    const active = document.body.dataset.page === "player" || /^\/players?\/[^/]+\/?$/i.test(location.pathname);
    if (!active) {
      document.body.classList.remove("playerRouteGuardReady", "playerRoutePending", "playerRouteResolved", "playerRouteNotFound");
      return;
    }
    const playerId = playerIdFromRoute();
    if (!playerId) return;
    const row = playerRow(playerId);
    if (row) {
      missingSince.delete(playerId);
      document.body.classList.remove("playerRoutePending", "playerRouteNotFound");
      document.body.classList.add("playerRouteGuardReady", "playerRouteResolved");
      linkContractTeam(row);
      return;
    }
    showLoadingPlayer(playerId);
    const elapsed = performance.now() - (missingSince.get(playerId) || performance.now());
    if (elapsed >= 3000 && !playerDataPending()) {
      const empty = document.querySelector("#playerDetail > .emptyState");
      if (empty) empty.textContent = "Player " + playerId + " was not found.";
      document.body.classList.remove("playerRoutePending");
      document.body.classList.add("playerRouteGuardReady", "playerRouteResolved", "playerRouteNotFound");
    }
  }

  function installRenderGuard() {
    if (renderGuardInstalled || typeof renderPlayerPage !== "function") return;
    const original = renderPlayerPage;
    renderPlayerPage = function guardedPlayerPage(playerId) {
      const id = String(playerId || playerIdFromRoute() || "").trim();
      if (id && !playerRow(id)) {
        showLoadingPlayer(id);
        return;
      }
      const result = original.apply(this, arguments);
      queueMicrotask(syncPlayerRoute);
      return result;
    };
    renderPlayerPage.__mflPlayerLoadingGuard = true;
    renderGuardInstalled = true;
  }

  function syncEvaluationShell() {
    if (location.pathname !== "/evaluation" && document.body.dataset.page !== "evaluation") return;
    const page = document.getElementById("evaluationPage");
    if (page) {
      page.hidden = false;
      page.style.setProperty("visibility", "visible", "important");
      page.style.setProperty("opacity", "1", "important");
    }
    const params = new URLSearchParams(location.search);
    const hasSelection = Boolean(params.get("player") || params.get("share") || params.get("saved"))
      || Boolean(typeof state === "object" && state?.evaluationPlayerId);
    document.body.classList.toggle("evaluationPlayerRoute", Boolean(params.get("player")));
    document.body.classList.add("evaluationRouteResolved");
    const loadButton = document.getElementById("evaluationLoadButton");
    if (loadButton && typeof hasWalletOptIn === "function") {
      const show = hasWalletOptIn() && !hasSelection;
      loadButton.hidden = !show;
      loadButton.toggleAttribute("aria-hidden", !show);
    }
  }

  function run() {
    scheduled = false;
    installRenderGuard();
    syncPlayerRoute();
    syncEvaluationShell();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(run);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-page", "hidden", "style"],
    childList: true,
    subtree: true,
  });
  run();
  setInterval(run, 50);
})();`;

const PRODUCTION_ORIGIN = String(
  process.env.MFL_FRONT_OFFICE_PRODUCTION_ORIGIN || "https://mfl-front-office.vercel.app",
).replace(/\/+$/, "");

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

async function loadFromSupabase(config) {
  const response = await fetch(
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
  const response = await fetch(`${PRODUCTION_ORIGIN}/api/mfl-season-ratios?source=vercel-dev`, {
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
  const fixSource = JSON.stringify(CLIENT_FIX_SOURCE);
  return `(() => {
  window.__mflSeasonRatioPayload = ${payload};
  let critical = document.getElementById("mflCriticalRuntimeStyles");
  if (!critical) {
    critical = document.createElement("style");
    critical.id = "mflCriticalRuntimeStyles";
    document.head.appendChild(critical);
  }
  critical.textContent = \`
    html body[data-page="evaluation"] #evaluationPage,
    html body[data-page="evaluation"]:not(.evaluationPageReady) #evaluationPage {
      display: block !important; visibility: visible !important; opacity: 1 !important;
    }
    body[data-page="evaluation"]::after { display: none !important; pointer-events: none !important; }
    body[data-page="evaluation"]:not(.evaluationDiscountRateReady) #evaluationDiscountRate { visibility: hidden !important; }
    body.evaluationPlayerRoute #evaluationLoadButton { display: none !important; }
    html[data-initial-page^="players/"] body[data-page="player"]:not(.playerRouteGuardReady) #playerDetail > .emptyState {
      visibility: hidden !important;
    }
    html.mflStatsLoading, html.mflStatsLoading *, body.mflStatsLoading, body.mflStatsLoading * { cursor: wait !important; }
  \`;
  const evaluationParams = new URLSearchParams(location.search);
  const evaluationPlayerRoute = location.pathname === "/evaluation" && Boolean(evaluationParams.get("player"));
  document.body.classList.toggle("evaluationPlayerRoute", evaluationPlayerRoute);
  if (location.pathname === "/evaluation") document.body.classList.add("evaluationRouteResolved");
  if (location.pathname === "/mfl/stats") {
    document.documentElement.classList.add("mflStatsLoading");
    document.body.classList.add("mflStatsLoading");
  }
  document.getElementById("mflSeasonRatioRuntime")?.remove();
  const script = document.createElement("script");
  script.id = "mflSeasonRatioRuntime";
  script.src = "/mfl-season-ratios-runtime.js?v=${APP_VERSION}";
  script.async = false;
  script.addEventListener("load", () => {
    document.getElementById("mflV11823Fixes")?.remove();
    const fixes = document.createElement("script");
    fixes.id = "mflV11823Fixes";
    fixes.textContent = ${fixSource};
    document.head.appendChild(fixes);
  }, { once: true });
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