(() => {
  const VERSION = "1.151.18";

  function showPreparedRouteShell() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const statsRoute = /^\/mfl\/stats$/i.test(path);
    const clubMatch = path.match(/^\/clubs?\/([^/]+)(?:\/([^/]+))?$/i);

    if (statsRoute) {
      document.body.dataset.page = "mflstats";
      const progression = document.getElementById("progressionPage");
      const stats = document.getElementById("mflStatsPage");
      if (progression) progression.hidden = true;
      if (stats) stats.hidden = false;
      ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]
        .forEach((id) => {
          const element = document.getElementById(id);
          if (element) element.textContent = "-";
        });
      document.getElementById("mflStatsAgeDistribution")?.replaceChildren();
    } else if (clubMatch) {
      document.body.dataset.page = "club";
      const progression = document.getElementById("progressionPage");
      if (progression) progression.hidden = false;
      document.getElementById("tableBody")?.replaceChildren();
      const empty = document.getElementById("emptyState");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Loading players...";
      }
      document.body.classList.add("tableRowsLoading");
    }

    document.documentElement.classList.remove("bootPending");
  }

  function replaceOnce(source, before, after, label) {
    const first = source.indexOf(before);
    if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
      throw new Error(`${label} did not match exactly once.`);
    }
    return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
  }

  function publishVersion() {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer) footer.textContent = `MFL Front Office v${VERSION}`;
  }

  showPreparedRouteShell();

  const request = new XMLHttpRequest();
  request.open("GET", `/app-source.txt?v=${VERSION}`, false);
  request.send(null);
  if (request.status < 200 || request.status >= 300) {
    throw new Error(`Could not load the application source (${request.status}).`);
  }

  const originalSource = request.responseText;
  let source = originalSource;

  try {
    source = replaceOnce(
      source,
      '      const response = await fetch(`/api/data?${requestKey}`, {',
      '      const response = await fetch(route.scope === "mflstats" ? "/api/mfl-stats" : `/api/data?${requestKey}`, {',
      "complete MFL stats endpoint",
    );

    source = replaceOnce(
      source,
      `      if (route.scope === "club") {\n        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));\n        tablePageTitle.textContent = club?.name || "Club";\n      } else {`,
      `      if (route.scope === "club") {\n        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));\n        const currentTitle = String(tablePageTitle.textContent || "").trim();\n        if (!currentTitle || currentTitle === "Club" || /^Club #?\\d+$/.test(currentTitle)) {\n          tablePageTitle.textContent = club?.name || currentTitle || "Club";\n        }\n      } else {`,
      "stable club loading title",
    );

    source = replaceOnce(
      source,
      `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {\n    await requestIncrementalRoute(route, 1);\n    state.dataAccess = currentDataAccess(pageName);\n    state.incrementalApplying = true;\n    try {\n      return await originalSetPage.call(this, pageName, false, {\n        ...options,\n        replaceUrl: "",\n        skipNavigationLoading: true,\n      });\n    } finally {\n      state.incrementalApplying = false;\n    }\n  }`,
      `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {\n    const clubTitleHtml = route.scope === "club" ? String(tablePageTitle.innerHTML || "") : "";\n    await requestIncrementalRoute(route, 1);\n    state.dataAccess = currentDataAccess(pageName);\n    state.incrementalApplying = true;\n    try {\n      return await originalSetPage.call(this, pageName, false, {\n        ...options,\n        replaceUrl: "",\n        skipNavigationLoading: true,\n      });\n    } finally {\n      state.incrementalApplying = false;\n      if (route.scope === "club" && clubTitleHtml) {\n        tablePageTitle.innerHTML = clubTitleHtml;\n        document.body.dataset.page = "club";\n        navButtons.forEach((button) => button.classList.remove("active"));\n      }\n    }\n  }`,
      "stable loaded club title",
    );

    source = replaceOnce(
      source,
      `    if (pageName === "mfl" && viewName === "stats") {\n      setPage("mflstats", true, { skipNavigationLoading: true });\n      return;\n    }`,
      `    if (pageName === "mfl" && viewName === "stats") {\n      homePage.hidden = true;\n      progressionPage.hidden = true;\n      mflStatsPage.hidden = false;\n      document.body.dataset.page = "mflstats";\n      [mflStatsTotalPlayers, mflStatsPackablePlayers, mflStatsAgedPlayers, mflStatsOtherPlayers].forEach((element) => {\n        if (element) element.textContent = "-";\n      });\n      mflStatsAgeDistribution?.replaceChildren();\n      setPage("mflstats", true, { skipNavigationLoading: false });\n      return;\n    }`,
      "destination-first MFL stats navigation",
    );
  } catch (error) {
    console.error("[MFL Front Office] Route patch failed; loading the original application.", error);
    source = originalSource;
  }

  const application = document.createElement("script");
  application.textContent = `${source}\n//# sourceURL=/app-source.txt?v=${VERSION}`;
  document.head.appendChild(application);
  application.remove();

  window.setTimeout(publishVersion, 0);
  window.setTimeout(publishVersion, 100);
})();