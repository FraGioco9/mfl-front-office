(() => {
  "use strict";

  window.__mflLoadingToastRuntime?.destroy?.();

  const TOAST_ID = "mflLoadingToast";
  const FOOTER_LOCK_CLASS = "mflLoadingLocked";
  const TABLE_SCROLL_CLASS = "mflTableScrolling";
  const TOAST_COORDINATION_REASONS = new Set([
    "setPage",
    "setView",
    "switchWatchlist",
    "route-runtime",
    "requestIncrementalRoute",
  ]);
  const controller = window.__mflInteractionBusy;
  let destroyed = false;
  let unsubscribe = null;
  let tableScrollTimer = 0;

  function setToastPosition(centerX) {
    if (!Number.isFinite(centerX)) return;
    document.documentElement.style.setProperty("--toast-center-x", `${centerX}px`);
  }

  function toastCenterX() {
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const viewport = window.visualViewport;
    if (mobile && viewport) {
      return viewport.offsetLeft + viewport.width / 2;
    }

    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return window.innerWidth / 2;
    const rect = main.getBoundingClientRect();
    return rect.width > 0 ? rect.left + rect.width / 2 : window.innerWidth / 2;
  }

  function syncToastPosition() {
    setToastPosition(toastCenterX());
  }

  function positionToast(toast) {
    if (!(toast instanceof HTMLElement)) return;
    syncToastPosition();
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const viewport = window.visualViewport;
    if (mobile && viewport) {
      const layoutHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      const obscuredBottom = Math.max(0, layoutHeight - viewport.offsetTop - viewport.height);
      toast.style.setProperty("--mfl-visual-viewport-bottom", `${obscuredBottom}px`);
    } else {
      toast.style.removeProperty("--mfl-visual-viewport-bottom");
    }
    toast.style.removeProperty("left");
  }

  function retireApplicationToast(snapshot) {
    if (!(snapshot instanceof HTMLElement) || !document.body) return;

    snapshot.removeAttribute("id");
    snapshot.dataset.mflRetiringToast = "true";
    snapshot.hidden = false;
    snapshot.classList.add("visible");
    snapshot.removeAttribute("role");
    snapshot.removeAttribute("aria-live");
    snapshot.removeAttribute("aria-atomic");
    snapshot.setAttribute("aria-hidden", "true");
    document.body.appendChild(snapshot);
    positionToast(snapshot);

    const removeRetiringToast = () => {
      if (snapshot.isConnected) snapshot.remove();
    };
    const exitAnimation = snapshot.animate([
      { opacity: 1, transform: "translate(-50%, 0)" },
      { opacity: 0, transform: "translate(-50%, 14px)" },
    ], {
      duration: 180,
      easing: "ease",
      fill: "forwards",
    });
    exitAnimation.addEventListener("finish", removeRetiringToast, { once: true });
    exitAnimation.addEventListener("cancel", removeRetiringToast, { once: true });
    window.setTimeout(removeRetiringToast, 240);
  }

  function retireVisibleApplicationToast() {
    const liveToast = document.getElementById("toastMessage");
    if (!(liveToast instanceof HTMLElement)
      || liveToast.hidden
      || !liveToast.classList.contains("visible")) return;

    retireApplicationToast(liveToast.cloneNode(true));
    liveToast.classList.remove("visible");
  }

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast instanceof HTMLElement) return toast;
    if (!document.body) return null;

    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "toastMessage mflLoadingToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    toast.textContent = "Loading...";
    toast.hidden = true;
    document.body.appendChild(toast);
    return toast;
  }

  function syncFooterLock(snapshot) {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;
    const locked = Boolean(snapshot?.busy) || document.documentElement.dataset.mflReady !== "true";
    footer.classList.toggle(FOOTER_LOCK_CLASS, locked);
    if (locked) {
      footer.inert = true;
      footer.dataset.mflLoadingLocked = "true";
      return;
    }
    if (footer.dataset.mflLoadingLocked === "true") {
      footer.inert = false;
      delete footer.dataset.mflLoadingLocked;
    }
  }

  function toastSuppressed() {
    return Boolean(document.body?.classList.contains("evaluationLoadIntent"));
  }

  function snapshotNeedsToast(snapshot) {
    if (!snapshot?.busy) return false;
    const reasons = Array.isArray(snapshot.reasons) ? snapshot.reasons : [];
    return reasons.some((reason) => !TOAST_COORDINATION_REASONS.has(String(reason || "")));
  }

  function loadingSnapshot() {
    return controller?.snapshot?.() || Object.freeze({ busy: false, dataLoading: false, reasons: Object.freeze([]) });
  }

  function sync(snapshot = loadingSnapshot()) {
    if (!snapshot || typeof snapshot.busy !== "boolean") snapshot = loadingSnapshot();
    if (destroyed || !document.body) return;
    syncFooterLock(snapshot);
    const toast = ensureToast();
    if (!(toast instanceof HTMLElement)) return;
    positionToast(toast);
    const loadingToastVisible = !toast.hidden && toast.classList.contains("visible");

    if (snapshotNeedsToast(snapshot) && !toastSuppressed()) {
      if (!loadingToastVisible) retireVisibleApplicationToast();
      toast.hidden = false;
      toast.classList.add("visible");
      return;
    }

    toast.classList.remove("visible");
    toast.hidden = true;
  }

  function clearTableScrollHover() {
    tableScrollTimer = 0;
    document.documentElement.classList.remove(TABLE_SCROLL_CLASS);
  }

  function onScroll() {
    const tablePage = document.getElementById("progressionPage");
    if (!(tablePage instanceof HTMLElement) || tablePage.hidden) return;
    document.documentElement.classList.add(TABLE_SCROLL_CLASS);
    if (tableScrollTimer) window.clearTimeout(tableScrollTimer);
    tableScrollTimer = window.setTimeout(clearTableScrollHover, 80);
  }

  if (typeof controller?.subscribe === "function") {
    unsubscribe = controller.subscribe(sync);
  } else {
    sync();
  }

  window.addEventListener("mfl:ready", sync);
  window.addEventListener("resize", sync);
  document.addEventListener("scroll", onScroll, true);
  window.visualViewport?.addEventListener("resize", sync, { passive: true });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true });

  function destroy() {
    destroyed = true;
    unsubscribe?.();
    unsubscribe = null;
    if (tableScrollTimer) window.clearTimeout(tableScrollTimer);
    tableScrollTimer = 0;
    document.documentElement.classList.remove(TABLE_SCROLL_CLASS);
    window.removeEventListener("mfl:ready", sync);
    window.removeEventListener("resize", sync);
    document.removeEventListener("scroll", onScroll, true);
    window.visualViewport?.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("scroll", sync);
    document.querySelectorAll('.toastMessage[data-mfl-retiring-toast="true"]').forEach((toast) => toast.remove());
    document.getElementById(TOAST_ID)?.remove();
    const footer = document.querySelector(".siteFooter");
    if (footer instanceof HTMLElement) {
      footer.classList.remove(FOOTER_LOCK_CLASS);
      if (footer.dataset.mflLoadingLocked === "true") {
        footer.inert = false;
        delete footer.dataset.mflLoadingLocked;
      }
    }
  }

  window.__mflToastPosition = Object.freeze({
    name: "Toast Position",
    sync: syncToastPosition,
  });
  window.__mflLoadingToastRuntime = Object.freeze({ sync, destroy });
})();