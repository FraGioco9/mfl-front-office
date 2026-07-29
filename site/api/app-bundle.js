const fs = require("node:fs/promises");
const path = require("node:path");

const APP_PATH = path.join(__dirname, "..", "app.js");
const PATCH_VERSION = "1.151.13";
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

  function setVisiblePage(targetId) {
    ["homePage", "progressionPage", "mflStatsPage", "myPlayersLockedPage", "evaluationPage", "playerPage", "settingsPage", "changelogPage"]
      .forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.hidden = id !== targetId;
      });
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

  let savedClubId = "";
  let savedClubTitleHtml = "";

  function currentClubId() {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function rememberClubTitle() {
    const clubId = currentClubId();
    if (!clubId) return;
    const title = document.getElementById("tablePageTitle");
    const html = String(title?.innerHTML || "").trim();
    if (!html || html === "Club" || html === "Club #" + clubId) return;
    savedClubId = clubId;
    savedClubTitleHtml = html;
  }

  function restoreClubChrome() {
    const clubId = currentClubId();
    if (!clubId || clubId !== savedClubId || !savedClubTitleHtml) return;
    setVisiblePage("progressionPage");
    document.body.dataset.page = "club";
    const title = document.getElementById("tablePageTitle");
    if (title) title.innerHTML = savedClubTitleHtml;
    document.querySelectorAll(".navButton.active").forEach((button) => button.classList.remove("active"));
  }

  function scheduleClubChromeRestore() {
    rememberClubTitle();
    queueMicrotask(restoreClubChrome);
    requestAnimationFrame(() => requestAnimationFrame(restoreClubChrome));
    window.setTimeout(restoreClubChrome, 0);
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const statsButton = target?.closest('.viewButton[data-view="stats"]');
    if (statsButton && /^\/mfl(?:\/|$)/i.test(window.location.pathname)) {
      showMflStatsLoadingShell();
    }
    const clubViewButton = target?.closest(".viewButton[data-view]");
    if (clubViewButton && currentClubId()) scheduleClubChromeRestore();
  }, true);

  if (/^\/mfl\/stats\/?$/i.test(window.location.pathname)) showMflStatsLoadingShell();
  if (currentClubId()) scheduleClubChromeRestore();

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
      description.textContent = "Load all MFL wallet stats players and keep MFL stats and club page chrome stable while rows load";
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

  source = replaceExact(
    source,
    `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {\n    await requestIncrementalRoute(route, 1);\n    state.dataAccess = currentDataAccess(pageName);\n    state.incrementalApplying = true;\n    try {\n      return await originalSetPage.call(this, pageName, false, {\n        ...options,\n        replaceUrl: "",\n        skipNavigationLoading: true,\n      });\n    } finally {\n      state.incrementalApplying = false;\n    }\n  }`,
    `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {\n    const clubTitleHtml = route.scope === "club" ? String(tablePageTitle.innerHTML || "") : "";\n    await requestIncrementalRoute(route, 1);\n    state.dataAccess = currentDataAccess(pageName);\n    state.incrementalApplying = true;\n    try {\n      return await originalSetPage.call(this, pageName, false, {\n        ...options,\n        replaceUrl: "",\n        skipNavigationLoading: true,\n      });\n    } finally {\n      state.incrementalApplying = false;\n      if (route.scope === "club" && clubTitleHtml) {\n        tablePageTitle.innerHTML = clubTitleHtml;\n        document.body.dataset.page = "club";\n        navButtons.forEach((button) => button.classList.remove("active"));\n      }\n    }\n  }`,
    "club post-load title replacement",
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
