import { readFile, writeFile } from "node:fs/promises";

async function rewrite(path, transform) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const next = transform(source);
  if (next === source) return false;
  await writeFile(new URL(path, import.meta.url), next, "utf8");
  return true;
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceRegexRequired(source, pattern, after, label) {
  if (source.includes(after)) return source;
  if (!pattern.test(source)) throw new Error(`Could not find ${label}.`);
  return source.replace(pattern, after);
}

await rewrite("./index.html", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `        const root = document.documentElement;\n        root.dataset.initialPage = window.location.pathname.replace(/^\\//, "") || "home";`,
    `        const root = document.documentElement;\n        const initialPath = String(window.location.pathname || "/");\n        const initialPathParts = initialPath.split("/").filter(Boolean);\n        const initialRoot = String(initialPathParts[0] || "").toLowerCase();\n        const exactSinglePage = ["evaluation", "settings", "changelog"].includes(initialRoot) && initialPathParts.length === 1;\n        const tableRouteShape = ["database", "mfl", "progression", "my-players"].includes(initialRoot) && initialPathParts.length <= 2;\n        const watchlistRouteShape = initialRoot === "watchlist" && initialPathParts.length <= 3;\n        const agentRouteShape = initialRoot === "agents" && initialPathParts.length >= 2 && initialPathParts.length <= 3;\n        const clubRouteShape = ["clubs", "club"].includes(initialRoot) && initialPathParts.length >= 2 && initialPathParts.length <= 3;\n        const playerRouteShape = initialRoot === "players" && initialPathParts.length === 2;\n        const knownRouteShape = initialPathParts.length === 0\n          || exactSinglePage\n          || tableRouteShape\n          || watchlistRouteShape\n          || agentRouteShape\n          || clubRouteShape\n          || playerRouteShape;\n        root.dataset.initialPage = knownRouteShape\n          ? initialPath.replace(/^\\/+|\\/+$/g, "") || "home"\n          : "notfound";`,
    "head-time route-shape classifier",
  );

  source = replaceRequired(
    source,
    `        const tablePage = firstPart === "my-players"\n          ? "myplayers"\n          : firstPart === "clubs" || firstPart === "club"\n            ? "club"\n            : ["database", "mfl", "progression", "watchlist", "agents"].includes(firstPart)\n              ? firstPart\n              : "";`,
    `        const tablePage = root.dataset.initialPage === "notfound"\n          ? ""\n          : firstPart === "my-players"\n            ? "myplayers"\n            : firstPart === "clubs" || firstPart === "club"\n              ? "club"\n              : ["database", "mfl", "progression", "watchlist", "agents"].includes(firstPart)\n                ? firstPart\n                : "";`,
    "first-paint table route gate",
  );

  source = replaceRequired(
    source,
    `      html[data-stored-wallet-opt-in="false"]:not(.mflInitialRouteResolved):is(\n        [data-initial-page^="my-players"],\n        [data-initial-page^="watchlist"],\n        [data-initial-page="settings"]\n      ) #myPlayersLockedPage {\n        display: block;\n      }\n      html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved) #homePage {`,
    `      html[data-stored-wallet-opt-in="false"]:not(.mflInitialRouteResolved):is(\n        [data-initial-page^="my-players"],\n        [data-initial-page^="watchlist"],\n        [data-initial-page="settings"]\n      ) #myPlayersLockedPage {\n        display: block;\n      }\n      html[data-initial-page="notfound"]:not(.mflInitialRouteResolved) #homePage {\n        display: none;\n      }\n      html[data-initial-page="notfound"]:not(.mflInitialRouteResolved) #routeMessagePage {\n        display: block;\n      }\n      html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved) #homePage {`,
    "static not-found first-paint CSS",
  );

  source = replaceRequired(
    source,
    `        <section id="myPlayersLockedPage" class="pageView myPlayersLockedPage" hidden>`,
    `        <section id="routeMessagePage" class="pageView myPlayersLockedPage" hidden>\n          <div class="myPlayersLockedContent">\n            <h2 id="routeMessageTitle">Page not found</h2>\n            <p id="routeMessageText">The requested page could not be found.</p>\n            <button id="routeMessageHomeButton" class="homeOptInButton" type="button">Home</button>\n          </div>\n        </section>\n\n        <section id="myPlayersLockedPage" class="pageView myPlayersLockedPage" hidden>`,
    "static route-message page",
  );
  return source;
});

await rewrite("./bootstrap.js", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `    const storedOptIn = root.dataset.storedWalletOptIn === "true";\n\n    if (!storedOptIn && (["watchlist", "myplayers"].includes(tablePage) || initialPage === "settings")) {`,
    `    const storedOptIn = root.dataset.storedWalletOptIn === "true";\n\n    if (initialPage === "notfound") return document.getElementById("routeMessagePage");\n    if (!storedOptIn && (["watchlist", "myplayers"].includes(tablePage) || initialPage === "settings")) {`,
    "bootstrap not-found shell target",
  );

  source = replaceRequired(
    source,
    `  function primeRouteSkeleton(target) {\n    if (!(target instanceof HTMLElement)) return;\n    if (target.id === "homePage") {`,
    `  function primeRouteSkeleton(target) {\n    if (!(target instanceof HTMLElement)) return;\n    if (target.id === "routeMessagePage") {\n      const title = document.getElementById("routeMessageTitle");\n      const message = document.getElementById("routeMessageText");\n      const homeButton = document.getElementById("routeMessageHomeButton");\n      if (title instanceof HTMLElement) title.textContent = "Page not found";\n      if (message instanceof HTMLElement) message.textContent = "The requested page could not be found.";\n      if (homeButton instanceof HTMLButtonElement) {\n        homeButton.hidden = false;\n        if (homeButton.dataset.mflBootstrapHomeBound !== "true") {\n          homeButton.dataset.mflBootstrapHomeBound = "true";\n          homeButton.addEventListener("click", () => window.location.assign("/"));\n        }\n      }\n      return;\n    }\n    if (target.id === "homePage") {`,
    "bootstrap route-message priming",
  );
  return source;
});

await rewrite("./static-ui-runtime.js", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `    if (state.page === "notfound") return document.getElementById("myPlayersLockedPage");`,
    `    if (state.page === "notfound") return document.getElementById("routeMessagePage");`,
    "static UI not-found shell",
  );
  source = replaceRegexRequired(
    source,
    /  function primeNotFoundShell\(state\) \{[\s\S]*?\n  \}\n\n  function syncDestinationTableHeader/,
    `  function primeNotFoundShell(state) {\n    if (state.page !== "notfound") return;\n    const title = document.getElementById("routeMessageTitle");\n    const message = document.getElementById("routeMessageText");\n    const homeButton = document.getElementById("routeMessageHomeButton");\n    if (title) title.textContent = "Page not found";\n    if (message) message.textContent = "The requested page could not be found.";\n    if (homeButton) homeButton.hidden = false;\n  }\n\n  function syncDestinationTableHeader`,
    "static UI not-found primer",
  );
  return source;
});

await rewrite("./modules/app-core.js", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `  if (routeId && !found) {\n    const firstWatchlist = state.watchlists[0] || ensureDefaultWatchlist();\n    state.currentWatchlistId = firstWatchlist?.id || "";\n    setActiveWatchlistIds(firstWatchlist?.playerIds || []);\n    renderWatchlistSwitcher();\n    showToast("Watchlist not found.");\n    updateWatchlistUrl(true, true, options.view);\n    return;\n  }`,
    `  if (routeId && !found) {\n    const firstWatchlist = state.watchlists[0] || ensureDefaultWatchlist();\n    state.currentWatchlistId = firstWatchlist?.id || "";\n    setActiveWatchlistIds(firstWatchlist?.playerIds || []);\n    renderWatchlistSwitcher();\n    showToast("Watchlist not found.");\n    updateWatchlistUrl(true, true, options.view);\n    return firstWatchlist || null;\n  }`,
    "missing Watchlist fallback return",
  );
  source = replaceRequired(
    source,
    `  if (pageName === "watchlist" && hasWalletOptIn()) {\n    state.currentPage = pageName;\n    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";\n    await ensureWatchlistRoute(options);\n  }`,
    `  if (pageName === "watchlist" && hasWalletOptIn()) {\n    state.currentPage = pageName;\n    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";\n    const selectedWatchlist = await ensureWatchlistRoute(options);\n    if (selectedWatchlist?.id) {\n      options = { ...options, watchlistId: selectedWatchlist.id };\n    }\n  }`,
    "authoritative Watchlist route selection",
  );
  return source;
});

await rewrite("./modules/app-core-route-policy.js", (input) => {
  let source = input;
  const routeHelpers = `const ROUTE_MESSAGE_HELPERS = \`function showRouteMessagePage(title, message, options = {}) {\n  const pageName = String(options.pageName || "notfound");\n  const activeNavPage = String(options.activeNavPage || "");\n  const showOptIn = Boolean(options.showOptIn);\n  const routeMessagePage = document.getElementById("routeMessagePage");\n  const targetPage = showOptIn ? myPlayersLockedPage : routeMessagePage;\n  state.currentPage = pageName;\n  document.body.dataset.page = pageName;\n\n  document.querySelectorAll("main > .pageView").forEach((page) => {\n    if (page instanceof HTMLElement) page.hidden = page !== targetPage;\n  });\n\n  const titleElement = document.getElementById(showOptIn ? "optInLockedTitle" : "routeMessageTitle");\n  const messageElement = document.getElementById(showOptIn ? "optInLockedMessage" : "routeMessageText");\n  const optInButton = document.getElementById("myPlayersOptInButton");\n  const homeButton = document.getElementById("routeMessageHomeButton");\n  if (titleElement) titleElement.textContent = String(title || "Page not found");\n  if (messageElement) messageElement.textContent = String(message || "The requested page could not be found.");\n  if (optInButton) optInButton.hidden = !showOptIn;\n  if (homeButton) homeButton.hidden = showOptIn || options.showHome === false;\n\n  navButtons.forEach((button) => {\n    button.classList.toggle("active", Boolean(activeNavPage) && button.dataset.page === activeNavPage);\n  });\n  syncHomeLoginButton();\n  updateMenuVisibility();\n  return true;\n}\n\nwindow.__mflShowRouteMessage = showRouteMessagePage;\n\nfunction showProgressionAccessRequired() {\n  const optedIn = hasWalletOptIn();\n  return showRouteMessagePage(\n    "Progression unavailable",\n    optedIn\n      ? "Your linked wallet is not authorised to view Progression."\n      : "Opt in to request access to Progression.",\n    {\n      pageName: "progression",\n      activeNavPage: "progression",\n      showOptIn: !optedIn,\n      showHome: false,\n    },\n  );\n}\`;`;
  source = replaceRegexRequired(
    source,
    /const ROUTE_MESSAGE_HELPERS = `function showRouteMessagePage[\s\S]*?\n`;\n\nconst CANONICAL_PAGE_TARGET/,
    `${routeHelpers}\n\nconst CANONICAL_PAGE_TARGET`,
    "dedicated route-message helper",
  );

  source = replaceRequired(
    source,
    `  let club = String(routeChunks.club || "");\n  if (!club) throw new Error("Cannot normalize route policy without the Club route chunk.");\n  club = replaceRequired(`,
    `  let club = String(routeChunks.club || "");\n  if (!club) throw new Error("Cannot normalize route policy without the Club route chunk.");\n  club = replaceRequired(\n    club,\n    \`  async function ensureClubTitleIdentity(clubId) {\`,\n    \`  async function fetchAuthoritativeClubTitleIdentity(clubId) {\n    const normalizedClubId = String(clubId || "").trim();\n    if (!normalizedClubId) return null;\n    try {\n      const parameters = new URLSearchParams({\n        mode: "search",\n        type: "recent",\n        clubIds: normalizedClubId,\n      });\n      const response = await fetch("/api/data?" + parameters.toString(), {\n        cache: "no-store",\n        headers: { Accept: "application/json" },\n      });\n      if (!response.ok) return null;\n      const payload = await response.json();\n      const clubEntry = Array.isArray(payload?.clubs)\n        ? payload.clubs.find((candidate) => String(candidate?.clubId || "") === normalizedClubId)\n        : null;\n      if (!clubEntry?.name) return null;\n      const division = typeof contractDivisionInfo === "function"\n        ? contractDivisionInfo(clubEntry.division)\n        : null;\n      return saveClubTitleIdentity({\n        clubId: normalizedClubId,\n        name: clubEntry.name,\n        division,\n      });\n    } catch {\n      return null;\n    }\n  }\n\n  async function ensureClubTitleIdentity(clubId) {\`,\n    "authoritative Club existence lookup",\n  );\n  club = replaceRequired(`,
    "authoritative Club existence lookup injection",
  );

  source = replaceRequired(
    source,
    `        void clubTitleReady.then((resolvedTitle) => {\n          if (resolvedTitle || String(activeClubId) !== nextClubId || state.currentPage !== CLUB_PAGE) return;\n          window.__mflShowRouteMessage?.("Club not found", "The requested club could not be found.", { pageName: "club" });\n        });`,
    `        void fetchAuthoritativeClubTitleIdentity(nextClubId).then((resolvedTitle) => {\n          if (resolvedTitle || String(activeClubId) !== nextClubId || state.currentPage !== CLUB_PAGE) return;\n          try {\n            const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");\n            if (stored && typeof stored === "object" && !Array.isArray(stored)) {\n              delete stored[nextClubId];\n              localStorage.setItem(CLUB_DISPLAY_DATA_STORAGE_KEY, JSON.stringify(stored));\n            }\n          } catch {\n            // Missing Club rendering does not depend on storage cleanup.\n          }\n          window.__mflShowRouteMessage?.("Club not found", "The requested club could not be found.", { pageName: "club" });\n        });`,
    "authoritative missing Club verification",
  );
  return source;
});

console.log("PR #140 route fixes applied.");
