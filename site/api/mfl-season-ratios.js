const APP_VERSION = "1.118.15";
const APP_RELEASES = [
  ["v1.118.15", "Preserve Evaluation player and share routes and restore Stats filters"],
  ["v1.118.14", "Keep the Evaluation search inactive when a player is selected"],
  ["v1.118.13", "Allow opted-out evaluation shares, restore Stats filters, and focus empty Evaluation search"],
  ["v1.118.12", "Animate the discount tooltip, restore Stats filters, and support local season ratios"],
  ["v1.118.11", "Fix discount tooltip placement, Stats filters, and Season 16 discount history"],
  ["v1.118.10", "Fix Evaluation tooltip, Stats interactions, footer timing, and season ratios"],
  ["v1.118.9", "Restore MFL Stats interactions after loading"],
  ["v1.118.8", "Complete SemVer changelog history and keep the latest version current"],
  ["v1.118.7", "Enforce API limits, lock loading views, and rebuild version history"],
  ["v1.118.6", "Show the content-area scrollbar from the first page render"],
  ["v1.118.5", "Extend the global shell to the right edge and keep version UI current"],
  ["v1.118.4", "Keep page scrollbars between the header and footer and sync the latest version"],
  ["v1.118.3", "Layer Evaluation search results above page content"],
  ["v1.118.2", "Fix Evaluation tooltip and empty height; cap MFL API at 50/min"],
  ["v1.118.1", "Keep the Evaluation header sticky and focus the empty player search"],
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

const CLIENT_GUARD_SOURCE = String.raw`(() => {
  const busyEvents = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  const initialEvaluationRoute = location.pathname === "/evaluation"
    ? location.pathname + location.search
    : "";
  const initialParams = new URLSearchParams(location.search);
  let protectedEvaluationRoute = initialEvaluationRoute
    && (initialParams.get("player") || initialParams.get("share"))
    ? initialEvaluationRoute
    : "";
  let playerLoadPromise = null;

  function asUrl(value) {
    try {
      return new URL(String(value || ""), location.href);
    } catch {
      return null;
    }
  }

  function protectedRouteDetails() {
    const source = protectedEvaluationRoute
      || (location.pathname === "/evaluation" ? location.pathname + location.search : "");
    const url = asUrl(source);
    if (!url || url.pathname !== "/evaluation") {
      return { playerId: "", shareId: "" };
    }
    return {
      playerId: String(url.searchParams.get("player") || "").trim(),
      shareId: String(url.searchParams.get("share") || "").trim(),
    };
  }

  function rememberEvaluationRoute(url) {
    if (!url) return;
    if (url.pathname !== "/evaluation") {
      protectedEvaluationRoute = "";
      return;
    }
    const playerId = String(url.searchParams.get("player") || "").trim();
    const shareId = String(url.searchParams.get("share") || "").trim();
    if (playerId || shareId) protectedEvaluationRoute = url.pathname + url.search;
  }

  function wouldStripProtectedRoute(url) {
    if (!protectedEvaluationRoute || !url || url.pathname !== "/evaluation") return false;
    const protectedUrl = asUrl(protectedEvaluationRoute);
    if (!protectedUrl) return false;
    const protectedPlayer = protectedUrl.searchParams.get("player");
    const protectedShare = protectedUrl.searchParams.get("share");
    return Boolean(
      (protectedPlayer && !url.searchParams.get("player"))
      || (protectedShare && !url.searchParams.get("share"))
    );
  }

  const originalReplaceState = history.replaceState.bind(history);
  const originalPushState = history.pushState.bind(history);

  history.replaceState = function preserveEvaluationReplace(stateValue, title, urlValue) {
    const target = urlValue == null ? null : asUrl(urlValue);
    if (wouldStripProtectedRoute(target)) {
      return originalReplaceState(stateValue, title, protectedEvaluationRoute);
    }
    rememberEvaluationRoute(target);
    return originalReplaceState(stateValue, title, urlValue);
  };

  history.pushState = function trackEvaluationPush(stateValue, title, urlValue) {
    const target = urlValue == null ? null : asUrl(urlValue);
    if (target?.pathname === "/evaluation") {
      const playerId = target.searchParams.get("player");
      const shareId = target.searchParams.get("share");
      protectedEvaluationRoute = playerId || shareId ? target.pathname + target.search : "";
    } else if (target) {
      protectedEvaluationRoute = "";
    }
    return originalPushState(stateValue, title, urlValue);
  };

  function evaluationHasSelectedPlayer() {
    if (document.body.dataset.page !== "evaluation") return false;
    try {
      if (typeof state === "object" && state && String(state.evaluationPlayerId || "").trim()) {
        return true;
      }
    } catch {
      // URL and rendered state below remain available.
    }
    const route = protectedRouteDetails();
    if (route.playerId || route.shareId) return true;
    const params = new URLSearchParams(location.search);
    if (params.get("player") || params.get("share") || params.get("saved")) return true;
    const panel = document.getElementById("evaluationPanel");
    return Boolean(panel && !panel.hidden);
  }

  function installFocusGuard() {
    const input = document.getElementById("evaluationSearchInput");
    if (!input || input.__selectedPlayerFocusGuardInstalled) return;
    const originalFocus = input.focus;
    input.focus = function guardedEvaluationSearchFocus(...args) {
      if (evaluationHasSelectedPlayer()) return;
      return originalFocus.apply(this, args);
    };
    input.__selectedPlayerFocusGuardInstalled = true;
  }

  async function ensureEvaluationPlayerRow(playerId) {
    const id = String(playerId || "").trim();
    if (!id || typeof rowByPlayerId !== "function") return false;
    if (rowByPlayerId(id)) return true;
    if (playerLoadPromise) return playerLoadPromise;

    playerLoadPromise = (async () => {
      try {
        if (typeof requestIncrementalRoute === "function") {
          await requestIncrementalRoute({
            pageName: "evaluation",
            scope: "evaluation",
            playerId: id,
            view: "attributes",
            access: typeof currentDataAccess === "function" ? currentDataAccess("evaluation") : "public",
          }, 1, { force: true });
        } else if (typeof window.mflLoadIncrementalRoutePage === "function") {
          await window.mflLoadIncrementalRoutePage("evaluation", { playerId: id });
        }
      } catch (error) {
        console.error("Could not load the requested Evaluation player.", error);
      } finally {
        playerLoadPromise = null;
      }
      return Boolean(rowByPlayerId(id));
    })();

    return playerLoadPromise;
  }

  function installEvaluationRenderGuard() {
    if (typeof renderEvaluationPage !== "function" || renderEvaluationPage.__routeProtected) return;
    const originalRender = renderEvaluationPage;
    renderEvaluationPage = async function renderProtectedEvaluationRoute() {
      const route = protectedRouteDetails();
      if (route.playerId && !route.shareId && typeof rowByPlayerId === "function" && !rowByPlayerId(route.playerId)) {
        try {
          if (typeof state === "object" && state) state.evaluationPlayerId = route.playerId;
        } catch {
          // The URL remains authoritative.
        }
        await ensureEvaluationPlayerRow(route.playerId);
      }
      if (route.playerId && typeof state === "object" && state) {
        state.evaluationPlayerId = route.playerId;
      }
      return originalRender.apply(this, arguments);
    };
    renderEvaluationPage.__routeProtected = true;
  }

  function installSharedPayloadGuard() {
    if (typeof applySharedEvaluationPayload !== "function" || applySharedEvaluationPayload.__routeProtected) return;
    const originalApply = applySharedEvaluationPayload;
    applySharedEvaluationPayload = function applySharedEvaluationAfterPlayerLoad(payload) {
      const playerId = String(payload?.playerId || payload?.player_id || "").trim();
      if (playerId && typeof rowByPlayerId === "function" && !rowByPlayerId(playerId)) {
        void ensureEvaluationPlayerRow(playerId).then(() => {
          originalApply.call(this, payload);
          if (protectedEvaluationRoute && location.pathname + location.search !== protectedEvaluationRoute) {
            originalReplaceState(history.state, "", protectedEvaluationRoute);
          }
        });
        return;
      }
      return originalApply.apply(this, arguments);
    };
    applySharedEvaluationPayload.__routeProtected = true;
  }

  function installInvalidShareRedirectGuard() {
    if (typeof resetInvalidEvaluationLinkToPlainEvaluation !== "function"
        || resetInvalidEvaluationLinkToPlainEvaluation.__routeProtected) return;
    const originalReset = resetInvalidEvaluationLinkToPlainEvaluation;
    resetInvalidEvaluationLinkToPlainEvaluation = function preserveEvaluationShareRoute() {
      const route = protectedRouteDetails();
      if (route.shareId) {
        try {
          if (typeof state === "object" && state) state.evaluationShareId = route.shareId;
        } catch {
          // The protected URL is sufficient.
        }
        return false;
      }
      return originalReset.apply(this, arguments);
    };
    resetInvalidEvaluationLinkToPlainEvaluation.__routeProtected = true;
  }

  function statsPageReady() {
    const page = document.getElementById("mflStatsPage");
    if (!page || page.hidden || (document.body.dataset.page !== "mflstats" && location.pathname !== "/mfl/stats")) {
      return false;
    }
    const filters = document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton");
    const totals = ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"];
    const totalsReady = totals.every((id) => /\d/.test(String(document.getElementById(id)?.textContent || "")));
    let applying = false;
    try {
      applying = Boolean(typeof state === "object" && state?.incrementalApplying);
    } catch {
      applying = false;
    }
    return filters.length > 0 && totalsReady && !applying;
  }

  function releaseStatsInteractions() {
    if (!statsPageReady()) return false;
    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch (error) {
      console.error("Could not release MFL Stats interactions.", error);
    }
    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending");
    document.body.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching"
    );
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    Array.from(document.body.children).forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    });
    return true;
  }

  function installStatsRenderGuard() {
    if (typeof renderMflStatsPage === "function" && !renderMflStatsPage.__releaseInteractions) {
      const originalRender = renderMflStatsPage;
      renderMflStatsPage = function renderInteractiveMflStats() {
        const result = originalRender.apply(this, arguments);
        queueMicrotask(releaseStatsInteractions);
        requestAnimationFrame(releaseStatsInteractions);
        return result;
      };
      renderMflStatsPage.__releaseInteractions = true;
    }
    if (typeof renderMflStatsFilterButtons === "function" && !renderMflStatsFilterButtons.__releaseInteractions) {
      const originalFilters = renderMflStatsFilterButtons;
      renderMflStatsFilterButtons = function renderInteractiveMflStatsFilters() {
        const result = originalFilters.apply(this, arguments);
        queueMicrotask(releaseStatsInteractions);
        return result;
      };
      renderMflStatsFilterButtons.__releaseInteractions = true;
    }
  }

  function installStatsPreBlocker() {
    if (window.__mflStatsReleaseBeforeBlocker) return;
    window.__mflStatsReleaseBeforeBlocker = true;
    const release = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("#mflStatsOverallFilters .mflStatsFilterButton, .mflStatsDistributionModeButton")) {
        releaseStatsInteractions();
      }
    };
    busyEvents.forEach((name) => window.addEventListener(name, release, true));
  }

  function restoreProtectedEvaluationRoute() {
    if (!protectedEvaluationRoute || location.pathname !== "/evaluation") return;
    if (location.pathname + location.search !== protectedEvaluationRoute) {
      originalReplaceState(history.state, "", protectedEvaluationRoute);
    }
    const route = protectedRouteDetails();
    if (route.playerId && !route.shareId && typeof state === "object" && state) {
      state.evaluationPlayerId = route.playerId;
    }
  }

  function maintain() {
    installFocusGuard();
    installEvaluationRenderGuard();
    installSharedPayloadGuard();
    installInvalidShareRedirectGuard();
    installStatsRenderGuard();
    installStatsPreBlocker();
    restoreProtectedEvaluationRoute();
    releaseStatsInteractions();
  }

  maintain();
  setInterval(maintain, 50);
})();`;

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
    .split(",")[0].trim().toLowerCase();
  if (value.startsWith("[")) return value.slice(1, value.indexOf("]"));
  return value.split(":")[0];
}

function isLocalRequest(request) {
  const hostname = requestHostname(request);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

async function loadFromSupabase(config) {
  const response = await fetch(
    `${config.url}/rest/v1/mfl_season_ratios?select=season,ratio&order=season.desc&limit=5`,
    { cache: "no-store", headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } },
  );
  if (!response.ok) throw new Error(`MFL season ratio query failed with ${response.status}: ${await response.text()}`);
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
  const payload = JSON.stringify({ version: APP_VERSION, releases: APP_RELEASES, rows, warning: String(warning || "") });
  const guardSource = JSON.stringify(CLIENT_GUARD_SOURCE);
  return `(() => {
  window.__mflSeasonRatioPayload = ${payload};
  const versionStyle = document.createElement("style");
  versionStyle.id = "mflImmediateVersionStyle";
  versionStyle.textContent = '.siteFooter a[data-page="changelog"]::before{content:"MFL Front Office v${APP_VERSION}"!important}';
  document.getElementById(versionStyle.id)?.remove();
  document.head.appendChild(versionStyle);

  const current = document.getElementById("mflSeasonRatioRuntime");
  if (current) current.remove();
  const script = document.createElement("script");
  script.id = "mflSeasonRatioRuntime";
  script.src = "/mfl-season-ratios-runtime.js?v=${APP_VERSION}";
  script.async = false;
  script.addEventListener("load", () => {
    document.getElementById("evaluationFocusGuard")?.remove();
    const guard = document.createElement("script");
    guard.id = "evaluationFocusGuard";
    guard.textContent = ${guardSource};
    document.head.appendChild(guard);
  });
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
