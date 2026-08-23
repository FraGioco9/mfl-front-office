(() => {
  "use strict";

  window.__mflLoadingToastRuntime?.destroy?.();

  const TOAST_ID = "mflLoadingToast";
  const FOOTER_LOCK_CLASS = "mflLoadingLocked";
  const TABLE_SCROLL_CLASS = "mflTableScrolling";
  const ROUTE_LOADING_REASON = "route-loading";
  const TOAST_ENTER_DURATION_MS = 180;
  const TOAST_COORDINATION_REASONS = new Set([
    "evaluation-load",
  ]);
  const controller = window.__mflInteractionBusy;
  let destroyed = false;
  let unsubscribe = null;
  let tableScrollTimer = 0;
  let toastCheckFrame = 0;
  let toastCheckSequence = 0;
  let toastEnterAnimation = null;

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
    const initialRouteResolved = document.documentElement.classList.contains("mflInitialRouteResolved");
    const locked = Boolean(snapshot?.busy) || !initialRouteResolved;
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

  function savedEvaluationRouteActive() {
    if (window.location.pathname !== "/evaluation") return false;
    const savedId = new URLSearchParams(window.location.search).get("saved");
    return Boolean(String(savedId || "").trim());
  }

  function snapshotHasReason(snapshot, targetReason) {
    const reasons = Array.isArray(snapshot?.reasons) ? snapshot.reasons : [];
    return reasons.some((reason) => String(reason || "") === targetReason);
  }

  function toastSuppressed(snapshot) {
    return snapshotHasReason(snapshot, "evaluation-load")
      || Boolean(document.body?.classList.contains("evaluationLoadIntent"))
      || savedEvaluationRouteActive();
  }

  function snapshotNeedsToast(snapshot) {
    if (!snapshot?.busy) return false;
    const reasons = Array.isArray(snapshot.reasons) ? snapshot.reasons : [];
    return reasons.some((reason) => !TOAST_COORDINATION_REASONS.has(String(reason || "")));
  }

  function routeOnlySnapshot(snapshot) {
    const reasons = Array.isArray(snapshot?.reasons) ? snapshot.reasons : [];
    return reasons.length > 0 && reasons.every((reason) => String(reason || "") === ROUTE_LOADING_REASON);
  }

  function currentRouteDataCacheReady() {
    const cache = Reflect.get(window, "__mflRouteDataCache");
    return Boolean(
      cache
      && typeof cache === "object"
      && typeof cache.isCurrentRouteReady === "function"
      && cache.isCurrentRouteReady(),
    );
  }

  function loadingSnapshot() {
    return controller?.snapshot?.() || Object.freeze({ busy: false, dataLoading: false, reasons: Object.freeze([]) });
  }

  function cancelToastEnterAnimation() {
    toastEnterAnimation?.cancel?.();
    toastEnterAnimation = null;
  }

  function hideLoadingToast(toast) {
    if (!(toast instanceof HTMLElement)) return;
    cancelToastEnterAnimation();
    toast.classList.remove("visible");
    toast.hidden = true;
  }

  function animateLoadingToastIn(toast) {
    if (!(toast instanceof HTMLElement) || typeof toast.animate !== "function") return;
    cancelToastEnterAnimation();
    const animation = toast.animate([
      { opacity: 0 },
      { opacity: 1 },
    ], {
      duration: TOAST_ENTER_DURATION_MS,
      easing: "ease",
    });
    toastEnterAnimation = animation;
    const clearAnimation = () => {
      if (toastEnterAnimation === animation) toastEnterAnimation = null;
    };
    animation.addEventListener("finish", clearAnimation, { once: true });
    animation.addEventListener("cancel", clearAnimation, { once: true });
  }

  function cancelToastCheck() {
    toastCheckSequence += 1;
    if (toastCheckFrame) cancelAnimationFrame(toastCheckFrame);
    toastCheckFrame = 0;
  }

  function showLoadingToastIfNeeded(sequence) {
    toastCheckFrame = 0;
    if (destroyed || sequence !== toastCheckSequence || !document.body) return;

    const snapshot = loadingSnapshot();
    const toast = ensureToast();
    if (!(toast instanceof HTMLElement)) return;
    positionToast(toast);

    if (!snapshotNeedsToast(snapshot) || toastSuppressed(snapshot)) {
      hideLoadingToast(toast);
      return;
    }

    if (routeOnlySnapshot(snapshot) && currentRouteDataCacheReady()) {
      hideLoadingToast(toast);
      return;
    }

    retireVisibleApplicationToast();
    toast.hidden = false;
    toast.classList.add("visible");
    animateLoadingToastIn(toast);
  }

  function scheduleToastCheck() {
    cancelToastCheck();
    const sequence = toastCheckSequence;
    let remainingFrames = 3;
    const nextFrame = () => {
      if (destroyed || sequence !== toastCheckSequence) return;
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        showLoadingToastIfNeeded(sequence);
        return;
      }
      toastCheckFrame = requestAnimationFrame(nextFrame);
    };
    toastCheckFrame = requestAnimationFrame(nextFrame);
  }

  function sync(snapshot = loadingSnapshot()) {
    if (!snapshot || typeof snapshot.busy !== "boolean") snapshot = loadingSnapshot();
    if (destroyed || !document.body) return;
    syncFooterLock(snapshot);

    const toast = ensureToast();
    if (!(toast instanceof HTMLElement)) return;
    positionToast(toast);
    const loadingToastVisible = !toast.hidden && toast.classList.contains("visible");

    if (!snapshotNeedsToast(snapshot) || toastSuppressed(snapshot)) {
      cancelToastCheck();
      hideLoadingToast(toast);
      return;
    }

    if (loadingToastVisible) return;
    scheduleToastCheck();
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

  window.addEventListener("mfl:route-ready", sync);
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
    cancelToastEnterAnimation();
    cancelToastCheck();
    document.documentElement.classList.remove(TABLE_SCROLL_CLASS);
    window.removeEventListener("mfl:route-ready", sync);
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
