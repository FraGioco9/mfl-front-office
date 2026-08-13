(() => {
  "use strict";

  const POINTER_HOVER_ATTRIBUTE = "data-mfl-view-button-pointer-hover";
  const WATCHLIST_PATH = /^\/watchlist(?:\/|$)/i;
  const DATABASE_VIEWS = new Set(["attributes", "contracts", "stats"]);
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
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
  const DATABASE_STATS_FILTERS = Object.freeze([
    ["all", "All"],
    ["ultimate", "Ultimate"],
    ["legendary", "Legendary"],
    ["rare", "Rare"],
    ["uncommon", "Uncommon"],
    ["limited", "Limited"],
    ["common", "Common"],
    ["custom", "Custom"],
  ]);
  const previous = window.__mflViewButtonVisibilityRuntime;
  previous?.destroy?.();

  let pointerHoverButton = null;
  let initialActiveObserver = null;
  let databaseVisibilityObserver = null;
  let statsHistogramObserver = null;
  let pendingStatsTableNavigation = null;
  let pendingStatsTableTimer = 0;

  const style = document.createElement("style");
  style.id = "mflViewButtonVisibilityGuard";
  style.textContent = `
    #progressionPage .viewButton[hidden] {
      display: none;
    }

    #progressionPage .viewButton {
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease !important;
    }

    #progressionPage .viewButton:not(.active):is(:hover, [${POINTER_HOVER_ATTRIBUTE}="true"]):not(:disabled) {
      border-color: var(--primary-hover) !important;
      background: var(--row-hover) !important;
      color: var(--text) !important;
    }

    main .views .viewButton.active:is(:hover, :focus, :focus-visible, [${POINTER_HOVER_ATTRIBUTE}="true"]):not(:disabled) {
      outline: none !important;
      border-color: var(--primary) !important;
      background: var(--primary) !important;
      color: #ffffff !important;
      box-shadow: none !important;
      transition: none !important;
    }

    html #mflStatsPage .mflStatsHistogramBar[data-tooltip]::before {
      content: attr(data-tooltip) !important;
      display: block !important;
    }

    #mflStatsHistogramTooltipPortal {
      display: none !important;
    }

    html #mflStatsPage .mflStatsHistogram[data-mfl-column-transition="true"] .mflStatsHistogramBar::after,
    html #databaseStatsPage .mflStatsHistogram[data-mfl-column-transition="true"] .mflStatsHistogramBar::after {
      animation: mflStatsBarRise 220ms ease-out !important;
    }

    body[data-page="database"] #progressionPage .viewButton:is(
      [data-view="next"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="mfl"] #progressionPage .viewButton:is(
      [data-view="next"],
      [data-view="contracts"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="mflstats"] #progressionPage .viewButton:is(
      [data-view="next"],
      [data-view="contracts"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="progression"] #progressionPage .viewButton:is(
      [data-view="attributes"],
      [data-view="stats"],
      [data-view="next"],
      [data-view="contracts"]
    ),
    body[data-page="agents"] #progressionPage .viewButton:is(
      [data-view="stats"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="watchlist"] #progressionPage .viewButton[data-view="stats"],
    body[data-page="myplayers"] #progressionPage .viewButton[data-view="stats"],
    body[data-page="club"] #progressionPage .viewButton:is(
      [data-view="stats"],
      [data-view="next"]
    ),
    html[data-stored-progression-access="false"] body[data-page="watchlist"] #progressionPage .viewButton:is(
      [data-view="current"],
      [data-view="all"]
    ) {
      display: none;
    }
  `;
  document.head.appendChild(style);

  function primeStatsFilterBar(containerId, filters) {
    const container = document.getElementById(containerId);
    if (!(container instanceof HTMLElement)) return;
    const current = Array.from(container.querySelectorAll(".mflStatsFilterButton"));
    const valid = current.length === filters.length
      && current.every((button, index) => String(button.dataset.filter || "") === filters[index][0]);
    if (!valid) {
      const fragment = document.createDocumentFragment();
      filters.forEach(([id, label], index) => {
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
    }
    container.dataset.staticOverallFilters = "true";
  }

  function primeStatsFilterBars() {
    primeStatsFilterBar("mflStatsOverallFilters", MFL_STATS_FILTERS);
    primeStatsFilterBar("databaseStatsOverallFilters", DATABASE_STATS_FILTERS);
  }

  function syncTablePageQuickFilterVisibility() {
    const pageName = String(document.body?.dataset.page || "").toLowerCase();
    const hideMflPlayersFilter = document.getElementById("hideMflPlayersFilter");
    const packablePlayersFilter = document.getElementById("packablePlayersFilter");
    const newMintsLabel = document.getElementById("newMintsLabel");

    if (hideMflPlayersFilter instanceof HTMLElement) {
      hideMflPlayersFilter.hidden = pageName !== "database";
    }
    if (packablePlayersFilter instanceof HTMLElement) {
      packablePlayersFilter.hidden = pageName !== "mfl";
    }
    if (newMintsLabel instanceof HTMLElement) {
      const label = pageName === "mfl" ? "Only aged players" : "Only new mints";
      if (newMintsLabel.textContent !== label) newMintsLabel.textContent = label;
    }
  }

  function syncDatabaseViewButtons() {
    if (document.body?.dataset.page !== "database") return;
    document.querySelectorAll("#progressionPage .views .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const shouldHide = !DATABASE_VIEWS.has(String(button.dataset.view || ""));
      if (button.hidden !== shouldHide) button.hidden = shouldHide;
    });
  }

  function syncTableRouteChrome() {
    primeStatsFilterBars();
    syncTablePageQuickFilterVisibility();
    syncDatabaseViewButtons();
  }

  function installDatabaseViewGuard() {
    syncTableRouteChrome();
    databaseVisibilityObserver = new MutationObserver(syncTableRouteChrome);
    if (document.body) {
      databaseVisibilityObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-page"],
      });
    }
    const views = document.querySelector("#progressionPage .views");
    if (views instanceof HTMLElement) {
      databaseVisibilityObserver.observe(views, {
        attributes: true,
        subtree: true,
        attributeFilter: ["hidden"],
      });
    }
  }

  function initialWatchlistView() {
    if (document.documentElement.dataset.mflReady === "true" || !WATCHLIST_PATH.test(window.location.pathname)) return "";
    const parts = String(window.location.pathname || "").split("/").filter(Boolean);
    const slug = String(parts.at(-1) || "").toLowerCase();
    return VIEW_BY_SLUG[slug] || "current";
  }

  function syncInitialWatchlistActiveView() {
    const view = initialWatchlistView();
    if (!view) {
      initialActiveObserver?.disconnect();
      initialActiveObserver = null;
      return;
    }

    document.querySelectorAll("#progressionPage .views .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const active = String(button.dataset.view || "") === view;
      if (button.classList.contains("active") !== active) button.classList.toggle("active", active);
      if (button.getAttribute("aria-pressed") !== String(active)) button.setAttribute("aria-pressed", String(active));
    });
  }

  function installInitialWatchlistActiveGuard() {
    if (!initialWatchlistView()) return;
    syncInitialWatchlistActiveView();
    initialActiveObserver = new MutationObserver(syncInitialWatchlistActiveView);
    initialActiveObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mfl-ready"],
    });
    const views = document.querySelector("#progressionPage .views");
    if (views instanceof HTMLElement) {
      initialActiveObserver.observe(views, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "aria-pressed"],
      });
    }
  }

  function animateStatsHistogram(histogram) {
    if (!(histogram instanceof HTMLElement)) return;
    if (!histogram.closest("#mflStatsPage, #databaseStatsPage")) return;
    histogram.removeAttribute("data-mfl-column-transition");
    void histogram.offsetWidth;
    histogram.setAttribute("data-mfl-column-transition", "true");
    window.setTimeout(() => {
      if (histogram.isConnected) histogram.removeAttribute("data-mfl-column-transition");
    }, 260);
  }

  function animateStatsHistogramsFromNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(".mflStatsHistogram")) animateStatsHistogram(node);
    node.querySelectorAll?.(".mflStatsHistogram").forEach(animateStatsHistogram);
  }

  function installStatsHistogramTransitions() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return;
    statsHistogramObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach(animateStatsHistogramsFromNode);
      });
    });
    statsHistogramObserver.observe(main, { childList: true, subtree: true });
    document.querySelectorAll("#mflStatsPage .mflStatsHistogram, #databaseStatsPage .mflStatsHistogram")
      .forEach(animateStatsHistogram);
  }

  function clearPointerHover(button = pointerHoverButton) {
    if (!(button instanceof HTMLButtonElement)) {
      if (button === pointerHoverButton) pointerHoverButton = null;
      return;
    }

    button.removeAttribute(POINTER_HOVER_ATTRIBUTE);
    if (button.dataset.mflPointerHoverPaint === "true") {
      button.style.removeProperty("border-color");
      button.style.removeProperty("background");
      button.style.removeProperty("color");
      delete button.dataset.mflPointerHoverPaint;
    }
    if (button === pointerHoverButton) pointerHoverButton = null;
  }

  function applyPointerHover(button) {
    const root = document.documentElement;
    const unavailable = !(button instanceof HTMLButtonElement)
      || button.disabled
      || button.hidden
      || button.classList.contains("active")
      || root.classList.contains("mflInteractionBusy");

    if (unavailable) {
      clearPointerHover();
      return;
    }

    if (pointerHoverButton && pointerHoverButton !== button) clearPointerHover(pointerHoverButton);
    if (pointerHoverButton === button && button.getAttribute(POINTER_HOVER_ATTRIBUTE) === "true") return;

    pointerHoverButton = button;
    button.setAttribute(POINTER_HOVER_ATTRIBUTE, "true");
    button.dataset.mflPointerHoverPaint = "true";
    button.style.setProperty("border-color", "var(--primary-hover)", "important");
    button.style.setProperty("background", "var(--row-hover)", "important");
    button.style.setProperty("color", "var(--text)", "important");
  }

  function viewButtonAtPoint(clientX, clientY) {
    if (typeof document.elementFromPoint !== "function") return null;
    const target = document.elementFromPoint(clientX, clientY);
    const button = target instanceof Element ? target.closest("#progressionPage .views .viewButton") : null;
    return button instanceof HTMLButtonElement ? button : null;
  }

  function syncPointerHover(event) {
    if (event.pointerType === "touch") {
      clearPointerHover();
      return;
    }
    applyPointerHover(viewButtonAtPoint(event.clientX, event.clientY));
  }

  function activateViewButtonImmediately(button) {
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
    const views = button.closest(".views");
    if (!(views instanceof HTMLElement)) return;
    views.querySelectorAll(".viewButton[data-view]").forEach((candidate) => {
      if (!(candidate instanceof HTMLButtonElement)) return;
      const active = candidate === button;
      if (candidate.classList.contains("active") !== active) candidate.classList.toggle("active", active);
      if (candidate.getAttribute("aria-pressed") !== String(active)) {
        candidate.setAttribute("aria-pressed", String(active));
      }
      if (active) clearPointerHover(candidate);
    });
  }

  function activateSharedTableView(pageName, viewName) {
    const progressionPage = document.getElementById("progressionPage");
    if (progressionPage instanceof HTMLElement) {
      document.querySelectorAll("main > .pageView").forEach((candidate) => {
        if (!(candidate instanceof HTMLElement)) return;
        candidate.hidden = candidate !== progressionPage;
      });
      progressionPage.hidden = false;
    }
    document.documentElement.classList.remove("mflStatsFirstPaintGuard");
    if (document.body?.dataset.page !== pageName) document.body.dataset.page = pageName;
    document.querySelectorAll("#progressionPage .views .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const active = String(button.dataset.view || "") === viewName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      if (pageName === "database" || pageName === "mfl") button.dataset.page = pageName;
    });
    const loading = /** @type {any} */ (window).__mflTableLoadingRuntime;
    loading?.primeHeader?.(pageName, viewName);
    loading?.show?.();
  }

  function statsTableDestination(target) {
    if (!(target instanceof Element)) return null;
    const button = target.closest("#mflStatsPage .views .viewButton[data-view], #databaseStatsPage .views .viewButton[data-view]");
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return null;
    const view = String(button.dataset.view || "");
    if (!view || view === "stats") return null;
    const pageName = button.closest("#mflStatsPage") ? "mfl" : button.closest("#databaseStatsPage") ? "database" : "";
    if (!pageName) return null;
    if (pageName === "mfl" && view !== "attributes") return null;
    if (pageName === "database" && !["attributes", "contracts"].includes(view)) return null;
    return { button, pageName, view };
  }

  function clearPendingStatsTableNavigation() {
    if (pendingStatsTableTimer) window.clearTimeout(pendingStatsTableTimer);
    pendingStatsTableTimer = 0;
    pendingStatsTableNavigation = null;
  }

  function openStatsTableImmediately(destination) {
    if (!destination || typeof setPage !== "function") return false;
    clearPointerHover(destination.button);
    activateViewButtonImmediately(destination.button);
    pendingStatsTableNavigation = destination;
    if (pendingStatsTableTimer) window.clearTimeout(pendingStatsTableTimer);
    pendingStatsTableTimer = window.setTimeout(clearPendingStatsTableNavigation, 600);
    void setPage(destination.pageName, true, {
      view: destination.view,
      skipNavigationLoading: false,
    });
    activateSharedTableView(destination.pageName, destination.view);
    return true;
  }

  function databaseStatsSourceButton(target) {
    if (!(target instanceof Element) || document.body?.dataset.page !== "database") return null;
    const button = target.closest('#progressionPage .views .viewButton[data-view="stats"]');
    return button instanceof HTMLButtonElement ? button : null;
  }

  function openDatabaseStatsImmediately(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    activateViewButtonImmediately(button);
    const runtime = /** @type {any} */ (window).__mflDatabaseStatsStateRuntime;
    if (typeof runtime?.render === "function") {
      void runtime.render(true);
      return true;
    }
    const render = /** @type {any} */ (window).renderDatabaseStatsPage;
    if (typeof render === "function") {
      void render(true);
      return true;
    }
    return false;
  }

  function onPointerDown(event) {
    const statsDestination = statsTableDestination(event.target);
    if (statsDestination && openStatsTableImmediately(statsDestination)) return;

    const target = event.target instanceof Element
      ? event.target.closest("main .views .viewButton[data-view]")
      : null;
    if (!(target instanceof HTMLButtonElement)) return;
    clearPointerHover(target);
    activateViewButtonImmediately(target);
  }

  function onClick(event) {
    const statsDestination = statsTableDestination(event.target);
    if (statsDestination) {
      const pending = pendingStatsTableNavigation;
      const alreadyOpened = pending
        && pending.button === statsDestination.button
        && pending.pageName === statsDestination.pageName
        && pending.view === statsDestination.view;
      if (alreadyOpened || openStatsTableImmediately(statsDestination)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearPendingStatsTableNavigation();
        return;
      }
    }

    const button = databaseStatsSourceButton(event.target);
    if (!button) return;
    if (!openDatabaseStatsImmediately(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onPointerOut(event) {
    if (!pointerHoverButton) return;
    if (event.relatedTarget == null) clearPointerHover();
  }

  function onWindowBlur() {
    clearPointerHover();
  }

  installDatabaseViewGuard();
  installInitialWatchlistActiveGuard();
  installStatsHistogramTransitions();
  document.addEventListener("pointerover", syncPointerHover, true);
  document.addEventListener("pointermove", syncPointerHover, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerout", onPointerOut, true);
  window.addEventListener("blur", onWindowBlur);

  function destroy() {
    databaseVisibilityObserver?.disconnect();
    databaseVisibilityObserver = null;
    initialActiveObserver?.disconnect();
    initialActiveObserver = null;
    statsHistogramObserver?.disconnect();
    statsHistogramObserver = null;
    clearPendingStatsTableNavigation();
    document.removeEventListener("pointerover", syncPointerHover, true);
    document.removeEventListener("pointermove", syncPointerHover, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    window.removeEventListener("blur", onWindowBlur);
    document.querySelectorAll(`#progressionPage .viewButton[${POINTER_HOVER_ATTRIBUTE}="true"]`).forEach((button) => {
      clearPointerHover(button);
    });
    clearPointerHover();
    style.remove();
  }

  window.__mflViewButtonVisibilityRuntime = Object.freeze({ destroy });
})();
