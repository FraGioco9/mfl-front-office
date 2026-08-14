(() => {
  "use strict";

  const enhancedSelects = new WeakSet();

  function visibleSelect(select) {
    return select instanceof HTMLSelectElement
      && select.isConnected
      && !select.hidden
      && select.getClientRects().length > 0;
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    if (enhancedSelects.has(select)) return select;

    /* Static selects can already have their first-paint dropdown appearance in
     * CSS. The runtime only marks visible selects so dynamically-created ones
     * opt into the same dropdown styling without changing their geometry. */
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