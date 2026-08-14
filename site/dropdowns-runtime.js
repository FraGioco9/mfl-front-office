(() => {
  "use strict";

  const enhancedSelects = new WeakSet();
  const ROWS_CHEVRON_RESERVE = 20;

  function visibleSelect(select) {
    return select instanceof HTMLSelectElement
      && select.isConnected
      && !select.hidden
      && select.getClientRects().length > 0;
  }

  function preserveRowsFootprint(select) {
    if (select.id !== "pageSizeSelect") return;
    const width = select.getBoundingClientRect().width;
    if (!Number.isFinite(width) || width <= 0) return;

    const reservedWidth = `${width + ROWS_CHEVRON_RESERVE}px`;
    select.style.setProperty("--mfl-page-size-select-width", reservedWidth);
    select.style.width = reservedWidth;
    select.style.flex = `0 0 ${reservedWidth}`;
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    if (enhancedSelects.has(select)) return select;

    /* Preserve the pre-dropdown Rows width and add dedicated room for the
     * number plus picker chevron before enabling the customizable picker. */
    preserveRowsFootprint(select);
    select.dataset.mflDropdownEnhanced = "true";
    enhancedSelects.add(select);
    return select;
  }

  function normalizeStaticMenus() {
    const accountButton = document.getElementById("accountButton");
    const accountDropdown = document.getElementById("accountDropdown");
    if (accountButton instanceof HTMLButtonElement) {
      accountButton.dataset.mflDropdownTrigger = "true";
    }
    if (accountDropdown instanceof HTMLElement) {
      accountDropdown.dataset.mflDropdownMenu = "true";
      accountDropdown.querySelectorAll(":scope > button").forEach((button) => {
        if (button instanceof HTMLButtonElement) button.dataset.mflDropdownOption = "true";
      });
    }

    const watchlistButton = document.getElementById("watchlistButton");
    const watchlistDropdown = document.getElementById("watchlistDropdown");
    if (watchlistButton instanceof HTMLButtonElement) {
      watchlistButton.dataset.mflDropdownTrigger = "true";
    }
    if (watchlistDropdown instanceof HTMLElement) {
      watchlistDropdown.dataset.mflDropdownMenu = "true";
    }
  }

  function enhanceVisible(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll("select").forEach((select) => {
      if (visibleSelect(select)) enhanceSelect(select);
    });
    normalizeStaticMenus();
  }

  function syncSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    if (visibleSelect(select)) enhanceSelect(select);
  }

  enhanceVisible(document);
  window.addEventListener("mfl:ready", () => enhanceVisible(document));

  window.__mflDropdowns = Object.freeze({
    enhanceSelect,
    enhanceVisible,
    syncSelect,
  });
})();