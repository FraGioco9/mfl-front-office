(() => {
  "use strict";

  const enhancedSelects = new WeakSet();
  const suppressNextClick = new WeakSet();
  const FILTER_CONTROL_SELECTOR = "input, select, textarea, button, [tabindex]";
  let clubPointerPressedView = "";
  let clubPointerCommittedView = "";

  function visibleSelect(select) {
    return select instanceof HTMLSelectElement
      && select.isConnected
      && !select.hidden
      && select.getClientRects().length > 0;
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    if (enhancedSelects.has(select)) return select;

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

  function openSelect() {
    const active = document.activeElement;
    if (active instanceof HTMLSelectElement && isSelectOpen(active)) return active;
    return Array.from(document.querySelectorAll("select"))
      .find((select) => isSelectOpen(select)) || null;
  }

  function clubRouteActive() {
    return /^\/(?:clubs|club)\/[^/]+(?:\/|$)/i.test(window.location.pathname);
  }

  function clubViewButtonFromTarget(target) {
    if (!(target instanceof Element) || !clubRouteActive()) return null;
    const button = target.closest("#progressionPage .views .viewButton[data-view]");
    return button instanceof HTMLButtonElement ? button : null;
  }

  function syncAttributesViewLabel() {
    const button = document.querySelector("#progressionPage .views .viewButton[data-view='attributes']");
    if (!(button instanceof HTMLButtonElement)) return;
    const label = clubRouteActive() ? "Squad" : "Attributes";
    if (button.textContent !== label) button.textContent = label;
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

  function clearInitialFilterFocus() {
    const filtersModal = document.getElementById("filtersModal");
    const active = document.activeElement;
    if (!(filtersModal instanceof HTMLElement) || !(active instanceof HTMLElement)) return;
    if (filtersModal.contains(active)) active.blur();
  }

  function filterControlForTarget(target) {
    const filtersModal = document.getElementById("filtersModal");
    if (!(filtersModal instanceof HTMLElement) || filtersModal.hidden) return null;

    const direct = target instanceof Element ? target.closest(FILTER_CONTROL_SELECTOR) : null;
    if (direct instanceof HTMLElement && filtersModal.contains(direct)) return direct;

    const active = document.activeElement;
    return active instanceof HTMLElement
      && filtersModal.contains(active)
      && active.matches(FILTER_CONTROL_SELECTOR)
      ? active
      : null;
  }

  function filterSelectForTarget(target) {
    const control = filterControlForTarget(target);
    return control instanceof HTMLSelectElement ? control : null;
  }

  function blurFilterSelectWhenClosed(target) {
    const select = filterSelectForTarget(target);
    if (!(select instanceof HTMLSelectElement)) return;

    window.setTimeout(() => {
      if (!select.isConnected || isSelectOpen(select)) return;
      select.blur();
      window.requestAnimationFrame(() => {
        if (select.isConnected && !isSelectOpen(select) && document.activeElement === select) {
          select.blur();
        }
      });
    }, 0);
  }

  function handleFilterControlEscape(event) {
    if (document.querySelector(".siteDatePicker")) return false;
    const control = filterControlForTarget(event?.target);
    if (!(control instanceof HTMLElement)) return false;

    control.blur();
    return true;
  }

  function beginNeutralFiltersOpen() {
    document.documentElement.classList.add("mflFiltersOpeningNeutral");
    queueMicrotask(clearInitialFilterFocus);
    requestAnimationFrame(clearInitialFilterFocus);
  }

  function endNeutralFiltersOpen(target) {
    if (!document.documentElement.classList.contains("mflFiltersOpeningNeutral")) return;
    const filtersModal = document.getElementById("filtersModal");
    if (!(filtersModal instanceof HTMLElement) || !(target instanceof Node) || !filtersModal.contains(target)) return;
    document.documentElement.classList.remove("mflFiltersOpeningNeutral");
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    endNeutralFiltersOpen(target);

    if (event.isPrimary !== false && event.button === 0) {
      const viewButton = clubViewButtonFromTarget(target);
      clubPointerPressedView = String(viewButton?.dataset.view || "");
      clubPointerCommittedView = "";
    }

    if (target instanceof HTMLSelectElement && isSelectOpen(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      target.blur();
      return;
    }

    const trigger = target.closest('[data-mfl-dropdown-trigger="true"]');
    if (!(trigger instanceof HTMLButtonElement)) return;
    if (!closeStaticDropdown(trigger)) return;

    suppressNextClick.add(trigger);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("pointerup", (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    const viewButton = clubViewButtonFromTarget(event.target);
    const releasedView = String(viewButton?.dataset.view || "");
    clubPointerCommittedView = releasedView && releasedView === clubPointerPressedView ? releasedView : "";
    clubPointerPressedView = "";
    blurFilterSelectWhenClosed(event.target);
  }, true);

  document.addEventListener("pointercancel", () => {
    clubPointerPressedView = "";
    clubPointerCommittedView = "";
  }, true);

  document.addEventListener("change", (event) => {
    blurFilterSelectWhenClosed(event.target);
  });

  document.addEventListener("keydown", (event) => {
    endNeutralFiltersOpen(event.target);
    if (["Enter", "Escape", "Tab"].includes(event.key)) {
      blurFilterSelectWhenClosed(event.target);
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const select = openSelect();
    if (!(select instanceof HTMLSelectElement)) return;

    event.stopImmediatePropagation();
    window.setTimeout(() => {
      if (select.isConnected) select.blur();
    }, 0);
  });

  window.addEventListener("click", (event) => {
    if (!clubPointerCommittedView) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = clubViewButtonFromTarget(target);
    if (!(button instanceof HTMLButtonElement)
      || String(button.dataset.view || "") !== clubPointerCommittedView) {
      clubPointerCommittedView = "";
      return;
    }

    clubPointerCommittedView = "";
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    blurFilterSelectWhenClosed(target);

    if (target.closest("#openFiltersButton")) beginNeutralFiltersOpen();

    const trigger = target.closest('[data-mfl-dropdown-trigger="true"]');
    if (!(trigger instanceof HTMLButtonElement) || !suppressNextClick.has(trigger)) return;

    suppressNextClick.delete(trigger);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.__mflControlInteractionsRuntime?.registerEscapeHandler?.(
    "filter-controls",
    handleFilterControlEscape,
    { priority: 300 },
  );

  enhanceVisible(document);
  syncAttributesViewLabel();

  const labelObserver = new MutationObserver(syncAttributesViewLabel);
  if (document.body) {
    labelObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-page"],
    });
  }

  window.addEventListener("popstate", syncAttributesViewLabel);
  window.addEventListener("mfl:ready", () => {
    enhanceVisible(document);
    syncAttributesViewLabel();
  });

  window.__mflDropdowns = Object.freeze({
    enhanceSelect,
    enhanceVisible,
    syncSelect,
  });
})();