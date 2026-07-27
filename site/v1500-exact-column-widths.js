(() => {
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

  const isClubRoute = () => /^\/clubs\/[^/]+(?:\/(?:attributes|contracts))?\/?$/i.test(window.location.pathname);
  let clubRevealTimer = 0;

  if (isClubRoute()) {
    document.body.classList.add("clubAtomicInitial");
  }

  function applyExactColumnWidths() {
    const colGroup = document.querySelector("#tableColGroup");
    if (!colGroup) return false;

    let matched = 0;
    Array.from(colGroup.children).forEach((col) => {
      const matchedClass = Object.keys(WIDTHS).find((className) => col.classList.contains(className));
      if (!matchedClass) return;
      matched += 1;
      const width = `${WIDTHS[matchedClass]}%`;
      col.style.setProperty("width", width, "important");
      col.style.setProperty("min-width", width, "important");
      col.style.setProperty("max-width", width, "important");
      col.style.setProperty("transition", "none", "important");
    });

    return matched > 0;
  }

  function removeClubPager() {
    if (state?.currentPage !== "club" && !isClubRoute()) return;
    document.querySelectorAll("#progressionPage nav.pager, #progressionPage .pager").forEach((pager) => pager.remove());
  }

  function clubContentReady() {
    return Boolean(
      document.querySelector("#progressionPage") &&
      document.querySelector("#tableColGroup") &&
      document.querySelector("#tableBody") &&
      applyExactColumnWidths()
    );
  }

  function revealClubPage(className) {
    window.clearTimeout(clubRevealTimer);
    let attempts = 0;
    let stableFrames = 0;
    let previousSignature = "";

    const check = () => {
      attempts += 1;
      removeClubPager();
      applyExactColumnWidths();
      const signature = Array.from(document.querySelectorAll("#tableColGroup > col"))
        .map((col) => col.style.width)
        .join("|");

      if (clubContentReady() && signature && signature === previousSignature) stableFrames += 1;
      else stableFrames = 0;
      previousSignature = signature;

      if (stableFrames >= 2 || attempts >= 120) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.body.classList.remove(className);
        }));
        return;
      }

      clubRevealTimer = window.setTimeout(check, 16);
    };

    check();
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithExactPercentages() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyExactColumnWidths();
      removeClubPager();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithExactPercentages() {
      const result = originalBuildHeader.apply(this, arguments);
      applyExactColumnWidths();
      removeClubPager();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithExactPercentages() {
      const result = originalRenderTable.apply(this, arguments);
      applyExactColumnWidths();
      removeClubPager();
      return result;
    };
  }

  document.addEventListener("pointerdown", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='attributes'], .viewButton[data-view='contracts']");
    if (!button) return;
    document.body.classList.add("clubAtomicSwitch");
  }, true);

  document.addEventListener("click", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='attributes'], .viewButton[data-view='contracts']");
    if (!button) return;
    window.setTimeout(() => revealClubPage("clubAtomicSwitch"), 0);
  }, true);

  const observer = new MutationObserver(() => {
    applyExactColumnWidths();
    removeClubPager();

    if (document.body.classList.contains("clubAtomicInitial") && !document.body.classList.contains("loading")) {
      revealClubPage("clubAtomicInitial");
    }
  });

  function initialize() {
    applyExactColumnWidths();
    removeClubPager();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    if (document.body.classList.contains("clubAtomicInitial") && !document.body.classList.contains("loading")) {
      revealClubPage("clubAtomicInitial");
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .appShell .tableScroller table {
      width: 100% !important;
      table-layout: fixed !important;
    }
    .appShell .tableScroller col.col-select { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-id { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-flag { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-name { width: 13% !important; min-width: 13% !important; max-width: 13% !important; }
    .appShell .tableScroller col.col-nationality { width: 7% !important; min-width: 7% !important; max-width: 7% !important; }
    .appShell .tableScroller col.col-age { width: 4% !important; min-width: 4% !important; max-width: 4% !important; }
    .appShell .tableScroller col.col-positions { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
    .appShell .tableScroller col.col-seasons { width: 5% !important; min-width: 5% !important; max-width: 5% !important; }
    .appShell .tableScroller col.col-stat { width: 6% !important; min-width: 6% !important; max-width: 6% !important; }
    .appShell .tableScroller col.col-contract-revenue { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
    .appShell .tableScroller col.col-contract-club { width: 19% !important; min-width: 19% !important; max-width: 19% !important; }
    .appShell .tableScroller col.col-contract-division { width: 9% !important; min-width: 9% !important; max-width: 9% !important; }
    .appShell .tableScroller col.col-agent,
    .appShell .tableScroller col.col-joined-agency,
    .appShell .tableScroller col.col-owned-since { width: 9% !important; min-width: 9% !important; max-width: 9% !important; }
    .appShell .tableScroller col.col-link { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller .selectionCell { width: auto !important; min-width: 0 !important; }
    body[data-page="club"] #progressionPage nav.pager,
    body[data-page="club"] #progressionPage .pager { display: none !important; }
    body.clubAtomicInitial #loadingScreen { display: flex !important; visibility: visible !important; opacity: 1 !important; }
    body.clubAtomicInitial #progressionPage,
    body.clubAtomicSwitch #progressionPage .tableShell { visibility: hidden !important; opacity: 0 !important; }
    body.clubAtomicInitial #progressionPage *,
    body.clubAtomicSwitch #progressionPage .tableShell * { transition: none !important; }
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();