(() => {
  "use strict";

  const enhancedSelects = new WeakSet();
  const suppressNextClick = new WeakSet();

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
      accountButton.setAttribute("aria-controls", "accountDropdown");
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
      watchlistButton.setAttribute("aria-controls", "watchlistDropdown");
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

  function isSelectOpen(select) {
    if (!(select instanceof HTMLSelectElement)) return false;
    try {
      return select.matches(":open");
    } catch {
      return false;
    }
  }

  function closeStaticDropdown(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.getAttribute("aria-expanded") !== "true") return false;

    const menuId = String(button.getAttribute("aria-controls") || "").trim();
    const menu = menuId ? document.getElementById(menuId) : null;
    if (menu instanceof HTMLElement) menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.blur();
    return true;
  }

  /* A second click on any open dropdown closes it and removes focus from the
   * trigger instead of allowing that same click to reopen or leave it selected. */
  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const select = target.closest("select");
    if (select instanceof HTMLSelectElement && isSelectOpen(select)) {
      suppressNextClick.add(select);
      event.preventDefault();
      event.stopImmediatePropagation();
      select.blur();
      return;
    }

    const trigger = target.closest('[data-mfl-dropdown-trigger="true"]');
    if (!(trigger instanceof HTMLButtonElement)) return;
    if (!closeStaticDropdown(trigger)) return;

    suppressNextClick.add(trigger);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const control = target.closest('select, [data-mfl-dropdown-trigger="true"]');
    if (!(control instanceof HTMLElement) || !suppressNextClick.has(control)) return;

    suppressNextClick.delete(control);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  enhanceVisible(document);
  window.addEventListener("mfl:ready", () => enhanceVisible(document));

  window.__mflDropdowns = Object.freeze({
    enhanceSelect,
    enhanceVisible,
    syncSelect,
  });
})();