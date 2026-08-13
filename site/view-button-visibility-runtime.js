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
  const previous = window.__mflViewButtonVisibilityRuntime;
  previous?.destroy?.();

  let pointerHoverButton = null;
  let initialActiveObserver = null;
  let databaseVisibilityObserver = null;

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

    #progressionPage .viewButton.active:is(:hover, [${POINTER_HOVER_ATTRIBUTE}="true"]):not(:disabled) {
      border-color: var(--primary) !important;
      background: var(--primary) !important;
      color: #ffffff !important;
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
    // Inline important paint is intentional here: Watchlist has accumulated
    // several route/runtime style owners. The pointer owner must win without
    // adding another selector-specificity race.
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

  function onPointerDown(event) {
    const target = event.target instanceof Element
      ? event.target.closest("#progressionPage .views .viewButton")
      : null;
    if (target instanceof HTMLButtonElement) clearPointerHover(target);
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
  document.addEventListener("pointerover", syncPointerHover, true);
  document.addEventListener("pointermove", syncPointerHover, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerout", onPointerOut, true);
  window.addEventListener("blur", onWindowBlur);

  function destroy() {
    databaseVisibilityObserver?.disconnect();
    databaseVisibilityObserver = null;
    initialActiveObserver?.disconnect();
    initialActiveObserver = null;
    document.removeEventListener("pointerover", syncPointerHover, true);
    document.removeEventListener("pointermove", syncPointerHover, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
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
