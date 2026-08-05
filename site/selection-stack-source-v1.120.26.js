(() => {
  const VERSION = "1.120.26";
  const GAP = 12;
  const EXIT_MS = 220;
  const TOAST_ANCHOR_MS = 15000;
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage, .toast";

  window.__mflSelectionStackRuntime?.destroy?.();
  window.__mflSelectionBarLayoutRuntime?.destroy?.();
  window.__mflSelectionFeedbackRuntime?.destroy?.();

  let frame = 0;
  let interval = 0;
  let observer = null;
  let exitTimer = 0;
  let destroyed = false;
  let fallbackClearing = false;
  let actionSequence = 0;
  let lastSelectionTop = null;
  let toastAnchorUntil = 0;
  let awaitingSelectionReset = false;

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
    `;
    if (style && style.textContent !== css) style.textContent = css;
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;
    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }
    const text = `MFL Front Office v${VERSION}`;
    if (link.textContent === text
        && link.getAttribute("href") === "/changelog"
        && link.dataset.page === "changelog"
        && footer.dataset.releaseVersion === VERSION
        && !link.hidden) return;

    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.href = "/changelog";
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
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

  function rememberBarTop(bar = selectionBar()) {
    const rect = bar?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    lastSelectionTop = rect.top;
  }

  function prepareToastAnchor() {
    rememberBarTop();
    toastAnchorUntil = Date.now() + TOAST_ANCHOR_MS;
    schedule();
  }

  function dismissSelectionBar() {
    const bar = selectionBar();
    if (!bar) return;

    rememberBarTop(bar);
    awaitingSelectionReset = true;
    if (exitTimer) clearTimeout(exitTimer);
    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("mflSelectionActionDismissed");
    bar.classList.remove("visible");

    exitTimer = window.setTimeout(() => {
      exitTimer = 0;
      const current = selectionBar();
      if (current) {
        current.hidden = true;
        if (!awaitingSelectionReset) current.classList.remove("mflSelectionActionDismissed");
      }
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

  function syncDismissalLifecycle() {
    const bar = selectionBar();
    if (!bar) return;
    const selectedCount = applicationSelectionCount();

    if (awaitingSelectionReset && selectedCount === 0) {
      awaitingSelectionReset = false;
      if (!exitTimer) bar.classList.remove("mflSelectionActionDismissed");
      return;
    }

    if (!awaitingSelectionReset && selectedCount > 0) {
      bar.hidden = false;
      bar.classList.remove("mflSelectionActionDismissed");
    }
  }

  function syncSelectionState() {
    const bar = selectionBar();
    if (!(bar instanceof HTMLElement)) return;
    syncDismissalLifecycle();
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
    observer = new MutationObserver(schedule);
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
    syncFooter();
    syncSelectionBarPosition();
    syncSelectionState();
    syncToastPosition();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function onPointerDown(event) {
    if (!actionTarget(event.target)) return;
    prepareToastAnchor();
  }

  function onClick(event) {
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

  function rebind() {
    if (destroyed) return;
    schedule();
  }

  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  interval = window.setInterval(schedule, 100);
  rebind();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    if (exitTimer) clearTimeout(exitTimer);
    observer?.disconnect();
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("click", onClick, true);
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

  window.__mflSelectionStackRuntime = {
    version: VERSION,
    sync: schedule,
    rebind,
    destroy,
  };
})();
