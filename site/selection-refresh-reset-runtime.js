(() => {
  const VERSION = "1.120.25";
  const RESET_WINDOW_MS = 1000;

  const existing = window.__mflSelectionRefreshResetRuntime;
  if (existing?.version === VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  let resetTimer = 0;
  let footerTimer = 0;
  let destroyed = false;
  const startedAt = Date.now();

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;

    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }

    const text = `MFL Front Office v${VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.href = "/changelog";
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
  }

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
      // Selection is still cleared in application state.
    }

    try {
      if (appState.dataLoaded && typeof renderTable === "function") renderTable();
    } catch {
      // The normal render cycle will reflect the cleared selection.
    }

    try {
      if (typeof saveTableState === "function") saveTableState();
    } catch {
      // Refresh behavior remains correct for this page load.
    }

    return true;
  }

  function finishResetWindow() {
    if (resetTimer) clearInterval(resetTimer);
    resetTimer = 0;
    clearCurrentSelection();
    document.documentElement.classList.remove("mflSelectionRefreshResetPending");
    document.getElementById("mflSelectionRefreshResetStyles")?.remove();
  }

  function runResetPass() {
    if (destroyed) return;
    syncFooter();
    clearCurrentSelection();
    if (Date.now() - startedAt >= RESET_WINDOW_MS) finishResetWindow();
  }

  function ensurePendingStyle() {
    document.documentElement.classList.add("mflSelectionRefreshResetPending");
    let style = document.getElementById("mflSelectionRefreshResetStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflSelectionRefreshResetStyles";
      document.head?.appendChild(style);
    }
    if (style) {
      style.textContent = `
        html.mflSelectionRefreshResetPending #selectionBar {
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
    }
  }

  function rebind() {
    if (destroyed) return;
    syncFooter();
    runResetPass();
  }

  ensurePendingStyle();
  resetTimer = window.setInterval(runResetPass, 50);
  footerTimer = window.setInterval(syncFooter, 500);
  runResetPass();

  function destroy() {
    destroyed = true;
    if (resetTimer) clearInterval(resetTimer);
    if (footerTimer) clearInterval(footerTimer);
    document.documentElement.classList.remove("mflSelectionRefreshResetPending");
    document.getElementById("mflSelectionRefreshResetStyles")?.remove();
  }

  window.__mflSelectionRefreshResetRuntime = {
    version: VERSION,
    rebind,
    destroy,
  };
})();
