(() => {
  "use strict";

  const RESET_WINDOW_MS = 1000;
  const STYLE_ID = "mflSelectionStartupResetStyles";
  const PENDING_CLASS = "mflSelectionStartupResetPending";
  const ENTITY_VIEWS = Object.freeze({
    agents: Object.freeze(["attributes", "contracts", "next", "current", "all"]),
    club: Object.freeze(["attributes", "contracts", "current", "all"]),
  });
  const ENTITY_LABELS = Object.freeze({
    agents: Object.freeze({
      attributes: "Attributes",
      contracts: "Contracts",
      next: "Next Overall",
      current: "Current Season",
      all: "All Time",
    }),
    club: Object.freeze({
      attributes: "Squad",
      contracts: "Contracts",
      current: "Current Season",
      all: "All Time",
    }),
  });
  const ENTITY_VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    squad: "attributes",
    contracts: "contracts",
    "next-overall": "next",
    "current-season": "current",
    "all-time": "all",
  });

  window.__mflSelectionStartupResetRuntime?.destroy?.();

  let resetTimer = 0;
  let resetObserver = null;
  let destroyed = false;
  const startedAt = Date.now();

  function applicationState() {
    try {
      return typeof state === "object" && state ? state : null;
    } catch {
      return null;
    }
  }

  function clearSelectionFromPageStates(appState) {
    const pageStates = appState?.tablePageStates;
    if (!pageStates || typeof pageStates !== "object" || Array.isArray(pageStates)) return false;

    let changed = false;
    Object.values(pageStates).forEach((pageState) => {
      if (!pageState || typeof pageState !== "object" || Array.isArray(pageState)) return;
      if (Array.isArray(pageState.selectedPlayerIds) && pageState.selectedPlayerIds.length) changed = true;
      if (pageState.selectionAnchorPlayerId != null) changed = true;
      pageState.selectedPlayerIds = [];
      pageState.selectionAnchorPlayerId = null;
    });
    return changed;
  }

  function clearCurrentSelection() {
    const appState = applicationState();
    if (!appState || !(appState.selectedPlayerIds instanceof Set)) return false;

    let changed = appState.selectedPlayerIds.size > 0 || appState.selectionAnchorPlayerId != null;
    appState.selectedPlayerIds.clear();
    appState.selectionAnchorPlayerId = null;
    changed = clearSelectionFromPageStates(appState) || changed;

    const bar = document.getElementById("selectionBar");
    if (bar instanceof HTMLElement) {
      bar.classList.remove("visible", "mflSelectionActionDismissed");
      bar.hidden = true;
    }

    if (!changed) return true;

    try {
      if (typeof updateSelectionBar === "function") updateSelectionBar();
    } catch {
      // Selection is already cleared in application state.
    }

    try {
      if (appState.dataLoaded && typeof renderTable === "function") renderTable();
    } catch {
      // The normal render cycle will reflect the cleared selection.
    }

    try {
      if (typeof saveTableState === "function") saveTableState();
    } catch {
      // The current page still starts with an empty selection.
    }

    return true;
  }

  function finishResetWindow() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = 0;
    resetObserver?.disconnect();
    resetObserver = null;
    clearCurrentSelection();
    document.documentElement.classList.remove(PENDING_CLASS);
    document.getElementById(STYLE_ID)?.remove();
  }

  function runResetPass() {
    if (destroyed) return;
    clearCurrentSelection();
    if (Date.now() - startedAt >= RESET_WINDOW_MS) finishResetWindow();
  }

  function ensurePendingStyle() {
    document.documentElement.classList.add(PENDING_CLASS);
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head?.appendChild(style);
    }
    if (style) {
      style.textContent = `
        html.${PENDING_CLASS} #selectionBar {
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
    }
  }

  function entityRoute() {
    const path = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
    const agentMatch = path.match(/^\/agents\/[^/]+(?:\/([^/]+))?$/i);
    if (agentMatch) {
      const slug = String(agentMatch[1] || "attributes").toLowerCase();
      const view = ENTITY_VIEW_BY_SLUG[slug] || "attributes";
      return ENTITY_VIEWS.agents.includes(view) ? { page: "agents", view } : { page: "agents", view: "attributes" };
    }

    const clubMatch = path.match(/^\/(?:clubs|club)\/[^/]+(?:\/([^/]+))?$/i);
    if (clubMatch) {
      const slug = String(clubMatch[1] || "squad").toLowerCase();
      const view = ENTITY_VIEW_BY_SLUG[slug] || "attributes";
      return ENTITY_VIEWS.club.includes(view) ? { page: "club", view } : { page: "club", view: "attributes" };
    }

    return null;
  }

  function syncEntityViewButtons() {
    const route = entityRoute();
    if (!route) return;

    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement)) return;
    const order = ENTITY_VIEWS[route.page];
    const labels = ENTITY_LABELS[route.page];
    const allowed = new Set(order);
    const switcher = document.getElementById("watchlistSwitcher");

    views.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const view = String(button.dataset.view || "");
      const visible = allowed.has(view);
      button.hidden = !visible;
      if (visible) {
        button.dataset.page = route.page;
        const label = labels[view];
        if (label && button.textContent !== label) button.textContent = label;
      }
      const active = visible && view === route.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    order.forEach((viewName) => {
      const button = views.querySelector(`:scope > .viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
    if (switcher instanceof HTMLElement) switcher.hidden = true;
  }

  function installEntityViewOwnership() {
    try {
      if (typeof updateViewButtons !== "function") {
        syncEntityViewButtons();
        return false;
      }

      if (!updateViewButtons.__mflEntityViewOwnership) {
        const originalUpdateViewButtons = updateViewButtons;
        const updateViewButtonsWithEntityOwnership = function() {
          const result = originalUpdateViewButtons.apply(this, arguments);
          syncEntityViewButtons();
          return result;
        };
        Object.defineProperty(updateViewButtonsWithEntityOwnership, "__mflEntityViewOwnership", { value: true });
        updateViewButtons = updateViewButtonsWithEntityOwnership;
      }

      syncEntityViewButtons();
      return true;
    } catch {
      syncEntityViewButtons();
      return false;
    }
  }

  function rebind() {
    if (destroyed) return;
    runResetPass();
    installEntityViewOwnership();
  }

  ensurePendingStyle();
  resetObserver = new MutationObserver(runResetPass);
  resetObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "data-page", "data-mfl-ready"],
  });
  resetTimer = window.setTimeout(finishResetWindow, RESET_WINDOW_MS);
  installEntityViewOwnership();
  runResetPass();

  function syncEntityAfterReady() {
    if (destroyed) return;
    installEntityViewOwnership();
    requestAnimationFrame(syncEntityViewButtons);
  }

  window.addEventListener("mfl:ready", syncEntityAfterReady);
  window.addEventListener("pageshow", syncEntityAfterReady);
  window.addEventListener("popstate", syncEntityAfterReady);

  function destroy() {
    destroyed = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetObserver?.disconnect();
    window.removeEventListener("mfl:ready", syncEntityAfterReady);
    window.removeEventListener("pageshow", syncEntityAfterReady);
    window.removeEventListener("popstate", syncEntityAfterReady);
    document.documentElement.classList.remove(PENDING_CLASS);
    document.getElementById(STYLE_ID)?.remove();
  }

  window.__mflSelectionStartupResetRuntime = Object.freeze({
    rebind,
    destroy,
    syncEntityViews: syncEntityViewButtons,
  });
})();
