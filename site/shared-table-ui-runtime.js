(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.29");
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const FILTER_ESCAPE_CLASS = "mflEscapeClosingFilters";
  const PAGE_SIZE_ESCAPE_CLASS = "mflPageSizeEscapeSuppressed";
  const POINTER_BLUR_SELECTOR = [
    "#watchlistButton",
    "#openFiltersButton",
    "#quickClearFiltersButton",
    ".quickFilters input",
    "#sidebar .navButton[data-page]",
    "#filtersModal button",
  ].join(", ");
  const ESCAPE_BLUR_SELECTOR = [
    "#pageSizeSelect",
    POINTER_BLUR_SELECTOR,
  ].join(", ");
  const MFL_STATS_FILTERS = Object.freeze([
    ["all", "All"],
    ["90-94", "90-94"],
    ["legendary", "Legendary"],
    ["85-89", "85-89"],
    ["80-84", "80-84"],
    ["rare", "Rare"],
    ["75-79", "75-79"],
    ["70-74", "70-74"],
    ["uncommon", "Uncommon"],
    ["65-69", "65-69"],
    ["60-64", "60-64"],
    ["limited", "Limited"],
    ["55-59", "55-59"],
    ["50-54", "50-54"],
    ["common", "Common"],
  ]);
  const TABLE_VIEW_CONFIG = window.__mflTableViewConfig || Object.freeze({});
  const VIEW_ORDER = Object.freeze(Object.fromEntries(
    Object.entries(TABLE_VIEW_CONFIG).map(([pageName, config]) => [
      pageName,
      Array.isArray(config?.order) ? [...config.order] : [],
    ]),
  ));

  const previous = window.__mflSharedTableUiRuntime;
  previous?.destroy?.();

  let destroyed = false;
  let lastTablePage = "";
  let frame = 0;
  let observer = null;
  let pageSizePointerActive = false;
  let pageSizePointerStartedFocused = false;
  let pointerBlurControl = null;
  let filterEscapeBlurTimer = 0;

  function normalizePageName(value) {
    const page = String(value || "").toLowerCase();
    if (page === "my-players") return "myplayers";
    if (page === "agent") return "agents";
    if (page === "clubs") return "club";
    return page;
  }

  function tablePageFromPath(pathname = window.location.pathname) {
    const parts = String(pathname || "/").split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    if (first === "my-players") return "myplayers";
    if (first === "clubs" || first === "club") return "club";
    if (["database", "mfl", "progression", "watchlist", "agents"].includes(first)) return first;
    return "";
  }

  function currentTablePage() {
    const routePage = tablePageFromPath();
    if (routePage === "agents" || routePage === "club") return routePage;
    const bodyPage = normalizePageName(document.body?.dataset.page);
    if (VIEW_ORDER[bodyPage]) return bodyPage;
    return routePage;
  }

  function keepEntityPresentationPage(pageName) {
    if (!pageName || !document.body || document.body.dataset.page === pageName) return;
    document.body.dataset.page = pageName;
  }

  function defaultQuickFilters(pageName) {
    return {
      hideRetired: true,
      hideRetiring: false,
      hideMflPlayers: pageName === "database",
      mflPackable: pageName === "mfl",
      newMints: false,
    };
  }

  function cachedQuickFilters(pageName) {
    const defaults = defaultQuickFilters(pageName);
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const pageState = saved?.pages?.[pageName];
      return pageState && typeof pageState === "object"
        ? { ...defaults, ...pageState }
        : defaults;
    } catch {
      return defaults;
    }
  }

  function syncQuickFilterLabels(pageName) {
    const hideMflPlayersFilter = document.getElementById("hideMflPlayersFilter");
    const packablePlayersFilter = document.getElementById("packablePlayersFilter");
    if (hideMflPlayersFilter instanceof HTMLElement) {
      hideMflPlayersFilter.hidden = pageName !== "database";
      hideMflPlayersFilter.toggleAttribute("aria-hidden", pageName !== "database");
    }
    if (packablePlayersFilter instanceof HTMLElement) {
      packablePlayersFilter.hidden = pageName !== "mfl";
      packablePlayersFilter.toggleAttribute("aria-hidden", pageName !== "mfl");
    }
  }

  function applyCachedQuickFilters(pageName) {
    if (!VIEW_ORDER[pageName]) return;
    const cached = cachedQuickFilters(pageName);
    const hideRetiredInput = document.getElementById("hideRetiredInput");
    const hideRetiringInput = document.getElementById("hideRetiringInput");
    const hideMflPlayersInput = document.getElementById("hideMflPlayersInput");
    const packablePlayersInput = document.getElementById("packablePlayersInput");
    const newMintsInput = document.getElementById("newMintsInput");

    if (hideRetiredInput instanceof HTMLInputElement) hideRetiredInput.checked = cached.hideRetired !== false;
    if (hideRetiringInput instanceof HTMLInputElement) hideRetiringInput.checked = Boolean(cached.hideRetiring);
    if (hideMflPlayersInput instanceof HTMLInputElement) {
      hideMflPlayersInput.checked = pageName === "database" ? cached.hideMflPlayers !== false : false;
    }
    if (packablePlayersInput instanceof HTMLInputElement) {
      packablePlayersInput.checked = pageName === "mfl" ? cached.mflPackable !== false : false;
    }
    if (newMintsInput instanceof HTMLInputElement) newMintsInput.checked = Boolean(cached.newMints);
  }

  function primeMflStatsOverallFilters() {
    const container = document.getElementById("mflStatsOverallFilters");
    if (!(container instanceof HTMLElement)) return;
    const expectedIds = MFL_STATS_FILTERS.map(([id]) => id);
    const currentButtons = Array.from(container.querySelectorAll(".mflStatsFilterButton"));
    const valid = currentButtons.length === expectedIds.length
      && currentButtons.every((button, index) => String(button.dataset.filter || "") === expectedIds[index]);
    if (valid) {
      container.dataset.staticOverallFilters = "true";
      return;
    }

    const fragment = document.createDocumentFragment();
    MFL_STATS_FILTERS.forEach(([id, label], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mflStatsFilterButton${index === 0 ? " active" : ""}`;
      button.dataset.filter = id;
      button.dataset.mflStatsStatic = "true";
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.textContent = label;
      fragment.appendChild(button);
    });
    container.replaceChildren(fragment);
    container.dataset.staticOverallFilters = "true";
  }

  function syncViewButtons(pageName) {
    const order = VIEW_ORDER[pageName];
    const views = document.querySelector("#progressionPage .views");
    if (!order || !(views instanceof HTMLElement)) return;

    const allowed = new Set(order);
    views.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const shouldHide = !allowed.has(String(button.dataset.view || ""));
      if (button.hidden !== shouldHide) button.hidden = shouldHide;
    });

    const switcher = document.getElementById("watchlistSwitcher");
    order.forEach((viewName) => {
      const button = views.querySelector(`.viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
  }

  function primeTableChrome(pageName) {
    const normalized = normalizePageName(pageName);
    if (!VIEW_ORDER[normalized]) return;
    if (normalized === "agents" || normalized === "club") keepEntityPresentationPage(normalized);
    primeMflStatsOverallFilters();
    syncQuickFilterLabels(normalized);
    applyCachedQuickFilters(normalized);
    syncViewButtons(normalized);
    lastTablePage = normalized;
  }

  function syncTableChrome() {
    frame = 0;
    if (destroyed) return;
    primeMflStatsOverallFilters();
    const pageName = currentTablePage();
    if (!pageName) return;
    if (pageName === "agents" || pageName === "club") keepEntityPresentationPage(pageName);
    syncQuickFilterLabels(pageName);
    syncViewButtons(pageName);
    if (pageName !== lastTablePage) {
      applyCachedQuickFilters(pageName);
      lastTablePage = pageName;
    }
  }

  function scheduleTableChrome() {
    if (destroyed || frame) return;
    frame = requestAnimationFrame(syncTableChrome);
  }

  function installStyles() {
    if (document.getElementById("mflTableChromeRuntimeStyles")) return;
    const style = document.createElement("style");
    style.id = "mflTableChromeRuntimeStyles";
    style.textContent = `
      #mflStatsPage #mflStatsOverallFilters {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 6px !important;
        width: 100% !important;
      }

      #mflStatsPage #mflStatsOverallFilters .mflStatsFilterButton {
        flex: 1 1 0 !important;
        width: auto !important;
        min-width: 0 !important;
        padding-left: 5px !important;
        padding-right: 5px !important;
        white-space: nowrap !important;
      }

      .field.rowsField {
        min-width: 0 !important;
        pointer-events: none !important;
      }

      .field.rowsField > span {
        flex: 0 0 auto !important;
        pointer-events: none !important;
      }

      .field.rowsField > #pageSizeSelect {
        flex: 1 1 0 !important;
        width: 0 !important;
        min-width: 0 !important;
        pointer-events: auto !important;
      }

      #pageSizeSelect:focus:not(:focus-visible):not(:hover) {
        outline: none !important;
        border-color: var(--border-strong) !important;
        background: var(--surface) !important;
        color: var(--text) !important;
        box-shadow: none !important;
      }

      #pageSizeSelect.${PAGE_SIZE_ESCAPE_CLASS},
      #pageSizeSelect.${PAGE_SIZE_ESCAPE_CLASS}:hover,
      #pageSizeSelect.${PAGE_SIZE_ESCAPE_CLASS}:focus,
      #pageSizeSelect.${PAGE_SIZE_ESCAPE_CLASS}:focus-visible {
        outline: none !important;
        border-color: var(--border-strong) !important;
        background: var(--surface) !important;
        color: var(--text) !important;
        box-shadow: none !important;
      }

      html.${FILTER_ESCAPE_CLASS} #openFiltersButton:focus,
      html.${FILTER_ESCAPE_CLASS} #openFiltersButton:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }

      .watchlistButton[aria-expanded="true"]:not(:hover):not(:focus-visible) {
        border-color: var(--border-strong) !important;
        background: var(--surface) !important;
        color: var(--text) !important;
      }

      #openFiltersButton:focus:not(:focus-visible):not(:hover),
      #quickClearFiltersButton:focus:not(:focus-visible):not(:hover),
      .quickFilters input:focus:not(:focus-visible):not(:hover),
      #sidebar .navButton[data-page]:focus:not(:focus-visible):not(:hover) {
        outline: none !important;
        box-shadow: none !important;
      }

      .quickFilters label {
        cursor: default !important;
      }

      .quickFilters input {
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
  }

  function controlFromTarget(target, selector) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(selector);
    return control instanceof HTMLElement ? control : null;
  }

  function pageSizeSelectFromTarget(target) {
    const select = controlFromTarget(target, "#pageSizeSelect");
    return select instanceof HTMLSelectElement ? select : null;
  }

  function releaseControlFocus(control) {
    if (!(control instanceof HTMLElement)) return;
    queueMicrotask(() => {
      if (!destroyed && document.activeElement === control) control.blur();
    });
  }

  function releaseFocusedHighlightControl() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(ESCAPE_BLUR_SELECTOR)) {
      active.blur();
    }
  }

  function pageSizeSelect() {
    const select = document.getElementById("pageSizeSelect");
    return select instanceof HTMLSelectElement ? select : null;
  }

  function clearPageSizeEscapeSuppression() {
    pageSizeSelect()?.classList.remove(PAGE_SIZE_ESCAPE_CLASS);
  }

  function filtersModalOpen() {
    const modal = document.getElementById("filtersModal");
    return modal instanceof HTMLElement && !modal.hidden;
  }

  function finishFilterEscapeFocusRelease() {
    filterEscapeBlurTimer = 0;
    if (destroyed) return;
    const filterButton = document.getElementById("openFiltersButton");
    if (filterButton instanceof HTMLElement && document.activeElement === filterButton) {
      filterButton.blur();
    }
    document.documentElement.classList.remove(FILTER_ESCAPE_CLASS);
  }

  function onPointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const pageSizeSelect = pageSizeSelectFromTarget(target);
    if (pageSizeSelect) {
      clearPageSizeEscapeSuppression();
      pageSizePointerActive = true;
      pageSizePointerStartedFocused = document.activeElement === pageSizeSelect;
    } else {
      pageSizePointerActive = false;
      pageSizePointerStartedFocused = false;
    }
    pointerBlurControl = controlFromTarget(target, POINTER_BLUR_SELECTOR);
    const nav = target.closest("#sidebar .navButton[data-page]");
    if (nav instanceof HTMLElement) {
      const destination = normalizePageName(nav.dataset.page);
      if (VIEW_ORDER[destination]) primeTableChrome(destination);
    }
  }

  function onClick(event) {
    const select = pageSizeSelectFromTarget(event.target);
    if (select instanceof HTMLSelectElement) {
      if (pageSizePointerActive && pageSizePointerStartedFocused) {
        releaseControlFocus(select);
      }
      pageSizePointerStartedFocused = false;
      pointerBlurControl = null;
      return;
    }

    const clickedControl = controlFromTarget(event.target, POINTER_BLUR_SELECTOR);
    if (clickedControl && clickedControl === pointerBlurControl) {
      releaseControlFocus(clickedControl);
    }
    pointerBlurControl = null;
  }

  function onChange(event) {
    const select = pageSizeSelectFromTarget(event.target);
    if (!(select instanceof HTMLSelectElement) || !pageSizePointerActive) return;
    releaseControlFocus(select);
    pageSizePointerActive = false;
    pageSizePointerStartedFocused = false;
  }

  function onKeyDown(event) {
    const select = pageSizeSelect();
    if (event.key !== "Escape") {
      if (select?.classList.contains(PAGE_SIZE_ESCAPE_CLASS)) clearPageSizeEscapeSuppression();
      return;
    }

    const active = document.activeElement;
    const pageSizeEscape = active instanceof HTMLSelectElement && active.id === "pageSizeSelect";
    const closingFiltersWithEscape = filtersModalOpen();

    if (pageSizeEscape) {
      active.classList.add(PAGE_SIZE_ESCAPE_CLASS);
      window.setTimeout(() => {
        if (!destroyed && document.activeElement === active) active.blur();
      }, 0);
    } else {
      queueMicrotask(releaseFocusedHighlightControl);
    }

    if (!closingFiltersWithEscape) return;

    document.documentElement.classList.add(FILTER_ESCAPE_CLASS);
    if (filterEscapeBlurTimer) window.clearTimeout(filterEscapeBlurTimer);
    filterEscapeBlurTimer = window.setTimeout(finishFilterEscapeFocusRelease, 220);
  }

  function onPointerActivity(event) {
    const target = event.target instanceof Element ? event.target : null;
    const select = pageSizeSelect();
    if (select?.classList.contains(PAGE_SIZE_ESCAPE_CLASS) && target !== select) {
      clearPageSizeEscapeSuppression();
    }
  }

  function onPopState() {
    primeMflStatsOverallFilters();
    primeTableChrome(tablePageFromPath());
  }

  function onReady() {
    scheduleTableChrome();
  }

  installStyles();
  primeMflStatsOverallFilters();
  primeTableChrome(currentTablePage());

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerover", onPointerActivity, true);
  document.addEventListener("pointermove", onPointerActivity, true);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("mfl:ready", onReady);

  observer = new MutationObserver(() => {
    scheduleTableChrome();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-initial-page"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-page"],
    });
  }

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (filterEscapeBlurTimer) window.clearTimeout(filterEscapeBlurTimer);
    filterEscapeBlurTimer = 0;
    clearPageSizeEscapeSuppression();
    observer?.disconnect();
    observer = null;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerover", onPointerActivity, true);
    document.removeEventListener("pointermove", onPointerActivity, true);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("mfl:ready", onReady);
    document.documentElement.classList.remove(FILTER_ESCAPE_CLASS);
  }

  window.__mflSharedTableUiRuntime = Object.freeze({
    version: VERSION,
    sync: syncTableChrome,
    prime: primeTableChrome,
    primeMflStatsOverallFilters,
    destroy,
  });
})();