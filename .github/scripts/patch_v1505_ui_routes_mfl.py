from pathlib import Path
import re

APP_PATH = Path("site/app.js")
STYLE_PATH = Path("site/styles.css")
INDEX_PATH = Path("site/index.html")
EXPORT_PATH = Path("export_for_website.py")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected source was not found: {label}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected source was not replaced: {label} ({count})")
    return updated


app = APP_PATH.read_text(encoding="utf-8")
styles = STYLE_PATH.read_text(encoding="utf-8")
index = INDEX_PATH.read_text(encoding="utf-8")
export = EXPORT_PATH.read_text(encoding="utf-8")

app = replace_once(app, 'const VERSION = "1.150.4";', 'const VERSION = "1.150.5";', "app version")
app = replace_once(
    app,
    "Fix club-page loading, center opted-out layouts and footer outside the pinned sidebar, and keep shared columns exactly the same width across views",
    "Center all guest states, eliminate first-frame table and club flicker, keep guest routes clean, retain mixed search history, and restore MFL loading",
    "changelog description",
)
index = index.replace("/styles.css?v=1.150.4", "/styles.css?v=1.150.5")
index = index.replace("/app.js?v=1.150.4", "/app.js?v=1.150.5")
if "/styles.css?v=1.150.5" not in index or "/app.js?v=1.150.5" not in index:
    raise SystemExit("Asset versions were not updated")

index = replace_once(
    index,
    """        }
      })();
""",
    """        }

        const initialPath = window.location.pathname;
        const initialTableRoute = /^\/(?:database(?:\/|$)|mfl(?:\/attributes)?\/?$|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i.test(initialPath)
          && !/^\/mfl\/stats\/?$/i.test(initialPath);
        if (initialTableRoute) {
          document.documentElement.classList.add("table-layout-pending");
        }
      })();
""",
    "early table layout guard",
)

app = sub_once(
    app,
    r"async function finishLoading\(\) \{.*?\n\}\n\nfunction revealAppShell\(\)",
    '''async function finishLoading() {
  setLoadingPercent(100, "Loading complete");
  await paintLoadingProgress();

  if (typeof window.applyExactPlayerTableWidths === "function") {
    window.applyExactPlayerTableWidths();
    await paintLoadingProgress();
    window.applyExactPlayerTableWidths();
  }

  document.documentElement.classList.remove("table-layout-pending");
  document.body.classList.remove("tableLayoutPending");

  if (document.body.classList.contains("clubViewLoading")) {
    loadingScreen.classList.remove("failed", "complete", "leaving");
    loadingText.textContent = "Loading complete";
    revealAppShell();
    document.body.classList.remove("loading");
    document.documentElement.classList.remove("loading");
    return;
  }

  await new Promise((resolve) => window.setTimeout(resolve, 180));
  loadingScreen.classList.add("complete");
  loadingText.textContent = "Loading complete";
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  loadingScreen.classList.add("leaving");
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  loadingScreen.hidden = true;
  loadingScreen.classList.remove("complete", "leaving");
  revealAppShell();
  document.body.classList.remove("loading");
  document.documentElement.classList.remove("loading");
  flushPostLoadingToast();
}

function revealAppShell()''',
    "finishLoading",
)

app = replace_once(
    app,
    '''function pageTargetFromPath(path) {
  const cleanPath = String(path || "").split("?")[0];
''',
    '''function pageTargetFromPath(path) {
  const cleanPath = String(path || "").split("?")[0];

  if (!hasWalletOptIn()) {
    if (/^\/my-players(?:\/[^/]+)?$/.test(cleanPath)) {
      return {
        pageName: "myplayers",
        options: cleanPath === "/my-players" ? {} : { replaceUrl: "/my-players" },
      };
    }

    if (/^\/watchlist(?:\/[^/]+)?(?:\/[^/]+)?$/.test(cleanPath)) {
      return {
        pageName: "watchlist",
        options: cleanPath === "/watchlist" ? {} : { replaceUrl: "/watchlist" },
      };
    }
  }
''',
    "guest route parsing",
)

app = replace_once(
    app,
    '''  if (tablePages.has(pageName)) {
    const viewName = normalizeViewForPage(options.view || (pageName === state.currentPage ? state.view : defaultViewForPage(pageName)), pageName);
''',
    '''  if (!hasWalletOptIn()) {
    if (pageName === "watchlist") return "/watchlist";
    if (pageName === "myplayers") return "/my-players";
  }

  if (tablePages.has(pageName)) {
    const viewName = normalizeViewForPage(options.view || (pageName === state.currentPage ? state.view : defaultViewForPage(pageName)), pageName);
''',
    "guest page paths",
)

app = replace_once(
    app,
    '''    if ((state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") && !myPlayersLockedPage.hidden) {
      await setPage(state.currentPage, false);
      upgradedCurrentPage = true;
''',
    '''    if ((state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") && !myPlayersLockedPage.hidden) {
      const lockedPage = state.currentPage;
      await setPage(lockedPage, false, { view: "attributes" });
      if (lockedPage === "myplayers") {
        window.history.replaceState({}, "", "/my-players/attributes");
      } else if (lockedPage === "watchlist") {
        const watchlistId = state.currentWatchlistId || activeWatchlist()?.id || "";
        const targetPath = watchlistId
          ? `/watchlist/${encodeURIComponent(watchlistId)}/attributes`
          : "/watchlist/attributes";
        window.history.replaceState({}, "", targetPath);
      }
      upgradedCurrentPage = true;
''',
    "post opt-in canonical route",
)

app = sub_once(
    app,
    r'''  function setClubSwitching\(active\) \{.*?\n  \}\n\n  function finishClubSwitch\(\) \{.*?\n  \}\n\n\n  function hideClubPageControls''',
    '''  function setClubSwitching(active, options = {}) {
    const showLoadingScreen = active && options.showLoading !== false;
    document.body.classList.toggle("clubViewSwitching", active);
    document.body.classList.toggle("clubViewLoading", showLoadingScreen);

    if (showLoadingScreen && typeof loadingScreen !== "undefined" && loadingScreen) {
      loadingScreen.hidden = false;
      loadingScreen.classList.remove("failed", "complete", "leaving");
    }

    if (!active) {
      document.body.classList.remove("clubViewLoading");
    }

    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }

  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();

        requestAnimationFrame(() => {
          if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
          applyClubPresentation();
          document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));

          const shouldHideLoading = Boolean(
            typeof loadingScreen !== "undefined"
            && loadingScreen
            && !loadingScreen.hidden
            && document.body.classList.contains("clubViewLoading")
          );
          setClubSwitching(false, { showLoading: false });

          if (shouldHideLoading && loadingScreen) {
            loadingScreen.classList.add("leaving");
            window.setTimeout(() => {
              if (!document.body.classList.contains("clubViewLoading")) {
                loadingScreen.hidden = true;
                loadingScreen.classList.remove("complete", "leaving");
                flushPostLoadingToast();
              }
            }, 230);
          }

          resolve();
        });
      });
    });
  }


  function hideClubPageControls''',
    "club switch lifecycle",
)

app = replace_once(
    app,
    '''    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
''',
    '''    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
''',
    "club controls",
)

club_click_pattern = re.compile(
    r'''(document\.addEventListener\("click", \(event\) => \{\n    if \(state\.currentPage !== CLUB_PAGE\) return;.*?window\.history\.replaceState\(\{\}, "", canonicalClubRoute\(activeClubId, nextView\)\);\n    )setClubSwitching\(true\);''',
    re.S,
)
app, count = club_click_pattern.subn(r'''\1setClubSwitching(true, { showLoading: false });''', app, count=1)
if count != 1:
    raise SystemExit("Club view switch handler was not updated")

app = replace_once(
    app,
    '''function recentAgentKey(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  return normalizedWalletAddress ? `agent:${normalizedWalletAddress}` : "";
}
''',
    '''function recentAgentKey(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  return normalizedWalletAddress ? `agent:${normalizedWalletAddress}` : "";
}

function recentClubKey(clubId) {
  const normalizedClubId = String(clubId || "").trim();
  return normalizedClubId ? `club:${normalizedClubId}` : "";
}
''',
    "recent club key",
)

app = replace_once(
    app,
    '''  return items.map((item) => {
    if (item.startsWith("agent:")) {
''',
    '''  return items.map((item) => {
    if (item.startsWith("club:")) {
      return null;
    }

    if (item.startsWith("agent:")) {
''',
    "recent search club skip",
)

app = replace_once(
    app,
    '''    if (result.type === "agent") {
      button.innerHTML = `<strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.walletAddress)}</span>`;
''',
    '''    if (result.type === "agent") {
      button.dataset.searchKey = recentAgentKey(result.walletAddress);
      button.innerHTML = `<strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.walletAddress)}</span>`;
''',
    "agent result key",
)
app = replace_once(
    app,
    '''    const id = String(entry.playerId);
    const ovr = formatPlainValue(entry.overall, "overall");
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>OVR ${escapeHtml(ovr)} &middot; #${escapeHtml(id)} &middot; ${escapeHtml(entry.nationalityDisplay)} &middot; ${escapeHtml(entry.positionsDisplay)}</span>`;
''',
    '''    const id = String(entry.playerId);
    const ovr = formatPlainValue(entry.overall, "overall");
    button.dataset.searchKey = recentPlayerKey(id);
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>OVR ${escapeHtml(ovr)} &middot; #${escapeHtml(id)} &middot; ${escapeHtml(entry.nationalityDisplay)} &middot; ${escapeHtml(entry.positionsDisplay)}</span>`;
''',
    "player result key",
)

app = sub_once(
    app,
    r'''  function rememberClub\(clubId\) \{.*?\n  \}\n\n  function createRecentClubResult''',
    '''  function rememberClub(clubId) {
    const key = String(clubId || "").trim();
    if (!key) return;
    const recent = [key, ...readRecentClubs().filter((id) => id !== key)].slice(0, MAX_SEARCH_RESULTS);
    try {
      localStorage.setItem(RECENT_CLUBS_STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // Combined recent search state still works for this session.
    }

    const searchKey = recentClubKey(key);
    state.recentSearchItems = mergeRecentIdLists([searchKey], state.recentSearchItems);
    persistRecentSearchStates();
    saveTableState();
  }

  function createRecentClubResult''',
    "remember clubs in mixed history",
)

app = replace_once(
    app,
    '''    button.className = "searchResult clubSearchResult recentClubSearchResult";
    button.dataset.clubId = data.clubId;
''',
    '''    button.className = "searchResult clubSearchResult recentClubSearchResult";
    button.dataset.clubId = data.clubId;
    button.dataset.searchKey = recentClubKey(data.clubId);
''',
    "recent club result key",
)
app = replace_once(
    app,
    '''      button.type = "button";
      button.className = "searchResult clubSearchResult";
      const safeName = typeof escapeHtml === "function" ? escapeHtml(name) : name;
''',
    '''      button.type = "button";
      button.className = "searchResult clubSearchResult";
      button.dataset.clubId = clubId;
      button.dataset.searchKey = recentClubKey(clubId);
      const safeName = typeof escapeHtml === "function" ? escapeHtml(name) : name;
''',
    "query club result key",
)

app = sub_once(
    app,
    r'''  function finalizeSearchResults\(\) \{.*?\n  \}\n\n  if \(typeof renderSearchResultsNow === "function"\)''',
    '''  function finalizeSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;
    playerSearchResults.querySelectorAll(".clubSearchResult").forEach(normalizeClubResult);

    const query = String(playerSearchInput?.value || "").trim();
    const directResults = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"));
    const seen = new Set();
    directResults.forEach((result) => {
      const key = result.dataset.searchKey
        || (result.classList.contains("clubSearchResult") ? recentClubKey(clubIdFromResult(result)) : "");
      if (key) result.dataset.searchKey = key;
      if (key && seen.has(key)) result.remove();
      else if (key) seen.add(key);
    });

    if (!query) {
      const existingByKey = new Map(
        Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"))
          .filter((result) => result.dataset.searchKey)
          .map((result) => [result.dataset.searchKey, result]),
      );
      const ordered = [];
      state.recentSearchItems.slice(0, MAX_SEARCH_RESULTS).forEach((key) => {
        let result = existingByKey.get(key) || null;
        if (!result && key.startsWith("club:")) {
          result = createRecentClubResult(key.slice(5));
        }
        if (result && !ordered.includes(result)) ordered.push(result);
      });

      if (ordered.length) {
        playerSearchResults.replaceChildren(...ordered.slice(0, MAX_SEARCH_RESULTS));
        playerSearchResults.classList.add("filledSearchResults");
      } else {
        playerSearchResults.innerHTML = '<div class="searchHint">Recent searches will appear here.</div>';
        playerSearchResults.classList.remove("filledSearchResults");
      }
      return;
    }

    const resultPriority = (result) => {
      if (result.classList.contains("clubSearchResult")) return 1;
      return result.dataset.searchKey?.startsWith("agent:") ? 2 : 0;
    };
    const results = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"))
      .sort((a, b) => resultPriority(a) - resultPriority(b));
    results.forEach((result) => playerSearchResults.appendChild(result));
    results.slice(MAX_SEARCH_RESULTS).forEach((result) => result.remove());
    const visibleResults = playerSearchResults.querySelectorAll(":scope > .searchResult");
    playerSearchResults.querySelectorAll(":scope > .searchHint").forEach((hint) => {
      if (visibleResults.length) hint.remove();
    });
    playerSearchResults.classList.toggle("filledSearchResults", visibleResults.length > 0);
  }

  if (typeof renderSearchResultsNow === "function")''',
    "combined recent search ordering",
)

app = replace_once(
    app,
    '''function rowIsMflWalletPlayer(row) {
  return normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === mflWalletAddress;
}
''',
    '''function rowIsMflWalletPlayer(row) {
  const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
  const walletName = normalizedAgentName(getValue(row, "wallet_name")).toLowerCase();
  return walletAddress === mflWalletAddress || walletName === "mfl";
}
''',
    "MFL row identity",
)

app = replace_once(
    app,
    '''function mflPublicDataFile(manifest) {
  return manifest?.files?.mfl_public?.file || "players_mfl_public.json";
}
''',
    '''function mflPublicDataFile(manifest) {
  return manifest?.files?.mfl_public?.file || "players_mfl_public.json";
}

function mflChunkFromPublicData(chunk) {
  const columns = Array.isArray(chunk?.columns) ? chunk.columns : [];
  const rows = Array.isArray(chunk?.rows) ? chunk.rows : [];
  const walletAddressIndex = columns.indexOf("wallet_address");
  const walletNameIndex = columns.indexOf("wallet_name");
  if (walletAddressIndex < 0 && walletNameIndex < 0) {
    return { columns, rows: [] };
  }

  return {
    columns,
    rows: rows.filter((row) => {
      const walletAddress = walletAddressIndex >= 0 ? normalizeWalletAddress(row[walletAddressIndex]).toLowerCase() : "";
      const walletName = walletNameIndex >= 0 ? normalizedAgentName(row[walletNameIndex]).toLowerCase() : "";
      return walletAddress === mflWalletAddress || walletName === "mfl";
    }),
  };
}

async function fetchPublicDataChunk(manifest, access, options = {}) {
  if (access !== "mfl") {
    return fetchDataFile(publicDataFile(manifest), options);
  }

  try {
    const dedicatedChunk = await fetchDataFile(mflPublicDataFile(manifest), options);
    if (Array.isArray(dedicatedChunk?.rows) && dedicatedChunk.rows.length) {
      return dedicatedChunk;
    }
  } catch {
    // Fall back to the public database export below.
  }

  return mflChunkFromPublicData(await fetchDataFile(publicDataFile(manifest), options));
}
''',
    "MFL fallback loader",
)

app = replace_once(
    app,
    '''      const publicChunk = await fetchDataFile(access === "mfl" ? mflPublicDataFile(manifest) : publicDataFile(manifest), { useCache: true });
''',
    '''      const publicChunk = await fetchPublicDataChunk(manifest, access, { useCache: true });
''',
    "cached MFL fallback",
)
app = replace_once(
    app,
    '''        const publicChunk = await fetchDataFile(publicFile, {
          useCache: useCachedChunks,
          writeCache: !useCachedChunks,
          onProgress: publicProgress,
        });
''',
    '''        const publicChunk = await fetchPublicDataChunk(manifest, targetAccess, {
          useCache: useCachedChunks,
          writeCache: !useCachedChunks,
          onProgress: publicProgress,
        });
''',
    "live MFL fallback",
)
app = app.replace(
    "state.columns = publicDataColumns(manifest);",
    "state.columns = Array.isArray(publicChunk.columns) ? publicChunk.columns : publicDataColumns(manifest);",
)

export = replace_once(
    export,
    '''    mfl_rows = [row for row in rows if str(row["wallet_address"] or "").lower() == MFL_WALLET_ADDRESS]
''',
    '''    mfl_rows = [
        row
        for row in rows
        if str(row["wallet_address"] or "").strip().lower() == MFL_WALLET_ADDRESS
        or str(row["wallet_name"] or "").strip().lower() == "mfl"
    ]
''',
    "MFL export selection",
)

old_app_marker = "/* v1.150.4 pinned content grid and shared table widths */"
if old_app_marker not in app:
    raise SystemExit("Expected v1.150.4 app patch marker was not found")
app = app.split(old_app_marker, 1)[0].rstrip()
app += r'''

/* v1.150.5 stable pinned layout and pre-reveal table widths */
(() => {
  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/attributes)?\/?$|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const TABLE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);
  const WIDTHS = {
    "col-select": 3,
    "col-id": 3,
    "col-flag": 3,
    "col-name": 13,
    "col-nationality": 7,
    "col-age": 4,
    "col-positions": 8,
    "col-seasons": 5,
    "col-stat": 6,
    "col-contract-revenue": 8,
    "col-contract-club": 19,
    "col-contract-division": 9,
    "col-agent": 9,
    "col-joined-agency": 9,
    "col-owned-since": 9,
    "col-link": 3,
  };
  const FILLER_CLASS = "col-shared-width-filler";
  let cachedLayoutKey = "";
  let cachedContentWidth = 0;

  if (document.documentElement.classList.contains("table-layout-pending")) {
    document.body.classList.add("tableLayoutPending");
  }

  function playerTablePageActive() {
    return TABLE_PAGES.has(String(state?.currentPage || "")) || TABLE_ROUTE.test(window.location.pathname);
  }

  function pinnedSidebarWidth() {
    const rail = document.querySelector("#menuRail");
    return rail && !rail.hidden ? 190 : 0;
  }

  function sharedContentWidth() {
    const main = document.querySelector("main");
    if (!main) return 0;
    const styles = window.getComputedStyle(main);
    const viewportWidth = document.documentElement.clientWidth;
    const sidebarWidth = pinnedSidebarWidth();
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const key = [viewportWidth, sidebarWidth, paddingLeft, paddingRight].join(":");
    if (key !== cachedLayoutKey) {
      cachedLayoutKey = key;
      cachedContentWidth = Math.max(0, viewportWidth - sidebarWidth - paddingLeft - paddingRight);
    }
    return cachedContentWidth;
  }

  function restoreSingleTable() {
    document.querySelectorAll(".tableBodyScroller").forEach((bodyScroller) => {
      const bodyTable = bodyScroller.querySelector("table");
      const headerScroller = bodyScroller.previousElementSibling?.classList.contains("tableHeaderScroller")
        ? bodyScroller.previousElementSibling
        : null;
      const tableHeadElement = headerScroller?.querySelector("thead");
      if (bodyTable && tableHeadElement && !bodyTable.querySelector("thead")) {
        const colGroup = bodyTable.querySelector("colgroup");
        if (colGroup?.nextSibling) bodyTable.insertBefore(tableHeadElement, colGroup.nextSibling);
        else bodyTable.prepend(tableHeadElement);
      }
      headerScroller?.remove();
      bodyScroller.classList.remove("tableBodyScroller");
    });
  }

  function widthForColumn(column) {
    const className = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
    return className ? WIDTHS[className] : null;
  }

  function removeFillers(table, colGroup) {
    colGroup.querySelectorAll(`.${FILLER_CLASS}, .col-stable-width-filler, .col-exact-width-filler`).forEach((element) => element.remove());
    table.querySelectorAll(`th.${FILLER_CLASS}, td.${FILLER_CLASS}, th.col-stable-width-filler, td.col-stable-width-filler, th.col-exact-width-filler, td.col-exact-width-filler`).forEach((element) => element.remove());
  }

  function appendFiller(table, widthInPixels) {
    if (!(widthInPixels > 0.01)) return;
    const width = `${widthInPixels.toFixed(4)}px`;
    const fillerColumn = document.createElement("col");
    fillerColumn.className = FILLER_CLASS;
    fillerColumn.style.setProperty("width", width, "important");
    fillerColumn.style.setProperty("min-width", width, "important");
    fillerColumn.style.setProperty("max-width", width, "important");
    table.querySelector("colgroup")?.appendChild(fillerColumn);
    table.querySelectorAll("thead tr, tbody tr").forEach((row) => {
      const cell = document.createElement(row.closest("thead") ? "th" : "td");
      cell.className = FILLER_CLASS;
      cell.setAttribute("aria-hidden", "true");
      cell.style.setProperty("width", width, "important");
      cell.style.setProperty("min-width", width, "important");
      cell.style.setProperty("max-width", width, "important");
      row.appendChild(cell);
    });
  }

  function applySharedTableWidths() {
    if (!playerTablePageActive()) return false;
    restoreSingleTable();
    const page = document.querySelector("#progressionPage");
    const table = page?.querySelector(".tableScroller table");
    const colGroup = table?.querySelector("colgroup");
    const contentWidth = sharedContentWidth();
    if (!page || page.hidden || !table || !colGroup || !(contentWidth > 0)) return false;

    removeFillers(table, colGroup);
    const columns = Array.from(colGroup.children);
    const percentages = columns.map(widthForColumn);
    if (!percentages.length || percentages.some((width) => !Number.isFinite(width))) return false;
    const totalPercentage = percentages.reduce((sum, width) => sum + width, 0);
    if (totalPercentage > 100.01) return false;

    const exactWidth = `${contentWidth.toFixed(4)}px`;
    page.querySelectorAll(".tableShell, .tableScroller").forEach((element) => {
      element.style.setProperty("width", exactWidth, "important");
      element.style.setProperty("min-width", exactWidth, "important");
      element.style.setProperty("max-width", exactWidth, "important");
      element.style.setProperty("box-sizing", "border-box", "important");
      element.style.setProperty("overflow", "visible", "important");
    });
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    let assignedWidth = 0;
    columns.forEach((column, index) => {
      const pixelWidth = contentWidth * percentages[index] / 100;
      assignedWidth += pixelWidth;
      const width = `${pixelWidth.toFixed(4)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });
    appendFiller(table, Math.max(0, contentWidth - assignedWidth));
    return true;
  }

  function syncPinnedSidebarState() {
    document.body.classList.toggle("pinnedSidebarVisible", pinnedSidebarWidth() > 0);
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithSharedWidths() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithSharedWidths() {
      const result = originalBuildHeader.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithSharedWidths() {
      const result = originalRenderTable.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  if (typeof updateViewButtons === "function") {
    const originalUpdateViewButtons = updateViewButtons;
    updateViewButtons = function updateViewButtonsWithSharedWidths() {
      const result = originalUpdateViewButtons.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  const rail = document.querySelector("#menuRail");
  if (rail) {
    const railObserver = new MutationObserver(() => {
      cachedLayoutKey = "";
      cachedContentWidth = 0;
      syncPinnedSidebarState();
      applySharedTableWidths();
    });
    railObserver.observe(rail, { attributes: true, attributeFilter: ["hidden"] });
  }

  window.applyExactPlayerTableWidths = applySharedTableWidths;
  window.addEventListener("resize", () => {
    cachedLayoutKey = "";
    cachedContentWidth = 0;
    applySharedTableWidths();
  }, { passive: true });

  syncPinnedSidebarState();
  applySharedTableWidths();
})();
'''

old_style_marker = "/* v1.150.4 - Pinned content area, centered guest states, and shared table grid */"
if old_style_marker not in styles:
    raise SystemExit("Expected v1.150.4 style marker was not found")
styles = styles.split(old_style_marker, 1)[0].rstrip()
styles += r'''

/* v1.150.5 - Pinned content grid, guest centering, and flicker-free tables */
:root {
  --pinned-sidebar-width: 190px;
  --pinned-topbar-height: 102px;
}

html {
  overflow-y: scroll;
  scrollbar-gutter: stable;
}

.appShell,
.appShell.menuClosed,
.appShell.sidebarClosed,
.appShell.sidebarCollapsed,
.appShell.collapsed {
  --sidebar-offset: var(--pinned-sidebar-width) !important;
  transition: none !important;
}

.menuRail,
.appShell.menuClosed .menuRail,
.appShell.sidebarClosed .menuRail,
.appShell.sidebarCollapsed .menuRail,
.appShell.collapsed .menuRail {
  width: var(--pinned-sidebar-width) !important;
  padding: 14px !important;
  align-items: stretch !important;
  transition: none !important;
}

.sidebar,
.appShell.menuClosed .sidebar,
.appShell.sidebarClosed .sidebar,
.appShell.sidebarCollapsed .sidebar,
.appShell.collapsed .sidebar {
  width: 162px !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  align-items: stretch !important;
  transition: none !important;
}

.menuButton,
.appShell.menuClosed .menuButton,
.appShell.sidebarClosed .menuButton,
.appShell.sidebarCollapsed .menuButton,
.appShell.collapsed .menuButton {
  width: 100% !important;
  margin: 0 !important;
  justify-content: flex-start !important;
  pointer-events: none !important;
  cursor: default !important;
  transition: none !important;
}

.appShell.menuClosed .menuText,
.appShell.sidebarClosed .menuText,
.appShell.sidebarCollapsed .menuText,
.appShell.collapsed .menuText,
.appShell.menuClosed .navText,
.appShell.sidebarClosed .navText,
.appShell.sidebarCollapsed .navText,
.appShell.collapsed .navText {
  max-width: 112px !important;
  margin-left: 8px !important;
  opacity: 1 !important;
}

.appShell.menuClosed .navButton,
.appShell.sidebarClosed .navButton,
.appShell.sidebarCollapsed .navButton,
.appShell.collapsed .navButton {
  justify-content: flex-start !important;
  width: 100% !important;
  gap: 8px !important;
  padding: 0 14px !important;
}

main,
.siteFooter {
  box-sizing: border-box !important;
  transition: none !important;
}

body.pinnedSidebarVisible main,
body.pinnedSidebarVisible .siteFooter {
  width: calc(100% - var(--pinned-sidebar-width)) !important;
  margin-left: var(--pinned-sidebar-width) !important;
}

body:not(.pinnedSidebarVisible) main,
body:not(.pinnedSidebarVisible) .siteFooter,
.menuRail[hidden] + main {
  width: 100% !important;
  margin-left: 0 !important;
}

.siteFooter {
  justify-items: center !important;
  text-align: center !important;
}

main > .pageView,
.homePage,
.changelogPage,
.myPlayersLockedPage {
  width: 100% !important;
  left: auto !important;
}

.myPlayersLockedPage:not([hidden]),
body.guest main > [class*="LockedPage"]:not([hidden]),
body.guest main > [class*="OptInPage"]:not([hidden]) {
  display: grid !important;
  place-items: center !important;
  min-height: calc(100vh - var(--pinned-topbar-height) - 52px) !important;
  margin: 0 !important;
  padding: 24px !important;
}

.myPlayersLockedContent,
body.guest main [class*="LockedContent"],
body.guest main [class*="OptInContent"] {
  width: min(520px, 100%) !important;
  margin: auto !important;
  text-align: center !important;
}

#progressionPage {
  transition: opacity 180ms ease, transform 180ms ease !important;
}

html.table-layout-pending #progressionPage,
body.tableLayoutPending #progressionPage,
body.clubViewSwitching #progressionPage {
  visibility: visible !important;
  opacity: 0 !important;
  transform: translateY(6px) !important;
  pointer-events: none !important;
}

html.table-layout-pending #loadingScreen,
body.tableLayoutPending #loadingScreen,
body.clubViewLoading #loadingScreen {
  display: grid !important;
  visibility: visible !important;
  align-content: center !important;
  justify-items: center !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

body.clubViewSwitching:not(.clubViewLoading) #loadingScreen {
  display: none !important;
  pointer-events: none !important;
}

body.clubViewSwitching .navButton.active {
  border-color: var(--border-strong) !important;
  background: var(--surface) !important;
  color: var(--text) !important;
}

body[data-page="club"] #progressionPage .quickFilters,
body[data-page="club"] #progressionPage .controlsBar,
body[data-page="club"] #progressionPage .pager,
body[data-page="club"] #progressionPage nav.pager {
  display: none !important;
}

body[data-page="watchlist"] #progressionPage .views {
  display: flex !important;
  justify-content: flex-start !important;
  text-align: left !important;
}

body[data-page="watchlist"] #progressionPage .viewButton[data-view="attributes"] { order: 1 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="next"] { order: 2 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="contracts"] { order: 3 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="current"] { order: 4 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="all"] { order: 5 !important; }
body[data-page="watchlist"] #progressionPage .watchlistSwitcher {
  order: 10 !important;
  margin-left: auto !important;
}

#progressionPage .tableShell,
#progressionPage .tableScroller,
#progressionPage .tableScroller table {
  box-sizing: border-box !important;
}

#progressionPage .tableShell,
#progressionPage .tableScroller {
  overflow: visible !important;
}

#progressionPage .tableScroller table {
  table-layout: fixed !important;
  border-spacing: 0 !important;
}

#progressionPage .tableScroller table,
#progressionPage .tableScroller col,
#progressionPage .tableScroller th,
#progressionPage .tableScroller td {
  transition: none !important;
  animation: none !important;
}

#progressionPage .tableScroller .col-shared-width-filler,
#progressionPage .tableScroller .col-stable-width-filler,
#progressionPage .tableScroller .col-exact-width-filler {
  padding: 0 !important;
  border-left: 0 !important;
  border-right: 0 !important;
  background: inherit !important;
  pointer-events: none !important;
}

@media (min-width: 901px) {
  body:not(.loading):not(.booting).pinnedSidebarVisible.tableLayoutPending #loadingScreen,
  body:not(.loading):not(.booting).pinnedSidebarVisible.clubViewLoading #loadingScreen {
    inset: var(--pinned-topbar-height) 0 0 var(--pinned-sidebar-width) !important;
    width: auto !important;
    height: auto !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  #progressionPage {
    transition: none !important;
  }
}
'''

APP_PATH.write_text(app + "\n", encoding="utf-8")
STYLE_PATH.write_text(styles + "\n", encoding="utf-8")
INDEX_PATH.write_text(index, encoding="utf-8")
EXPORT_PATH.write_text(export, encoding="utf-8")
