(() => {
  const VERSION = "1.150.0";
  const MAX_SEARCH_RESULTS = 5;
  const RECENT_CLUBS_STORAGE_KEY = "mfl-recent-search-clubs";
  const CLUB_ID_COLUMNS = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];
  let clubWidthUnlockTimer = null;
  let clubWidthObserver = null;
  let clubWidthLockStartedAt = 0;

  function clubIdColumn() {
    if (!Array.isArray(state?.columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => state.columns.includes(column)) || "";
  }

  function clubRowById(clubId) {
    const idColumn = clubIdColumn();
    if (!idColumn || !Array.isArray(state?.rows)) return null;
    return state.rows.find((row) => String(getValue(row, idColumn) || "").trim() === String(clubId).trim()) || null;
  }

  function clubIdFromResult(button) {
    if (button.dataset.clubId) return button.dataset.clubId;
    const info = String(button.querySelector(":scope > span")?.textContent || "");
    const match = info.match(/#([^\s·]+)/);
    const clubId = match ? match[1].trim() : "";
    if (clubId) button.dataset.clubId = clubId;
    return clubId;
  }

  function normalizedClubSearchData(clubId) {
    const row = clubRowById(clubId);
    if (!row) return null;
    const name = String(getValue(row, "active_contract_club_name") || "").trim();
    const division = typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
    return name ? { clubId: String(clubId), name, division } : null;
  }

  function normalizeClubResult(button) {
    const clubId = clubIdFromResult(button);
    const data = normalizedClubSearchData(clubId);
    const title = button.querySelector(":scope > strong");
    const info = button.querySelector(":scope > span");
    if (!data || !title || !info) {
      button.remove();
      return;
    }

    button.dataset.clubId = data.clubId;
    title.textContent = data.name;
    info.replaceChildren(document.createTextNode(`Club · #${data.clubId}`));
    if (data.division) {
      info.append(document.createTextNode(" · "));
      const label = document.createElement("span");
      label.className = "clubSearchDivision";
      label.textContent = data.division.name;
      label.style.color = data.division.color;
      info.appendChild(label);
    }
  }

  function readRecentClubs() {
    try {
      const value = JSON.parse(localStorage.getItem(RECENT_CLUBS_STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, MAX_SEARCH_RESULTS) : [];
    } catch {
      return [];
    }
  }

  function rememberClub(clubId) {
    const key = String(clubId || "").trim();
    if (!key) return;
    const recent = [key, ...readRecentClubs().filter((id) => id !== key)].slice(0, MAX_SEARCH_RESULTS);
    try {
      localStorage.setItem(RECENT_CLUBS_STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // Recent clubs still work for this session when storage is unavailable.
    }
  }

  function createRecentClubResult(clubId) {
    const data = normalizedClubSearchData(clubId);
    if (!data) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult clubSearchResult recentClubSearchResult";
    button.dataset.clubId = data.clubId;
    const title = document.createElement("strong");
    title.textContent = data.name;
    const info = document.createElement("span");
    button.append(title, info);
    normalizeClubResult(button);
    button.addEventListener("click", () => {
      rememberClub(data.clubId);
      if (typeof closeSearch === "function") closeSearch();
      window.location.assign(`/clubs/${encodeURIComponent(data.clubId)}/contracts`);
    });
    return button;
  }

  function prependRecentClubs() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    if (String(playerSearchInput.value || "").trim()) return;
    const fragment = document.createDocumentFragment();
    readRecentClubs().forEach((clubId) => {
      const result = createRecentClubResult(clubId);
      if (result) fragment.appendChild(result);
    });
    if (fragment.childElementCount) playerSearchResults.prepend(fragment);
  }

  function finalizeSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;
    prependRecentClubs();
    playerSearchResults.querySelectorAll(".clubSearchResult").forEach(normalizeClubResult);

    const seen = new Set();
    Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult")).forEach((result) => {
      const clubId = result.classList.contains("clubSearchResult") ? clubIdFromResult(result) : "";
      const key = clubId ? `club:${clubId}` : "";
      if (key && seen.has(key)) result.remove();
      else if (key) seen.add(key);
    });

    const results = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"));
    results.slice(MAX_SEARCH_RESULTS).forEach((result) => result.remove());
    const visibleResults = playerSearchResults.querySelectorAll(":scope > .searchResult");
    playerSearchResults.querySelectorAll(":scope > .searchHint").forEach((hint) => {
      if (visibleResults.length) hint.remove();
    });
    playerSearchResults.classList.toggle("filledSearchResults", visibleResults.length > 0);
  }

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowV1500() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      finalizeSearchResults();
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    const result = event.target.closest?.(".clubSearchResult");
    if (result) rememberClub(clubIdFromResult(result));
  }, true);

  function setFooterVersion() {
    const footerLink = document.querySelector(".siteFooter a[data-page='changelog']");
    if (footerLink) footerLink.textContent = `MFL Front Office v${VERSION}`;
    document.querySelectorAll("[data-app-version]").forEach((element) => {
      element.textContent = `v${VERSION}`;
    });
  }

  function createChangelogItem() {
    const item = document.createElement("li");
    item.dataset.version = VERSION;
    const version = document.createElement("span");
    version.textContent = `v${VERSION}`;
    const description = document.createElement("p");
    description.textContent = "Add club pages, searchable club routes, division details, and position-sorted club squads";
    item.append(version, description);
    return item;
  }

  function collapseOlderChangelogSections(list) {
    Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).forEach((section, index) => {
      const expanded = index === 0;
      section.classList.toggle("is-expanded", expanded);
      section.querySelector(":scope > .changelogMinorToggle")?.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  function addChangelogSection() {
    const list = document.querySelector(".changelogList");
    if (!list) return;
    Array.from(list.children).forEach((child) => {
      if (!child.classList.contains("changelogMinorSection") && /^v1\.150\.0$/i.test(child.querySelector(":scope > span")?.textContent || "")) child.remove();
    });
    let section = Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).find((candidate) =>
      /^v1\.150$/i.test(candidate.querySelector(".changelogMinorVersion")?.textContent || ""),
    );
    if (!section) {
      section = document.createElement("li");
      section.className = "changelogMinorSection";
      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      const title = document.createElement("span");
      title.className = "changelogMinorVersion";
      title.textContent = "v1.150";
      const meta = document.createElement("span");
      meta.className = "changelogMinorMeta";
      meta.textContent = "1 patch";
      const chevron = document.createElement("span");
      chevron.className = "changelogMinorChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = ">";
      toggle.append(title, meta, chevron);
      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patchList = document.createElement("ol");
      patchList.className = "changelogPatchList";
      patchList.appendChild(createChangelogItem());
      inner.appendChild(patchList);
      panel.appendChild(inner);
      section.append(toggle, panel);
      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.prepend(section);
    } else if (!section.querySelector(`[data-version='${VERSION}']`)) {
      section.querySelector(".changelogPatchList")?.prepend(createChangelogItem());
    }
    collapseOlderChangelogSections(list);
  }

  function rebuildClubColumns() {
    if (typeof buildTableColGroup === "function") buildTableColGroup();
  }

  function scheduleClubWidthUnlock() {
    window.clearTimeout(clubWidthUnlockTimer);
    const elapsed = Date.now() - clubWidthLockStartedAt;
    const wait = Math.max(180, 650 - elapsed);
    clubWidthUnlockTimer = window.setTimeout(() => {
      rebuildClubColumns();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove("clubWidthHardLock");
        clubWidthObserver?.disconnect();
        clubWidthObserver = null;
      }));
    }, wait);
  }

  function lockClubWidths() {
    window.clearTimeout(clubWidthUnlockTimer);
    clubWidthLockStartedAt = Date.now();
    document.body.classList.add("clubWidthHardLock");
    rebuildClubColumns();
    clubWidthObserver?.disconnect();
    const colGroup = document.querySelector("#tableColGroup");
    if (colGroup) {
      clubWidthObserver = new MutationObserver(() => {
        rebuildClubColumns();
        scheduleClubWidthUnlock();
      });
      clubWidthObserver.observe(colGroup, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }
    scheduleClubWidthUnlock();
  }

  document.addEventListener("pointerdown", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='contracts'], .viewButton[data-view='attributes']");
    if (button) lockClubWidths();
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .clubSearchResult > span { display: block !important; }
    .clubSearchDivision { display: inline !important; font-weight: 400 !important; }
    .clubPageLink, .contractDivisionLabel { font-weight: 400 !important; }
    .appShell:not(.menuClosed) .tableScroller .col-age { width: 2.5% !important; }
    .appShell:not(.menuClosed) .tableScroller .col-positions { width: 10% !important; }
    .appShell.menuClosed .tableScroller .col-age { width: 36.9px !important; }
    .appShell.menuClosed .tableScroller .col-positions { width: 147.6px !important; }
    body.clubWidthHardLock #progressionPage .tableShell,
    body.clubWidthHardLock #progressionPage .pager { visibility: hidden !important; opacity: 0 !important; }
    body.clubWidthHardLock #progressionPage .tableScroller table,
    body.clubWidthHardLock #progressionPage .tableScroller col { transition: none !important; }
  `;
  document.head.appendChild(style);

  function initialize() {
    setFooterVersion();
    addChangelogSection();
    finalizeSearchResults();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();