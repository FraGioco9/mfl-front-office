(() => {
  const VERSION = "1.150.0";
  const MAX_SEARCH_RESULTS = 5;
  const CLUB_ID_COLUMNS = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];

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

  function normalizeClubResult(button) {
    const clubId = clubIdFromResult(button);
    const row = clubRowById(clubId);
    const title = button.querySelector(":scope > strong");
    const info = button.querySelector(":scope > span");
    if (!clubId || !row || !title || !info) {
      button.remove();
      return;
    }

    const rawDivision = getValue(row, "active_contract_club_division");
    const division = typeof contractDivisionInfo === "function" ? contractDivisionInfo(rawDivision) : null;
    info.replaceChildren(document.createTextNode(`Club · #${clubId}`));

    if (division) {
      info.append(document.createTextNode(" · "));
      const label = document.createElement("span");
      label.className = "clubSearchDivision contractDivisionLabel";
      label.textContent = division.name;
      label.style.color = division.color;
      info.appendChild(label);
    }
  }

  function finalizeSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;

    playerSearchResults.querySelectorAll(".clubSearchResult").forEach(normalizeClubResult);

    const results = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"));
    results.slice(MAX_SEARCH_RESULTS).forEach((result) => result.remove());

    const visibleResults = playerSearchResults.querySelectorAll(":scope > .searchResult");
    playerSearchResults.querySelectorAll(":scope > .searchHint").forEach((hint) => {
      if (visibleResults.length && /no players or agents found/i.test(hint.textContent || "")) hint.remove();
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

  function setFooterVersion() {
    const selectors = [
      "footer .version",
      "footer [class*='version']",
      "footer [id*='version']",
      ".siteFooter .version",
      ".appFooter .version",
      "[data-app-version]",
    ];
    document.querySelectorAll(selectors.join(",")).forEach((element) => {
      element.textContent = `v${VERSION}`;
    });

    document.querySelectorAll("footer, .siteFooter, .appFooter").forEach((footer) => {
      const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if (/^\s*v?1\.\d+\.\d+\s*$/i.test(node.nodeValue || "")) node.nodeValue = `v${VERSION}`;
      });
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

  function addChangelogSection() {
    const list = document.querySelector(".changelogList");
    if (!list || list.querySelector(`[data-version='${VERSION}']`)) return;

    if (list.dataset.sectioned !== "true") {
      list.prepend(createChangelogItem());
      return;
    }

    const section = document.createElement("li");
    section.className = "changelogMinorSection is-expanded";

    const toggle = document.createElement("button");
    toggle.className = "changelogMinorToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "true");

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
  }

  document.addEventListener("pointerdown", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='contracts'], .viewButton[data-view='attributes']");
    if (button) document.body.classList.add("clubViewSwitching");
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .clubSearchResult > span { display: block !important; }
    .clubSearchDivision { display: inline !important; font-weight: 700; }
    body.clubViewSwitching #progressionPage .tableShell,
    body.clubViewSwitching #progressionPage .pager { visibility: hidden !important; }
    body.clubViewSwitching #progressionPage .tableScroller table,
    body.clubViewSwitching #progressionPage .tableScroller col { transition: none !important; }
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