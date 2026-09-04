(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const GAP = 12;
  const EXIT_MS = window.__mflControlInteractionsRuntime?.motionDurationMs?.("--mfl-motion-slow", 220) ?? 220;
  const TOAST_ANCHOR_MS = 15000;
  const TABLE_PAGE_NAMES = new Set(["database", "mfl", "progression", "agents", "watchlist", "myplayers", "club"]);
  const NAVIGATION_STATE_CONTROL_IDS = [
    "hideRetiredInput",
    "hideRetiringInput",
    "hideMflPlayersInput",
    "packablePlayersInput",
    "newMintsInput",
    "pageSizeSelect",
  ];

  window.__mflSelectionStackRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  let exitTimer = 0;
  let toastAnchorTimer = 0;
  let destroyed = false;
  let fallbackClearing = false;
  let actionSequence = 0;
  let lastSelectionTop = null;
  let toastAnchorUntil = 0;
  let awaitingSelectionReset = false;
  let frozenSelectionLabel = "";
  let lastKnownSelectionCount = 0;
  let navigationSourceControlSnapshot = null;
  let unregisterEscapeHandler = null;

  function selectionBar() {
    const bar = document.getElementById("selectionBar");
    return bar instanceof HTMLElement ? bar : null;
  }

  function applicationSelectionCount() {
    try {
      if (typeof state === "object" && state?.selectedPlayerIds instanceof Set) {
        return state.selectedPlayerIds.size;
      }
    } catch {
      // Fall back to the selection label while the application initializes.
    }

    const countText = document.getElementById("selectionCount")?.textContent || "";
    const count = Number.parseInt(countText, 10);
    return Number.isFinite(count) ? count : 0;
  }

  function barIsVisible(bar) {
    if (!(bar instanceof HTMLElement) || bar.hidden) return false;
    const style = getComputedStyle(bar);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01) return false;
    const rect = bar.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function visibleFooterTop() {
    const footer = document.querySelector(".siteFooterDetails");
    if (!(footer instanceof HTMLElement) || footer.hidden) return innerHeight;
    const style = getComputedStyle(footer);
    const rect = footer.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01
        || rect.width <= 0 || rect.height <= 0 || rect.top >= innerHeight || rect.bottom <= 0) {
      return innerHeight;
    }
    return Math.max(0, Math.min(innerHeight, rect.top));
  }

  function syncSelectionBarPosition() {
    const bar = selectionBar();
    const main = document.querySelector("#appShell main, main");
    if (!(bar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

    if (bar.parentElement !== main) main.appendChild(bar);
    const rect = main.getBoundingClientRect();
    const bottom = Math.max(GAP, Math.ceil(innerHeight - visibleFooterTop() + GAP));
    bar.dataset.contentLayoutVersion = VERSION;
    document.documentElement.style.setProperty("--selection-center-x", `${Math.round(rect.left + rect.width / 2)}px`);
    document.documentElement.style.setProperty("--mfl-selection-bar-bottom", `${bottom}px`);
  }

  function actionTarget(target) {
    if (!(target instanceof Element)) return null;
    const bar = target.closest("#selectionBar");
    if (!(bar instanceof HTMLElement)) return null;
    const action = target.closest('button, a[href], [role="button"]');
    if (!(action instanceof HTMLElement) || !bar.contains(action)) return null;
    if (action.matches(":disabled") || action.getAttribute("aria-disabled") === "true") return null;
    return action;
  }

  function applicationOwnsSelectionLifecycle(action) {
    return action?.id === "addToWatchlistButton" || action?.id === "moveToWatchlistButton";
  }

  function modalIsOpen(id) {
    const modal = document.getElementById(id);
    return modal instanceof HTMLElement && !modal.hidden;
  }

  function anyModalIsOpen() {
    return Array.from(document.querySelectorAll('[id$="Modal"]')).some((modal) => (
      modal instanceof HTMLElement && !modal.hidden
    ));
  }

  function editableEscapeTarget(target) {
    return target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement
      || (target instanceof HTMLElement && target.isContentEditable);
  }

  function selectionActionModalOpen() {
    if (modalIsOpen("watchlistChoiceModal")) return true;
    if (!modalIsOpen("addWatchlistModal")) return false;
    try {
      return ["add-selected", "move-selected"].includes(String(state?.pendingAddWatchlistContext || ""));
    } catch {
      return true;
    }
  }

  function normalizePageName(value) {
    const page = String(value || "").trim().toLowerCase();
    if (page === "my-players") return "myplayers";
    if (page === "databasestats") return "database";
    if (page === "mflstats") return "mfl";
    return page;
  }

  function sidebarNavFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const nav = target.closest("#sidebar .navButton[data-page]");
    return nav instanceof HTMLElement ? nav : null;
  }

  function currentSourceTablePage() {
    const active = document.querySelector("#sidebar .navButton.active[data-page]");
    const activePage = active instanceof HTMLElement ? normalizePageName(active.dataset.page) : "";
    if (TABLE_PAGE_NAMES.has(activePage)) return activePage;
    const bodyPage = normalizePageName(document.body?.dataset.page);
    return TABLE_PAGE_NAMES.has(bodyPage) ? bodyPage : "";
  }

  function captureNavigationSourceControls(target) {
    const nav = sidebarNavFromTarget(target);
    const sourcePage = currentSourceTablePage();
    if (!nav || !sourcePage) {
      navigationSourceControlSnapshot = null;
      return;
    }

    const controls = {};
    NAVIGATION_STATE_CONTROL_IDS.forEach((id) => {
      const control = document.getElementById(id);
      if (control instanceof HTMLInputElement) {
        controls[id] = { kind: "checked", value: control.checked };
      } else if (control instanceof HTMLSelectElement) {
        controls[id] = { kind: "value", value: control.value };
      }
    });

    navigationSourceControlSnapshot = {
      sourcePage,
      destinationPage: normalizePageName(nav.dataset.page),
      controls,
    };
  }

  function restoreNavigationSourceControls(target) {
    const snapshot = navigationSourceControlSnapshot;
    navigationSourceControlSnapshot = null;
    if (!snapshot) return;
    const nav = sidebarNavFromTarget(target);
    if (!nav || normalizePageName(nav.dataset.page) !== snapshot.destinationPage) return;

    Object.entries(snapshot.controls).forEach(([id, saved]) => {
      const control = document.getElementById(id);
      if (saved.kind === "checked" && control instanceof HTMLInputElement) {
        control.checked = Boolean(saved.value);
      } else if (saved.kind === "value" && control instanceof HTMLSelectElement) {
        control.value = String(saved.value);
      }
    });
  }

  function rememberBarTop(bar = selectionBar()) {
    const rect = bar?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    lastSelectionTop = rect.top;
  }

  function prepareToastAnchor() {
    rememberBarTop();
    toastAnchorUntil = Date.now() + TOAST_ANCHOR_MS;
    if (toastAnchorTimer) clearTimeout(toastAnchorTimer);
    toastAnchorTimer = window.setTimeout(() => {
      toastAnchorTimer = 0;
      schedule();
    }, TOAST_ANCHOR_MS);
    schedule();
  }

  function preserveDismissedSelectionLabel() {
    if (!frozenSelectionLabel) return;
    const bar = selectionBar();
    if (!(bar instanceof HTMLElement) || !bar.classList.contains("mflSelectionActionDismissed")) return;
    const label = document.getElementById("selectionCount");
    if (label instanceof HTMLElement && label.textContent !== frozenSelectionLabel) {
      label.textContent = frozenSelectionLabel;
    }
  }

  function dismissSelectionBar(selectionCount = null) {
    const bar = selectionBar();
    if (!bar) return;

    rememberBarTop(bar);
    const requestedCount = Number(selectionCount);
    const selectedCount = Number.isFinite(requestedCount) && requestedCount > 0
      ? requestedCount
      : applicationSelectionCount();
    const currentLabel = String(document.getElementById("selectionCount")?.textContent || "").trim();
    frozenSelectionLabel = selectedCount > 0 ? `${selectedCount} selected` : currentLabel;
    if (selectedCount > 0) lastKnownSelectionCount = selectedCount;
    awaitingSelectionReset = true;
    if (exitTimer) clearTimeout(exitTimer);
    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("mflSelectionActionDismissed");
    bar.classList.remove("visible");
    preserveDismissedSelectionLabel();

    exitTimer = window.setTimeout(() => {
      exitTimer = 0;
      const current = selectionBar();
      if (current) {
        current.hidden = true;
        if (!awaitingSelectionReset) current.classList.remove("mflSelectionActionDismissed");
      }
      frozenSelectionLabel = "";
      schedule();
    }, EXIT_MS);
  }

  function clearApplicationSelection(action) {
    try {
      if (typeof clearSelection === "function") {
        clearSelection();
        return;
      }
    } catch {
      // Fall back to the application's own clear-selection control.
    }

    const clearButton = document.getElementById("clearSelectionButton");
    if (!(clearButton instanceof HTMLButtonElement)
        || clearButton === action
        || fallbackClearing) return;

    fallbackClearing = true;
    try {
      clearButton.click();
    } finally {
      fallbackClearing = false;
    }
  }

  function completeActionClick(action, sequence) {
    if (destroyed || sequence !== actionSequence) return;
    clearApplicationSelection(action);
    schedule();
  }

  function restoreSelectionBar(bar) {
    if (!(bar instanceof HTMLElement)) return;
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = 0;
    }
    awaitingSelectionReset = false;
    frozenSelectionLabel = "";
    bar.hidden = false;
    bar.classList.remove("mflSelectionActionDismissed");
    bar.classList.add("visible");
  }

  function syncDismissalLifecycle(selectedCount = applicationSelectionCount()) {
    const bar = selectionBar();
    if (!bar) return;

    if (awaitingSelectionReset && selectedCount === 0) {
      awaitingSelectionReset = false;
      lastKnownSelectionCount = 0;
      if (!exitTimer) bar.classList.remove("mflSelectionActionDismissed");
      return;
    }

    if (awaitingSelectionReset && selectedCount > 0 && !selectionActionModalOpen()) {
      restoreSelectionBar(bar);
      lastKnownSelectionCount = selectedCount;
      return;
    }

    if (!awaitingSelectionReset && selectedCount > 0) {
      lastKnownSelectionCount = selectedCount;
      bar.hidden = false;
      bar.classList.remove("mflSelectionActionDismissed");
    }
  }

  function syncSelectionState() {
    const bar = selectionBar();
    if (!(bar instanceof HTMLElement)) return;
    const selectedCount = applicationSelectionCount();

    if (selectedCount > 0) {
      lastKnownSelectionCount = selectedCount;
    } else if (lastKnownSelectionCount > 0 && !awaitingSelectionReset) {
      const clearedCount = lastKnownSelectionCount;
      lastKnownSelectionCount = 0;
      prepareToastAnchor();
      dismissSelectionBar(clearedCount);
    }

    preserveDismissedSelectionLabel();
    syncDismissalLifecycle(selectedCount);
    if (barIsVisible(bar) && !bar.classList.contains("mflSelectionActionDismissed")) {
      rememberBarTop(bar);
    }
  }

  function desiredToastBottom() {
    const bar = selectionBar();
    if (barIsVisible(bar) && !bar.classList.contains("mflSelectionActionDismissed")) {
      rememberBarTop(bar);
      return Math.max(GAP, Math.ceil(innerHeight - bar.getBoundingClientRect().top + GAP));
    }

    if (lastSelectionTop !== null && Date.now() < toastAnchorUntil) {
      return Math.max(GAP, Math.ceil(innerHeight - lastSelectionTop + GAP));
    }

    return 88;
  }

  function syncToastPosition() {
    const main = document.querySelector("#appShell main, main");
    if (main instanceof HTMLElement) {
      const rect = main.getBoundingClientRect();
      document.documentElement.style.setProperty("--toast-center-x", `${Math.round(rect.left + rect.width / 2)}px`);
    } else {
      document.documentElement.style.removeProperty("--toast-center-x");
    }
    document.documentElement.style.setProperty("--mfl-toast-bottom", `${desiredToastBottom()}px`);
  }

  function bindObserver() {
    const root = document.documentElement;
    if (!root || observer) return;
    observer = new MutationObserver(() => {
      preserveDismissedSelectionLabel();
      schedule();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "hidden", "style", "aria-hidden", "data-page"],
    });
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    bindObserver();
    syncSelectionBarPosition();
    syncSelectionState();
    syncToastPosition();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function onPointerDown(event) {
    captureNavigationSourceControls(event.target);
    if (!actionTarget(event.target)) return;
    prepareToastAnchor();
  }

  function onClick(event) {
    restoreNavigationSourceControls(event.target);
    if (fallbackClearing) return;
    const action = actionTarget(event.target);
    if (!action) return;

    prepareToastAnchor();
    dismissSelectionBar();

    if (applicationOwnsSelectionLifecycle(action)) {
      actionSequence += 1;
      schedule();
      return;
    }

    const sequence = ++actionSequence;
    queueMicrotask(() => completeActionClick(action, sequence));
  }

  function handleEscape(event) {
    if (modalIsOpen("addWatchlistModal")) {
      const closeButton = document.getElementById("closeAddWatchlistButton");
      if (closeButton instanceof HTMLButtonElement) closeButton.click();
      schedule();
      return true;
    }

    if (anyModalIsOpen()) return false;
    if (editableEscapeTarget(event.target)) return false;

    const selectedCount = applicationSelectionCount();
    if (selectedCount <= 0) return false;

    prepareToastAnchor();
    dismissSelectionBar(selectedCount);
    clearApplicationSelection(null);
    schedule();
    return true;
  }

  function bindEscapeHandler() {
    if (unregisterEscapeHandler) return true;
    const register = window.__mflControlInteractionsRuntime?.registerEscapeHandler;
    if (typeof register !== "function") return false;
    unregisterEscapeHandler = register("selection-stack", handleEscape, { priority: 100 });
    return true;
  }

  function clearForRouteTransition() {
    if (destroyed || applicationSelectionCount() <= 0) return false;
    clearApplicationSelection(null);
    schedule();
    return true;
  }

  function rebind() {
    if (destroyed) return;
    bindEscapeHandler();
    schedule();
  }

  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  rebind();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (exitTimer) clearTimeout(exitTimer);
    if (toastAnchorTimer) clearTimeout(toastAnchorTimer);
    observer?.disconnect();
    unregisterEscapeHandler?.();
    unregisterEscapeHandler = null;
    navigationSourceControlSnapshot = null;
    frozenSelectionLabel = "";
    lastKnownSelectionCount = 0;
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    document.documentElement.style.removeProperty("--selection-center-x");
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
    document.documentElement.style.removeProperty("--toast-center-x");
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
    const bar = selectionBar();
    if (bar) {
      bar.hidden = false;
      bar.classList.remove("mflSelectionActionDismissed");
    }
  }

  window.__mflSelectionStackRuntime = Object.freeze({
    clearForRouteTransition,
    version: VERSION,
    sync: schedule,
    rebind,
    destroy,
  });
})();