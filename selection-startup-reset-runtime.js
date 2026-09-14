(() => {
  "use strict";

  const PENDING_CLASS = "mflSelectionStartupResetPending";
  const READY_EVENT = "mfl:route-ready";

  window.__mflSelectionStartupResetRuntime?.destroy?.();
  window.__mflSelectionStartupResetActive = true;

  let destroyed = false;
  let bridgeInstalled = false;

  function applicationState() {
    try {
      return typeof state === "object" && state ? state : null;
    } catch {
      return null;
    }
  }

  function clearSelectionFromPageStates(appState) {
    const pageStates = appState?.tablePageStates;
    if (!pageStates || typeof pageStates !== "object" || Array.isArray(pageStates)) return;
    Object.values(pageStates).forEach((pageState) => {
      if (!pageState || typeof pageState !== "object" || Array.isArray(pageState)) return;
      pageState.selectedPlayerIds = [];
      pageState.selectionAnchorPlayerId = null;
    });
  }

  function clearRenderedSelectionControls() {
    document.querySelectorAll('#tableBody .selectionCell input[type="checkbox"], #selectVisiblePlayersInput').forEach((control) => {
      if (!(control instanceof HTMLInputElement)) return;
      control.checked = false;
      control.indeterminate = false;
    });
  }

  function clearCurrentSelection() {
    const appState = applicationState();
    if (!appState) return false;
    if (appState.selectedPlayerIds instanceof Set) appState.selectedPlayerIds.clear();
    appState.selectionAnchorPlayerId = null;
    clearSelectionFromPageStates(appState);
    clearRenderedSelectionControls();

    const bar = document.getElementById("selectionBar");
    if (bar instanceof HTMLElement) {
      bar.classList.remove("visible", "mflSelectionActionDismissed");
    }
    try {
      if (typeof updateSelectionBar === "function") updateSelectionBar();
    } catch {}
    return true;
  }

  function installRestoreBridge() {
    if (destroyed || bridgeInstalled) return bridgeInstalled;
    try {
      bridgeInstalled = Boolean(window.eval(`(() => {
        if (typeof restoreSavedTableState !== "function") return false;
        if (restoreSavedTableState.__mflStartupSelectionReset) return true;
        const originalRestoreSavedTableState = restoreSavedTableState;
        const restoreWithoutStartupSelection = function() {
          const result = originalRestoreSavedTableState.apply(this, arguments);
          if (window.__mflSelectionStartupResetActive && typeof state === "object" && state) {
            if (state.selectedPlayerIds instanceof Set) state.selectedPlayerIds.clear();
            state.selectionAnchorPlayerId = null;
            const pages = state.tablePageStates;
            if (pages && typeof pages === "object" && !Array.isArray(pages)) {
              Object.values(pages).forEach((pageState) => {
                if (!pageState || typeof pageState !== "object" || Array.isArray(pageState)) return;
                pageState.selectedPlayerIds = [];
                pageState.selectionAnchorPlayerId = null;
              });
            }
          }
          return result;
        };
        Object.defineProperty(restoreWithoutStartupSelection, "__mflStartupSelectionReset", { value: true });
        restoreSavedTableState = restoreWithoutStartupSelection;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install startup selection reset.", error);
      bridgeInstalled = false;
    }
    return bridgeInstalled;
  }

  function markPending() {
    document.documentElement.classList.add(PENDING_CLASS);
  }

  function finish() {
    if (destroyed) return;
    window.__mflSelectionStartupResetActive = false;
    document.documentElement.classList.remove(PENDING_CLASS);
  }

  function rebind() {
    installRestoreBridge();
    clearCurrentSelection();
  }

  markPending();
  installRestoreBridge();
  clearCurrentSelection();
  window.addEventListener(READY_EVENT, finish, { once: true });
  if (document.documentElement.dataset.mflRouteReady === "true") finish();

  function destroy() {
    destroyed = true;
    window.__mflSelectionStartupResetActive = false;
    window.removeEventListener(READY_EVENT, finish);
    document.documentElement.classList.remove(PENDING_CLASS);
  }

  window.__mflSelectionStartupResetRuntime = Object.freeze({ rebind, destroy });
})();
