(() => {
  "use strict";

  const RESET_WINDOW_MS = 1000;
  const STYLE_ID = "mflSelectionStartupResetStyles";
  const PENDING_CLASS = "mflSelectionStartupResetPending";

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

  function rebind() {
    if (!destroyed) runResetPass();
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
  runResetPass();

  function destroy() {
    destroyed = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetObserver?.disconnect();
    document.documentElement.classList.remove(PENDING_CLASS);
    document.getElementById(STYLE_ID)?.remove();
  }

  window.__mflSelectionStartupResetRuntime = Object.freeze({
    rebind,
    destroy,
  });
})();