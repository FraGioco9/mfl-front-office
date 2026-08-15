(() => {
  "use strict";

  const enhancedSelects = new WeakSet();
  const suppressNextClick = new WeakSet();
  const VIEW_BUTTON_CLICKED_ATTRIBUTE = "data-mfl-view-clicked";
  const RUNTIME_STYLE_ID = "mflDropdownRuntimeAdjustments";
  let clubClickedView = "";
  let clubClickedFrame = 0;
  let clubPointerPressedView = "";
  let clubPointerCommittedView = "";

  function installRuntimeStyles() {
    if (document.getElementById(RUNTIME_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = RUNTIME_STYLE_ID;
    style.textContent = `
      @supports (appearance: base-select) {
        html body select[data-mfl-dropdown-enhanced="true"]::picker(select),
        html body #pageSizeSelect::picker(select),
        html body .filtersDialog select::picker(select) {
          margin-block: var(--mfl-dropdown-gap);
          margin-inline: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

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

  function clubViewSwitchActive() {
    return document.documentElement.classList.contains("mflDataLoading")
      || Boolean(document.body?.classList.contains("clubViewSwitching"));
  }

  function clubViewButton(viewName = clubClickedView) {
    if (!viewName) return null;
    return Array.from(document.querySelectorAll("#progressionPage .views .viewButton[data-view]"))
      .find((button) => button instanceof HTMLButtonElement && String(button.dataset.view || "") === viewName) || null;
  }

  function syncClubViewSelection(selectedButton) {
    if (!(selectedButton instanceof HTMLButtonElement)) return;
    const selectedView = String(selectedButton.dataset.view || "");
    if (!selectedView) return;
    document.querySelectorAll("#progressionPage .views .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.classList.toggle("active", String(button.dataset.view || "") === selectedView);
    });
  }

  function stopClubViewClickPersistence() {
    clubClickedView = "";
    if (clubClickedFrame) {
      window.cancelAnimationFrame(clubClickedFrame);
      clubClickedFrame = 0;
    }
  }

  function syncClubViewClickPersistence() {
    clubClickedFrame = 0;
    if (!clubClickedView || !clubRouteActive()) {
      stopClubViewClickPersistence();
      return;
    }

    const button = clubViewButton();
    if (button) {
      /* The club loader temporarily reuses Database/Progression state and can
       * replace or restyle these controls. Keep the clicked target as the real
       * active view for the entire handoff. A freshly-replaced button can report
       * :hover=false for a frame, so never release this state while loading. */
      syncClubViewSelection(button);
      button.setAttribute(VIEW_BUTTON_CLICKED_ATTRIBUTE, "true");
      if (!clubViewSwitchActive() && !button.matches(":hover")) {
        button.removeAttribute(VIEW_BUTTON_CLICKED_ATTRIBUTE);
        stopClubViewClickPersistence();
        return;
      }
    }

    clubClickedFrame = window.requestAnimationFrame(syncClubViewClickPersistence);
  }

  function persistClubViewClick(button) {
    if (!(button instanceof HTMLButtonElement) || !clubRouteActive()) return;
    clubClickedView = String(button.dataset.view || "");
    if (!clubClickedView) return;
    syncClubViewSelection(button);
    button.setAttribute(VIEW_BUTTON_CLICKED_ATTRIBUTE, "true");
    if (clubClickedFrame) window.cancelAnimationFrame(clubClickedFrame);
    clubClickedFrame = window.requestAnimationFrame(syncClubViewClickPersistence);
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

  /* A second click directly on an open select closes it and removes focus.
   * Option pointer/click events are deliberately left untouched so selections
   * inside customizable pickers continue to work normally. */
  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    endNeutralFiltersOpen(target);

    if (event.isPrimary !== false && event.button === 0) {
      const viewButton = clubViewButtonFromTarget(target);
      if (viewButton) {
        clubPointerPressedView = String(viewButton.dataset.view || "");
        clubPointerCommittedView = "";
        persistClubViewClick(viewButton);
      } else {
        clubPointerPressedView = "";
        clubPointerCommittedView = "";
      }
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
  }, true);

  document.addEventListener("pointercancel", () => {
    clubPointerPressedView = "";
    clubPointerCommittedView = "";
  }, true);

  document.addEventListener("keydown", (event) => {
    endNeutralFiltersOpen(event.target);
  }, true);

  /* Enter confirms the highlighted value of any open select, including inside
   * a popup. The select keeps its native default Enter behavior, then loses focus
   * after that default action has committed the value. */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const select = openSelect();
    if (!(select instanceof HTMLSelectElement)) return;

    event.stopImmediatePropagation();
    window.setTimeout(() => {
      if (select.isConnected) select.blur();
    }, 0);
  });

  /* The shared view-button path already commits a mouse gesture on pointerup.
   * app-core still has an older document capture click handler for club views;
   * suppress only the follow-up click from that same pointer gesture so it cannot
   * re-run club state and briefly restore the previous selected view. Keyboard
   * clicks are untouched because they have no committed pointer gesture here. */
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const clubViewButton = clubViewButtonFromTarget(target);
    if (clubViewButton && clubPointerCommittedView
      && String(clubViewButton.dataset.view || "") === clubPointerCommittedView) {
      clubPointerCommittedView = "";
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    clubPointerCommittedView = "";

    if (target.closest("#openFiltersButton")) beginNeutralFiltersOpen();

    const trigger = target.closest('[data-mfl-dropdown-trigger="true"]');
    if (!(trigger instanceof HTMLButtonElement) || !suppressNextClick.has(trigger)) return;

    suppressNextClick.delete(trigger);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  installRuntimeStyles();
  enhanceVisible(document);
  window.addEventListener("mfl:ready", () => enhanceVisible(document));

  window.__mflDropdowns = Object.freeze({
    enhanceSelect,
    enhanceVisible,
    syncSelect,
  });
})();