(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const GAP = 12;
  const EXIT_MS = 220;
  const TOAST_ANCHOR_MS = 15000;
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage, .toast";
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

  function setImportant(element, property, value) {
    if (!(element instanceof HTMLElement)) return;
    if (element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  }

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
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement) || footer.hidden) return innerHeight;
    const style = getComputedStyle(footer);
    const rect = footer.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01
        || rect.width <= 0 || rect.height <= 0 || rect.top >= innerHeight || rect.bottom <= 0) {
      return innerHeight;
    }
    return Math.max(0, Math.min(innerHeight, rect.top));
  }

  function ensureStyles() {
    let style = document.getElementById("mflSelectionStackStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflSelectionStackStyles";
      document.head?.appendChild(style);
    }

    const css = `
      #selectionBar {
        --mfl-selection-exit-y: 0px;
      }

      #selectionBar.mflSelectionActionDismissed {
        --mfl-selection-exit-y: ${GAP}px;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease !important;
      }

      #selectionBar.mflSelectionActionDismissed * {
        pointer-events: none !important;
      }

      #addWatchlistNameInput:focus,
      #addWatchlistNameInput:focus-visible {
        outline: none;
        border-color: var(--primary-hover);
        background: var(--row-hover);
        color: var(--text);
        box-shadow: none;
      }

      #sidebar .navButton:focus,
      #sidebar .navButton:focus-visible {
        outline: none;
        border-color: var(--primary-hover);
        background: var(--row-hover);
        color: var(--text);
        box-shadow: none;
      }

      #sidebar .navButton.active:focus,
      #sidebar .navButton.active:focus-visible {
        border-color: var(--primary);
        background: var(--primary);
        color: #ffffff;
      }
    `;
    if (style && style.textContent !== css) style.textContent = css;
  }

  function syncSelectionBarPosition() {
    const bar = selectionBar();
    const main = document.querySelector("#appShell main, main");
    if (!(bar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

    if (bar.parentElement !== main) main.appendChild(bar);
    const rect = main.getBoundingClientRect();
    const bottom = Math.max(GAP, Math.ceil(innerHeight - visibleFooterTop() + GAP));
    bar.dataset.contentLayoutVersion = VERSION;
    setImportant(bar, "position", "fixed");
    setImportant(bar, "left", `${Math.round(rect.left + rect.width / 2)}px`);
    setImportant(bar, "right", "auto");
    setImportant(bar, "bottom", `${bottom}px`);
    setImportant(bar, "transform", "translateX(-50%) translateY(var(--mfl-selection-exit-y, 0px))");
    setImportant(bar, "z-index", "2147483630");
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
    const desiredBottom = desiredToastBottom();
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      setImportant(toast, "bottom", `${desiredBottom}px`);
      setImportant(toast, "z-index", "2147483635");
    });
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
    ensureStyles();
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

  function onKeyDown(event) {
    if (event.key !== "Escape") return;

    if (modalIsOpen("addWatchlistModal")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const closeButton = document.getElementById("closeAddWatchlistButton");
      if (closeButton instanceof HTMLButtonElement) closeButton.click();
      schedule();
      return;
    }

    if (anyModalIsOpen()) return;

    const selectedCount = applicationSelectionCount();
    if (selectedCount <= 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    prepareToastAnchor();
    dismissSelectionBar(selectedCount);
    clearApplicationSelection(null);
    schedule();
  }

  function rebind() {
    if (destroyed) return;
    schedule();
  }

  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  rebind();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (exitTimer) clearTimeout(exitTimer);
    if (toastAnchorTimer) clearTimeout(toastAnchorTimer);
    observer?.disconnect();
    navigationSourceControlSnapshot = null;
    frozenSelectionLabel = "";
    lastKnownSelectionCount = 0;
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      toast.style.removeProperty("bottom");
      toast.style.removeProperty("z-index");
    });
    const bar = selectionBar();
    if (bar) {
      bar.hidden = false;
      bar.classList.remove("mflSelectionActionDismissed");
      ["position", "left", "right", "bottom", "transform", "z-index"].forEach((property) => {
        bar.style.removeProperty(property);
      });
    }
    document.getElementById("mflSelectionStackStyles")?.remove();
  }

  window.__mflSelectionStackRuntime = Object.freeze({
    version: VERSION,
    sync: schedule,
    rebind,
    destroy,
  });
})();
