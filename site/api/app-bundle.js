const fs = require("node:fs/promises");
const path = require("node:path");

const APP_PATH = path.join(__dirname, "..", "app.js");
const PATCH_VERSION = "1.151.15";
let bundledSourcePromise = null;

function replaceExact(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    console.warn(`[app-bundle] ${label} was not found; leaving that behavior unchanged.`);
    return source;
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    console.warn(`[app-bundle] ${label} was not unique; leaving that behavior unchanged.`);
    return source;
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function browserPatch() {
  return String.raw`

/* v${PATCH_VERSION} route-chrome stabilization */
(() => {
  const VERSION = "${PATCH_VERSION}";
  const CLUB_VIEWS = ["attributes", "contracts", "current", "all"];
  const CLUB_DIVISIONS = {
    1: "Diamond",
    2: "Platinum",
    3: "Gold",
    4: "Silver",
    5: "Bronze",
    6: "Iron",
    7: "Steel",
    8: "Stone",
    9: "Wood",
    10: "Flint",
  };

  function setVisiblePage(targetId) {
    ["homePage", "progressionPage", "mflStatsPage", "myPlayersLockedPage", "evaluationPage", "playerPage", "settingsPage", "changelogPage"]
      .forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.hidden = id !== targetId;
      });
  }

  function isMflStatsRoute() {
    return /^\/mfl\/stats\/?$/i.test(window.location.pathname);
  }

  function showMflStatsLoadingShell() {
    setVisiblePage("mflStatsPage");
    document.body.dataset.page = "mflstats";
    document.querySelectorAll(".navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "mfl");
    });
    ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]
      .forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = "-";
      });
    const distribution = document.getElementById("mflStatsAgeDistribution");
    if (distribution) distribution.innerHTML = '<p class="mflStatsEmpty">Loading players...</p>';
  }

  function currentClubRoute() {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/(contracts|attributes|current-season|all-time))?/i);
    if (!match) return null;
    const slug = String(match[2] || "attributes").toLowerCase();
    return {
      clubId: decodeURIComponent(match[1]),
      view: slug === "current-season" ? "current" : slug === "all-time" ? "all" : slug,
    };
  }

  let savedClubId = "";
  let savedClubTitleHtml = "";

  function escapedText(value) {
    const element = document.createElement("span");
    element.textContent = String(value || "");
    return element.innerHTML;
  }

  function titleFromStoredMetadata(clubId) {
    try {
      const metadata = JSON.parse(sessionStorage.getItem("mfl-club-shell:" + clubId) || "null");
      if (!metadata || String(metadata.clubId) !== String(clubId) || !metadata.name) return "";
      const divisionName = String(metadata.divisionName || CLUB_DIVISIONS[Number(metadata.division)] || "").trim();
      if (!divisionName) return escapedText(metadata.name);
      const division = typeof contractDivisionInfo === "function" ? contractDivisionInfo(metadata.division) : null;
      const color = String(metadata.divisionColor || division?.color || "").trim();
      const divisionHtml = color
        ? '<span class="clubPageTitleDivision" style="color:' + escapedText(color) + '">' + escapedText(divisionName) + "</span>"
        : escapedText(divisionName);
      return escapedText(metadata.name) + " - " + divisionHtml;
    } catch {
      return "";
    }
  }

  function rememberClubTitle() {
    const route = currentClubRoute();
    if (!route) return;
    const title = document.getElementById("tablePageTitle");
    const html = String(title?.innerHTML || "").trim();
    const generic = !html || html === "Club" || html === "Club #" + route.clubId || html === "Club " + route.clubId;
    const storedHtml = titleFromStoredMetadata(route.clubId);
    if (!generic) savedClubTitleHtml = html;
    else if (storedHtml) savedClubTitleHtml = storedHtml;
    savedClubId = route.clubId;
  }

  function prepareClubViews(route) {
    const views = document.querySelector("#progressionPage .views");
    if (!views) return;
    CLUB_VIEWS.forEach((viewName) => {
      const button = views.querySelector('.viewButton[data-view="' + viewName + '"]');
      if (button) views.appendChild(button);
    });
    views.querySelectorAll(".viewButton").forEach((button) => {
      const allowed = CLUB_VIEWS.includes(button.dataset.view);
      button.hidden = !allowed;
      button.classList.toggle("active", allowed && button.dataset.view === route.view);
    });
  }

  function restoreClubChrome(loading = false) {
    const route = currentClubRoute();
    if (!route || route.clubId !== savedClubId) return;
    setVisiblePage("progressionPage");
    document.body.dataset.page = "club";
    document.querySelectorAll(".navButton.active").forEach((button) => button.classList.remove("active"));

    const title = document.getElementById("tablePageTitle");
    if (title && savedClubTitleHtml) title.innerHTML = savedClubTitleHtml;
    prepareClubViews(route);

    const page = document.getElementById("progressionPage");
    const quickFilters = page?.querySelector(".quickFilters");
    const controlsBar = page?.querySelector(".controlsBar");
    const watchlistSwitcher = page?.querySelector("#watchlistSwitcher");
    if (quickFilters) quickFilters.hidden = true;
    if (controlsBar) controlsBar.hidden = true;
    if (watchlistSwitcher) watchlistSwitcher.hidden = true;
    page?.querySelectorAll(".pager, nav.pager").forEach((pager) => {
      pager.hidden = true;
    });

    if (loading) {
      const body = document.getElementById("tableBody");
      if (body) body.replaceChildren();
      const empty = document.getElementById("emptyState");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Loading players...";
      }
      document.body.classList.add("tableRowsLoading");
    }
  }

  function wrapSetPage() {
    if (typeof setPage !== "function") return;
    const original = setPage;
    setPage = async function stableSetPage(pageName) {
      const statsTarget = pageName === "mflstats" || isMflStatsRoute();
      const clubTarget = currentClubRoute();
      if (statsTarget) showMflStatsLoadingShell();
      if (clubTarget) {
        rememberClubTitle();
        restoreClubChrome(true);
      }
      const pending = original.apply(this, arguments);
      if (statsTarget) showMflStatsLoadingShell();
      if (clubTarget) restoreClubChrome(true);
      try {
        return await pending;
      } finally {
        if (clubTarget) restoreClubChrome(false);
      }
    };
  }

  function wrapShowHomeShell() {
    if (typeof showHomeShell !== "function") return;
    const original = showHomeShell;
    showHomeShell = async function stableShowHomeShell(pageName) {
      const statsTarget = pageName === "mflstats" || isMflStatsRoute();
      const clubTarget = currentClubRoute();
      if (statsTarget) showMflStatsLoadingShell();
      if (clubTarget) {
        rememberClubTitle();
        restoreClubChrome(true);
      }
      const pending = original.apply(this, arguments);
      if (statsTarget) showMflStatsLoadingShell();
      if (clubTarget) restoreClubChrome(true);
      try {
        return await pending;
      } finally {
        if (clubTarget) restoreClubChrome(false);
      }
    };
  }

  function wrapIncrementalClubLoader() {
    if (typeof window.mflLoadIncrementalRoutePage !== "function") return;
    const original = window.mflLoadIncrementalRoutePage;
    window.mflLoadIncrementalRoutePage = async function stableIncrementalRoute(pageName) {
      const route = currentClubRoute();
      if (!route || pageName !== "club") return original.apply(this, arguments);
      rememberClubTitle();
      restoreClubChrome(true);
      const pending = original.apply(this, arguments);
      restoreClubChrome(true);
      try {
        return await pending;
      } finally {
        restoreClubChrome(false);
      }
    };
  }

  function wrapTableRenderer() {
    if (typeof renderTable !== "function") return;
    const original = renderTable;
    renderTable = function stableClubTableRenderer() {
      const result = original.apply(this, arguments);
      if (currentClubRoute()) {
        rememberClubTitle();
        restoreClubChrome(false);
      }
      return result;
    };
  }

  wrapSetPage();
  wrapShowHomeShell();
  wrapIncrementalClubLoader();
  wrapTableRenderer();

  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const statsButton = target?.closest('.viewButton[data-view="stats"]');
    if (statsButton && /^\/mfl(?:\/|$)/i.test(window.location.pathname)) showMflStatsLoadingShell();
    const clubViewButton = target?.closest(".viewButton[data-view]");
    if (clubViewButton && currentClubRoute()) {
      rememberClubTitle();
      restoreClubChrome(true);
    }
  }, true);

  if (isMflStatsRoute()) showMflStatsLoadingShell();
  if (currentClubRoute()) {
    rememberClubTitle();
    restoreClubChrome(true);
  }

  window.setTimeout(() => {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = "MFL Front Office v" + VERSION;

    const list = document.querySelector(".changelogList");
    const section = Array.from(list?.querySelectorAll(":scope > .changelogMinorSection") || [])
      .find((entry) => entry.querySelector(".changelogMinorVersion")?.textContent?.trim() === "v1.151");
    const patchList = section?.querySelector(".changelogPatchList");
    const alreadyListed = Array.from(patchList?.children || [])
      .some((item) => item.querySelector(":scope > span")?.textContent?.trim() === "v" + VERSION);
    if (patchList && !alreadyListed) {
      const item = document.createElement("li");
      const version = document.createElement("span");
      version.textContent = "v" + VERSION;
      const description = document.createElement("p");
      description.textContent = "Activate destination-first MFL Stats loading and keep club title and page chrome fixed while rows load";
      item.append(version, description);
      patchList.prepend(item);
      const meta = section.querySelector(".changelogMinorMeta");
      const count = patchList.children.length;
      if (meta) meta.textContent = count + (count === 1 ? " patch" : " patches");
    }
  }, 0);
})();
`;
}

async function buildBundledSource() {
  let source = await fs.readFile(APP_PATH, "utf8");

  source = replaceExact(
    source,
    '      const response = await fetch(`/api/data?${requestKey}`, {',
    '      const endpoint = route.scope === "mflstats" ? "/api/mfl-stats" : `/api/data?${requestKey}`;\n      const response = await fetch(endpoint, {',
    "MFL stats endpoint replacement",
  );

  source = replaceExact(
    source,
    `      if (route.scope === "club") {\n        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));\n        tablePageTitle.textContent = club?.name || "Club";\n      } else {`,
    `      if (route.scope === "club") {\n        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));\n        const currentTitle = String(tablePageTitle.textContent || "").trim();\n        if (!currentTitle || currentTitle === "Club") tablePageTitle.textContent = club?.name || "Club";\n      } else {`,
    "club loading-title replacement",
  );

  return `${source}${browserPatch()}`;
}

module.exports = async function appBundleHandler(_request, response) {
  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (!bundledSourcePromise) {
      bundledSourcePromise = buildBundledSource().catch((error) => {
        bundledSourcePromise = null;
        throw error;
      });
    }
    response.status(200).send(await bundledSourcePromise);
  } catch (error) {
    console.error("[app-bundle] Could not build app.js.", error);
    try {
      response.status(200).send(await fs.readFile(APP_PATH, "utf8"));
    } catch (fallbackError) {
      response.status(500).send(`console.error(${JSON.stringify(`Could not load MFL Front Office: ${fallbackError.message}`)});`);
    }
  }
};