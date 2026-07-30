const APP_VERSION = "1.118.11";
const APP_RELEASES = [
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

function supabaseConfig() {
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "",
  ).replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

function normalizeRows(value) {
  return (Array.isArray(value) ? value : [])
    .map((row) => ({
      season: Number(row?.season),
      ratio: Number(row?.ratio),
    }))
    .filter((row) => Number.isInteger(row.season) && row.season > 0 && Number.isFinite(row.ratio) && row.ratio > 0)
    .sort((a, b) => b.season - a.season)
    .slice(0, 5);
}

function runtimeScript(rows, warning = "") {
  const serializedRows = JSON.stringify(rows);
  const serializedWarning = JSON.stringify(String(warning || ""));
  const serializedVersion = JSON.stringify(APP_VERSION);
  const serializedReleases = JSON.stringify(APP_RELEASES);

  return `(() => {
  const rows = ${serializedRows};
  const warning = ${serializedWarning};
  const appVersion = ${serializedVersion};
  const currentReleases = ${serializedReleases};
  const busyEventNames = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  let attempts = 0;
  let activeMflStatsRequests = 0;
  let busyListenerReplacement = null;
  let tooltipElement = null;
  let tooltipTarget = null;

  function versionParts(value) {
    const match = String(value || "").trim().match(/^v?(\\d+)\\.(\\d+)\\.(\\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareVersionsDescending(a, b) {
    const left = versionParts(a) || [0, 0, 0];
    const right = versionParts(b) || [0, 0, 0];
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  }

  function normalizedVersion(value) {
    const parts = versionParts(value);
    return parts ? "v" + parts.join(".") : "";
  }

  function collectChangelogEntries(list) {
    const entries = new Map();
    list.querySelectorAll("li").forEach((item) => {
      if (item.classList.contains("changelogMinorSection")) return;
      const version = normalizedVersion(item.querySelector(":scope > span")?.textContent);
      if (!version) return;
      const description = String(item.querySelector(":scope > p")?.textContent || "").trim();
      if (!entries.has(version) || description) entries.set(version, description);
    });
    currentReleases.forEach(([version, description]) => {
      const normalized = normalizedVersion(version);
      if (normalized) entries.set(normalized, String(description || "").trim());
    });
    return entries;
  }

  function createPatchItem(version, description) {
    const item = document.createElement("li");
    const versionLabel = document.createElement("span");
    const descriptionLabel = document.createElement("p");
    versionLabel.textContent = version;
    descriptionLabel.textContent = description;
    item.append(versionLabel, descriptionLabel);
    return item;
  }

  function rebuildCompleteChangelog() {
    const footerLink = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footerLink) footerLink.textContent = "MFL Front Office v" + appVersion;

    const list = document.querySelector(".changelogList");
    if (!list) return;

    const entries = collectChangelogEntries(list);
    const groups = new Map();
    entries.forEach((description, version) => {
      const parts = versionParts(version);
      const minor = parts[0] + "." + parts[1];
      if (!groups.has(minor)) groups.set(minor, []);
      groups.get(minor).push({ version, description });
    });

    const orderedGroups = Array.from(groups.entries()).sort(([left], [right]) => {
      const leftParts = left.split(".").map(Number);
      const rightParts = right.split(".").map(Number);
      return rightParts[0] - leftParts[0] || rightParts[1] - leftParts[1];
    });

    list.replaceChildren();
    orderedGroups.forEach(([minor, patches], index) => {
      patches.sort((left, right) => compareVersionsDescending(left.version, right.version));

      const section = document.createElement("li");
      section.className = "changelogMinorSection";
      if (index === 0) section.classList.add("is-expanded");

      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", index === 0 ? "true" : "false");

      const title = document.createElement("span");
      title.className = "changelogMinorVersion";
      title.textContent = "v" + minor;

      const meta = document.createElement("span");
      meta.className = "changelogMinorMeta";
      meta.textContent = patches.length + (patches.length === 1 ? " patch" : " patches");

      const chevron = document.createElement("span");
      chevron.className = "changelogMinorChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = ">";

      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patchList = document.createElement("ol");
      patchList.className = "changelogPatchList";
      patches.forEach(({ version, description }) => {
        patchList.appendChild(createPatchItem(version, description));
      });

      toggle.append(title, meta, chevron);
      inner.appendChild(patchList);
      panel.appendChild(inner);
      section.append(toggle, panel);
      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.appendChild(section);
    });
  }

  function mflStatsPageActive() {
    const page = document.getElementById("mflStatsPage");
    return Boolean(
      page
      && !page.hidden
      && (document.body.dataset.page === "mflstats" || window.location.pathname === "/mfl/stats")
    );
  }

  function mflStatsControlsReady() {
    if (!mflStatsPageActive()) return false;
    const totalText = String(document.getElementById("mflStatsTotalPlayers")?.textContent || "").trim();
    return Boolean(
      document.querySelector("#mflStatsOverallFilters .mflStatsFilterButton")
      && /\\d/.test(totalText)
    );
  }

  function isMflStatsRequest(input) {
    try {
      const value = typeof Request !== "undefined" && input instanceof Request ? input.url : String(input || "");
      const url = new URL(value, window.location.href);
      return url.pathname === "/api/mfl-stats"
        || (url.pathname === "/api/data"
          && String(url.searchParams.get("scope") || "").toLowerCase() === "mflstats");
    } catch {
      return false;
    }
  }

  function unlockMflStatsPage() {
    if (!mflStatsControlsReady() || activeMflStatsRequests > 0) return false;

    const appShell = document.getElementById("appShell");
    let staleBusy = Boolean(
      appShell?.inert
      || document.documentElement.classList.contains("appBusy")
      || document.body.classList.contains("appBusy")
      || document.body.getAttribute("aria-busy") === "true"
    );
    try {
      staleBusy = staleBusy || Boolean(typeof state === "object" && state && Number(state.interactionBusyDepth) > 0);
    } catch {
      // DOM state below is sufficient when application state is unavailable.
    }

    if (staleBusy) {
      try {
        if (typeof endInteractionBusy === "function") {
          endInteractionBusy({ reset: true });
        } else if (typeof state === "object" && state) {
          state.interactionBusyDepth = 0;
        }
      } catch (error) {
        console.error("Could not reset the completed MFL Stats loading state.", error);
      }
    }

    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending");
    document.body.classList.remove(
      "appBusy",
      "loading",
      "booting",
      "tableRowsLoading",
      "tableLayoutPending",
      "clubViewLoading",
      "clubViewSwitching"
    );
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    Array.from(document.body.children).forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    return true;
  }

  function scheduleMflStatsUnlock() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(unlockMflStatsPage);
    });
  }

  function installMflStatsFetchTracking() {
    if (typeof window.fetch !== "function" || window.fetch.__mflStatsTracked) return;
    const previousFetch = window.fetch.bind(window);
    const trackedFetch = async function trackedMflStatsFetch(input, init) {
      const tracked = isMflStatsRequest(input);
      if (tracked) activeMflStatsRequests += 1;
      try {
        return await previousFetch(input, init);
      } finally {
        if (tracked) {
          activeMflStatsRequests = Math.max(0, activeMflStatsRequests - 1);
          scheduleMflStatsUnlock();
        }
      }
    };
    trackedFetch.__mflStatsTracked = true;
    window.fetch = trackedFetch;
  }

  function installMflStatsRenderHook() {
    if (typeof renderMflStatsPage !== "function" || renderMflStatsPage.__mflStatsUnlockWrapped) return;
    const originalRenderMflStatsPage = renderMflStatsPage;
    const wrappedRender = function renderMflStatsPageWithUnlock() {
      const result = originalRenderMflStatsPage.apply(this, arguments);
      scheduleMflStatsUnlock();
      return result;
    };
    wrappedRender.__mflStatsUnlockWrapped = true;
    renderMflStatsPage = wrappedRender;
  }

  function installBusyListenerOverride() {
    if (busyListenerReplacement || typeof blockInteractionWhileBusy !== "function") return;

    busyEventNames.forEach((eventName) => {
      document.removeEventListener(eventName, blockInteractionWhileBusy, true);
    });

    busyListenerReplacement = function allowCompletedMflStatsInteraction(event) {
      if (mflStatsControlsReady() && activeMflStatsRequests === 0) {
        unlockMflStatsPage();
        return;
      }
      blockInteractionWhileBusy(event);
    };

    busyEventNames.forEach((eventName) => {
      document.addEventListener(eventName, busyListenerReplacement, true);
    });
  }

  function actualLoadingInProgress() {
    let stateBusy = false;
    try {
      stateBusy = typeof state === "object" && state && Boolean(
        state.incrementalApplying
        || Number(state.incrementalRequestPromises?.size) > 0
        || Number(state.interactionBusyDepth) > 0
      );
    } catch {
      stateBusy = false;
    }

    if (mflStatsControlsReady() && activeMflStatsRequests === 0) {
      stateBusy = Boolean(
        typeof state === "object"
        && state
        && (state.incrementalApplying || Number(state.incrementalRequestPromises?.size) > 0)
      );
    }

    return activeMflStatsRequests > 0
      || stateBusy
      || document.documentElement.classList.contains("loading")
      || document.documentElement.classList.contains("bootPending")
      || document.documentElement.classList.contains("table-layout-pending")
      || document.body.classList.contains("loading")
      || document.body.classList.contains("booting")
      || document.body.classList.contains("tableRowsLoading")
      || document.body.classList.contains("tableLayoutPending")
      || document.body.classList.contains("clubViewLoading")
      || document.body.classList.contains("clubViewSwitching");
  }

  function installViewLoadingGuard() {
    if (!window.__mflViewCaptureInstalled) {
      window.__mflViewCaptureInstalled = true;
      const blockViewSwitch = (event) => {
        const button = event.target instanceof Element
          ? event.target.closest(".viewButton[data-view]")
          : null;
        if (!button || !actualLoadingInProgress()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      ["pointerdown", "mousedown", "click", "auxclick"].forEach((eventName) => {
        document.addEventListener(eventName, blockViewSwitch, true);
      });
    }

    if (typeof setView === "function" && !setView.__mflLoadingGuard) {
      const originalSetView = setView;
      const guardedSetView = function guardedSetView() {
        if (actualLoadingInProgress()) return undefined;
        return originalSetView.apply(this, arguments);
      };
      guardedSetView.__mflLoadingGuard = true;
      setView = guardedSetView;
    }
  }

  function ensureDiscountTooltip() {
    const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
    if (!box) return;

    if (!tooltipElement) {
      tooltipElement = document.createElement("div");
      tooltipElement.id = "evaluationDiscountTooltipPortal";
      tooltipElement.className = "evaluationDiscountTooltipPortal";
      tooltipElement.setAttribute("role", "tooltip");
      tooltipElement.hidden = true;
      document.body.appendChild(tooltipElement);

      const reposition = () => {
        if (!tooltipElement.hidden && tooltipTarget) positionDiscountTooltip();
      };
      window.addEventListener("resize", reposition);
      document.addEventListener("scroll", reposition, true);
    }

    if (box.__discountTooltipInstalled) return;
    box.__discountTooltipInstalled = true;
    box.setAttribute("aria-describedby", tooltipElement.id);

    const show = () => {
      tooltipTarget = box;
      tooltipElement.textContent = String(box.dataset.tooltip || "");
      tooltipElement.hidden = false;
      positionDiscountTooltip();
    };
    const hide = () => {
      tooltipElement.hidden = true;
      tooltipTarget = null;
    };

    box.addEventListener("mouseenter", show);
    box.addEventListener("mouseleave", hide);
    box.addEventListener("focusin", show);
    box.addEventListener("focusout", hide);
    box.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
  }

  function positionDiscountTooltip() {
    if (!tooltipElement || tooltipElement.hidden || !tooltipTarget) return;

    const targetRect = tooltipTarget.getBoundingClientRect();
    tooltipElement.style.left = "0px";
    tooltipElement.style.top = "0px";
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
    const left = Math.min(maxLeft, Math.max(margin, targetRect.right - tooltipRect.width));
    let top = targetRect.top - tooltipRect.height - gap;

    if (top < margin) {
      top = Math.min(
        window.innerHeight - tooltipRect.height - margin,
        targetRect.bottom + gap
      );
    }

    tooltipElement.style.left = Math.round(left) + "px";
    tooltipElement.style.top = Math.round(top) + "px";
  }

  function maintainRuntimeFixes() {
    installMflStatsFetchTracking();
    installMflStatsRenderHook();
    installBusyListenerOverride();
    installViewLoadingGuard();
    ensureDiscountTooltip();

    if (mflStatsPageActive()) {
      scheduleMflStatsUnlock();
    } else {
      document.body.classList.remove("mflStatsInteractive");
    }
  }

  function installDiscountRate() {
    if (typeof evaluationDiscountRateValue !== "function") {
      attempts += 1;
      if (attempts < 500) window.setTimeout(installDiscountRate, 20);
      return;
    }

    if (warning) console.error(warning);
    if (rows.length !== 5) return;

    const ordered = rows.slice().sort((a, b) => a.season - b.season);
    const changes = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = Number(ordered[index - 1].ratio);
      const current = Number(ordered[index].ratio);
      if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current) || current <= 0) return;
      changes.push(current / previous);
    }
    if (!changes.length) return;

    const discountRate = Math.pow(
      changes.reduce((product, change) => product * change, 1),
      1 / changes.length
    ) - 1;
    if (!Number.isFinite(discountRate)) return;

    window.mflSeasonRatios = Object.freeze(ordered.map((row) => Object.freeze({ ...row })));
    const firstCompletedSeason = ordered[0].season;
    const lastCompletedSeason = ordered[ordered.length - 1].season;
    const currentSeason = lastCompletedSeason + 1;
    const discountRateBox = document.querySelector(".evaluationDiscountRate[data-tooltip]");
    if (discountRateBox) {
      discountRateBox.dataset.tooltip = "Discount Rate is the geometric mean of the four season-over-season MFL/USD growth factors from the latest five completed seasons in Supabase (Seasons "
        + firstCompletedSeason + "-" + lastCompletedSeason + "). Current season is " + currentSeason + ".";
    }

    evaluationDiscountRateValue = function evaluationDiscountRateFromSupabase() {
      return discountRate;
    };

    ensureDiscountTooltip();
    if (typeof renderEvaluationPage === "function"
        && typeof state !== "undefined"
        && state.currentPage === "evaluation") {
      renderEvaluationPage();
    }
  }

  rebuildCompleteChangelog();
  maintainRuntimeFixes();
  window.setTimeout(rebuildCompleteChangelog, 0);
  window.setTimeout(rebuildCompleteChangelog, 250);
  window.setInterval(maintainRuntimeFixes, 100);
  installDiscountRate();
})();\n`;
}

async function loadLatestRatios() {
  const config = supabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured for MFL season ratios.");
  }

  const response = await fetch(
    `${config.url}/rest/v1/mfl_season_ratios?select=season,ratio&order=season.desc&limit=5`,
    {
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
    const ratios = await loadLatestRatios();
    if (ratios.length !== 5) {
      throw new Error(`Expected 5 MFL season ratios, received ${ratios.length}.`);
    }

    if (scriptMode) {
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.status(200).send(runtimeScript(ratios));
      return;
    }

    response.status(200).json({ ratios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load MFL season ratios.";
    console.error(message);

    if (scriptMode) {
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.status(200).send(runtimeScript([], `${message} Using the built-in discount-rate history.`));
      return;
    }

    response.status(500).json({ error: message });
  }
};
