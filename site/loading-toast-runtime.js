(() => {
  "use strict";

  window.__mflLoadingToastRuntime?.destroy?.();

  const TOAST_ID = "mflLoadingToast";
  const STYLE_ID = "mflLoadingToastRuntimeStyles";
  const FOOTER_LOCK_CLASS = "mflLoadingLocked";
  let destroyed = false;
  let observer = null;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.mflInteractionBusy,
    html.mflInteractionBusy body,
    html.mflInteractionBusy body *,
    html.mflInteractionBusy body *::before,
    html.mflInteractionBusy body *::after,
    html.mflInteractionBusy body::after {
      cursor: default !important;
    }

    /* Controls remain completely non-targetable while loading, which prevents
       both clicks and hover states without freezing the page's scroll surfaces. */
    html.mflInteractionBusy body *,
    html.mflInteractionBusy body *::before,
    html.mflInteractionBusy body *::after {
      pointer-events: none !important;
      transition: none !important;
      animation: none !important;
    }

    html.mflInteractionBusy body button,
    html.mflInteractionBusy body button *,
    html.mflInteractionBusy body [role="button"],
    html.mflInteractionBusy body [role="button"] * {
      transition: none !important;
      animation: none !important;
    }

    /* The footer is never an interactive loading surface. Keep its normal
       resting appearance and suppress link hover/focus/active paint entirely. */
    .siteFooter.${FOOTER_LOCK_CLASS},
    .siteFooter.${FOOTER_LOCK_CLASS} * {
      pointer-events: none !important;
      cursor: default !important;
      transition: none !important;
      animation: none !important;
    }

    .siteFooter.${FOOTER_LOCK_CLASS} a,
    .siteFooter.${FOOTER_LOCK_CLASS} a:hover,
    .siteFooter.${FOOTER_LOCK_CLASS} a:focus,
    .siteFooter.${FOOTER_LOCK_CLASS} a:focus-visible,
    .siteFooter.${FOOTER_LOCK_CLASS} a:active {
      color: var(--text) !important;
      text-decoration: none !important;
      transform: none !important;
      box-shadow: none !important;
      outline: none !important;
    }

    /* Keep native scrolling available while descendants remain non-targetable.
       Wheel input lands on the nearest scroll surface rather than a control. */
    html.mflInteractionBusy body main,
    html.mflInteractionBusy body .tableScroller,
    html.mflInteractionBusy body .evaluationLoadList,
    html.mflInteractionBusy body .searchBody,
    html.mflInteractionBusy body .filterBuilder,
    html.mflInteractionBusy body .advancedSettingsBody,
    html.mflInteractionBusy body .sidebar,
    html.mflInteractionBusy body .views,
    html.mflInteractionBusy body .playerAttributeViews,
    html.mflInteractionBusy body .advancedPlayerTableSection,
    html.mflInteractionBusy body .mflStatsAgeDistribution {
      pointer-events: auto !important;
    }

    /* Older route-specific CSS hides body::after on Evaluation and Stats.
       Keep the layer present for consistent busy styling, but do not let it
       swallow wheel input now that scrolling remains available during loading. */
    html.mflInteractionBusy body::after {
      content: "" !important;
      display: block !important;
      visibility: visible !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: transparent !important;
      pointer-events: none !important;
      transition: none !important;
      animation: none !important;
    }

    #${TOAST_ID} {
      pointer-events: none !important;
      user-select: none;
    }
  `;
  document.head.appendChild(style);

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast instanceof HTMLElement) return toast;

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

  function positionToast(toast) {
    if (!(toast instanceof HTMLElement)) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const viewport = window.visualViewport;
    if (mobile && viewport) {
      toast.style.setProperty("left", `${viewport.offsetLeft + viewport.width / 2}px`, "important");
      const layoutHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      const obscuredBottom = Math.max(0, layoutHeight - viewport.offsetTop - viewport.height);
      toast.style.setProperty("--mfl-visual-viewport-bottom", `${obscuredBottom}px`);
      return;
    }

    toast.style.removeProperty("--mfl-visual-viewport-bottom");
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) {
      toast.style.removeProperty("left");
      return;
    }

    const rect = main.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    toast.style.setProperty("left", `${rect.left + rect.width / 2}px`, "important");
  }

  function interactionBusy() {
    const root = document.documentElement;
    return root.classList.contains("mflInteractionBusy")
      || root.dataset.interactionBusy === "true";
  }

  function footerLoadingActive() {
    const root = document.documentElement;
    return interactionBusy()
      || root.classList.contains("mflDataLoading")
      || root.dataset.mflReady !== "true"
      || document.body?.getAttribute("aria-busy") === "true";
  }

  function syncFooterLock() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;
    const locked = footerLoadingActive();
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
    // evaluationLoadIntent is owned exclusively by the initial fetch that opens
    // the saved-evaluations popup. Keep the interaction lock active, but let
    // the popup's own loading state be the only feedback.
    return Boolean(document.body?.classList.contains("evaluationLoadIntent"));
  }

  function sync() {
    if (destroyed || !document.body) return;
    syncFooterLock();
    const toast = ensureToast();
    positionToast(toast);
    const busy = interactionBusy();

    if (busy && !toastSuppressed()) {
      toast.hidden = false;
      toast.classList.add("visible");
      return;
    }

    toast.classList.remove("visible");
    toast.hidden = true;
  }

  observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-interaction-busy", "data-mfl-ready"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "aria-busy"],
    });
  }

  window.addEventListener("mfl:ready", sync);
  window.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("resize", sync, { passive: true });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true });
  sync();

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    window.removeEventListener("mfl:ready", sync);
    window.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("scroll", sync);
    document.getElementById(TOAST_ID)?.remove();
    const footer = document.querySelector(".siteFooter");
    if (footer instanceof HTMLElement) {
      footer.classList.remove(FOOTER_LOCK_CLASS);
      if (footer.dataset.mflLoadingLocked === "true") {
        footer.inert = false;
        delete footer.dataset.mflLoadingLocked;
      }
    }
    style.remove();
  }

  window.__mflLoadingToastRuntime = Object.freeze({ sync, destroy });
})();
