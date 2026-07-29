const fs = require("node:fs/promises");
const path = require("node:path");

const APP_PATH = path.join(__dirname, "..", "app-source.js");
const PATCH_VERSION = "1.151.17";
let bundledSourcePromise = null;

function replaceExact(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`${label} was not found.`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label} was not unique.`);
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function browserPatch() {
  return String.raw`

/* v${PATCH_VERSION} destination-first route shells */
(() => {
  const VERSION = "${PATCH_VERSION}";
  const PAGE_IDS = [
    "homePage",
    "progressionPage",
    "mflStatsPage",
    "myPlayersLockedPage",
    "evaluationPage",
    "playerPage",
    "settingsPage",
    "changelogPage",
  ];
  const CLUB_VIEWS = ["attributes", "contracts", "current", "all"];
  const DIVISION_NAMES = {
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

  let lockedClubId = "";
  let lockedClubTitleHtml = "";

  function setVisiblePage(targetId) {
    PAGE_IDS.forEach((id) => {
      const page = document.getElementById(id);
      if (page) page.hidden = id !== targetId;
    });
  }

  function isMflStatsRoute() {
    return /^\/mfl\/stats\/?$/i.test(window.location.pathname);
  }

  function showMflStatsShell() {
    setVisiblePage("mflStatsPage");
    document.body.dataset.page = "mflstats";
    document.querySelectorAll(".navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "mfl");
    });
    [
      "mflStatsTotalPlayers",
      "mflStatsPackablePlayers",
      "mflStatsAgedPlayers",
      "mflStatsOtherPlayers",
    ].forEach((id) => {
      const value = document.getElementById(id);
      if (value) value.textContent = "-";
    });
    document.getElementById("mflStatsAgeDistribution")?.replaceChildren();
  }

  function clubRoute() {
    const match = window.location.pathname.match(
      /^\/(?:clubs|club)\/([^/]+)(?:\/(contracts|attributes|current-season|all-time))?\/?$/i,
    );
    if (!match) return null;
    const slug = String(match[2] || "attributes").toLowerCase();
    return {
      clubId: decodeURIComponent(match[1]),
      view: slug === "current-season" ? "current" : slug === "all-time" ? "all" : slug,
    };
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value || "");
    return element.innerHTML;
  }

  function storedClubTitle(clubId) {
    try {
      const metadata = JSON.parse(sessionStorage.getItem("mfl-club-shell:" + clubId) || "null");
      if (!metadata?.name || String(metadata.clubId) !== String(clubId)) return "";
      const divisionName = String(
        metadata.divisionName || DIVISION_NAMES[Number(metadata.division)] || "",
      ).trim();
      if (!divisionName) return escapeHtml(metadata.name);
      const division = typeof contractDivisionInfo === "function"
        ? contractDivisionInfo(metadata.division)
        : null;
      const color = String(metadata.divisionColor || division?.color || "").trim();
      const divisionHtml = color
        ? '<span class="clubPageTitleDivision" style="color:' + escapeHtml(color) + '">' + escapeHtml(divisionName) + "</span>"
        : escapeHtml(divisionName);
      return escapeHtml(metadata.name) + " - " + divisionHtml;
    } catch {
      return "";
    }
  }

  function lockClubTitle(route = clubRoute()) {
    if (!route) return;
    const title = document.getElementById("tablePageTitle");
    const currentHtml = String(title?.innerHTML || "").trim();
    const generic = !currentHtml
      || currentHtml === "Club"
      || currentHtml === "Club #" + route.clubId
      || currentHtml === "Club " + route.clubId;
    const storedHtml = storedClubTitle(route.clubId);
    if (!generic) lockedClubTitleHtml = currentHtml;
    else if (storedHtml) lockedClubTitleHtml = storedHtml;
    lockedClubId = route.clubId;
  }

  function syncClubViews(route) {
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

  function showClubShell({ loading = false } = {}) {
    const route = clubRoute();
    if (!route) return;
    if (route.clubId !== lockedClubId) lockClubTitle(route);

    setVisiblePage("progressionPage");
    document.body.dataset.page = "club";
    document.querySelectorAll(".navButton.active").forEach((button) => {
      button.classList.remove("active");
    });

    const title = document.getElementById("tablePageTitle");
    if (title && lockedClubTitleHtml) title.innerHTML = lockedClubTitleHtml;
    syncClubViews(route);

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
      document.getElementById("tableBody")?.replaceChildren();
      const empty = document.getElementById("emptyState");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Loading players...";
      }
      document.body.classList.add("tableRowsLoading");
    } else {
      document.body.classList.remove("tableRowsLoading");
      const body = document.getElementById("tableBody");
      const empty = document.getElementById("emptyState");
      if (empty && body?.children.length) empty.hidden = true;
    }
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function destinationFirstSetPage(pageName) {
      const statsRoute = pageName === "mflstats" || isMflStatsRoute();
      const club = clubRoute();
      if (statsRoute) showMflStatsShell();
      if (club) {
        lockClubTitle(club);
        showClubShell({ loading: true });
      }
      try {
        return await originalSetPage.apply(this, arguments);
      } finally {
        if (club) showClubShell({ loading: false });
      }
    };
  }

  if (typeof window.mflLoadIncrementalRoutePage === "function") {
    const originalIncrementalLoader = window.mflLoadIncrementalRoutePage;
    window.mflLoadIncrementalRoutePage = async function destinationFirstIncrementalLoader(pageName) {
      const club = clubRoute();
      if (!club || pageName !== "club") {
        return originalIncrementalLoader.apply(this, arguments);
      }
      lockClubTitle(club);
      showClubShell({ loading: true });
      try {
        return await originalIncrementalLoader.apply(this, arguments);
      } finally {
        showClubShell({ loading: false });
      }
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function destinationFirstRenderTable() {
      const result = originalRenderTable.apply(this, arguments);
      if (clubRoute()) {
        lockClubTitle();
        showClubShell({ loading: false });
      }
      return result;
    };
  }

  if (isMflStatsRoute()) showMflStatsShell();
  const initialClub = clubRoute();
  if (initialClub) {
    lockClubTitle(initialClub);
    showClubShell({ loading: true });
  }

  window.setTimeout(() => {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = "MFL Front Office v" + VERSION;

    const section = Array.from(
      document.querySelectorAll(".changelogList > .changelogMinorSection"),
    ).find((entry) => (
      entry.querySelector(".changelogMinorVersion")?.textContent?.trim() === "v1.151"
    ));
    const patchList = section?.querySelector(".changelogPatchList");
    const exists = Array.from(patchList?.children || []).some((item) => (
      item.querySelector(":scope > span")?.textContent?.trim() === "v" + VERSION
    ));
    if (patchList && !exists) {
      const item = document.createElement("li");
      const version = document.createElement("span");
      const description = document.createElement("p");
      version.textContent = "v" + VERSION;
      description.textContent = "Serve destination-first MFL stats and club loading directly through the application route";
      item.append(version, description);
      patchList.prepend(item);
      const count = patchList.children.length;
      const meta = section.querySelector(".changelogMinorMeta");
      if (meta) meta.textContent = count + " " + (count === 1 ? "patch" : "patches");
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

  source = replaceExact(
    source,
    `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {\n    await requestIncrementalRoute(route, 1);\n    state.dataAccess = currentDataAccess(pageName);\n    state.incrementalApplying = true;\n    try {\n      return await originalSetPage.call(this, pageName, false, {\n        ...options,\n        replaceUrl: "",\n        skipNavigationLoading: true,\n      });\n    } finally {\n      state.incrementalApplying = false;\n    }\n  }`,
    `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {\n    const clubTitleHtml = route.scope === "club" ? String(tablePageTitle.innerHTML || "") : "";\n    await requestIncrementalRoute(route, 1);\n    state.dataAccess = currentDataAccess(pageName);\n    state.incrementalApplying = true;\n    try {\n      return await originalSetPage.call(this, pageName, false, {\n        ...options,\n        replaceUrl: "",\n        skipNavigationLoading: true,\n      });\n    } finally {\n      state.incrementalApplying = false;\n      if (route.scope === "club" && clubTitleHtml) {\n        tablePageTitle.innerHTML = clubTitleHtml;\n        document.body.dataset.page = "club";\n        navButtons.forEach((button) => button.classList.remove("active"));\n      }\n    }\n  }`,
    "club post-load title replacement",
  );

  source = replaceExact(
    source,
    "\nstartApp();",
    `${browserPatch()}\nstartApp();`,
    "pre-start route patch injection",
  );

  return source;
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
    response.status(500).send(
      `console.error(${JSON.stringify(`Could not load MFL Front Office: ${error.message}`)});`,
    );
  }
};
