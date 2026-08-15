(() => {
  "use strict";

  window.__mflLoadingToastRuntime?.destroy?.();

  const TOAST_ID = "mflLoadingToast";
  const STYLE_ID = "mflLoadingToastRuntimeStyles";
  const FOOTER_LOCK_CLASS = "mflLoadingLocked";
  const TABLE_SCROLL_CLASS = "mflTableScrolling";
  let destroyed = false;
  let observer = null;
  let layerObserver = null;
  let applicationToastObserver = null;
  let applicationToastTarget = null;
  let applicationToastSnapshot = null;
  let tableScrollTimer = 0;

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

    /* Controls remain completely non-targetable while loading. The fixed busy
       shield below becomes the only pointer target, so controls cannot retain
       hover states while their loading state changes. */
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

    /* Drop the browser's stationary row hover target while the table moves
       under the pointer. Removing this class after scrolling ends lets the row
       currently under the pointer become the hover target normally. */
    html.${TABLE_SCROLL_CLASS} #progressionPage .tableScroller tbody {
      pointer-events: none;
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
       The busy shield still owns pointer hover, so these scroll surfaces cannot
       expose hover animation on the controls they contain. */
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

    /* The fixed shield is the sole pointer target during loading. This clears
       any stationary :hover state immediately (notably Evaluation's Load button)
       while still sitting below application toasts. */
    html.mflInteractionBusy body::after {
      content: "" !important;
      display: block !important;
      visibility: visible !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      background: transparent !important;
      pointer-events: auto !important;
      cursor: wait !important;
      transition: none !important;
      animation: none !important;
    }

    /* Toasts are application-level feedback and must remain visible over every
       modal, backdrop and busy shield. Keep the shield one layer below them. */
    .toastMessage {
      z-index: 2147483647 !important;
    }

    #${TOAST_ID} {
      pointer-events: none !important;
      user-select: none;
    }

    .toastMessage[data-mfl-retiring-toast="true"] {
      pointer-events: none !important;
      user-select: none;
    }
  `;
  document.head.appendChild(style);

  function openModalHost() {
    const modals = Array.from(document.querySelectorAll(".modalBackdrop:not([hidden])"))
      .filter((modal) => modal instanceof HTMLElement);
    return modals.at(-1) || null;
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

  function retireApplicationToast(snapshot, liveToast) {
    if (!(snapshot instanceof HTMLElement) || !(liveToast instanceof HTMLElement) || !document.body) return;

    const retiringToast = snapshot;
    retiringToast.removeAttribute("id");
    retiringToast.dataset.mflRetiringToast = "true";
    retiringToast.hidden = false;
    retiringToast.classList.add("visible");
    retiringToast.removeAttribute("role");
    retiringToast.removeAttribute("aria-live");
    retiringToast.removeAttribute("aria-atomic");
    retiringToast.setAttribute("aria-hidden", "true");

    const host = liveToast.parentElement || openModalHost() || document.body;
    host.appendChild(retiringToast);
    retiringToast.style.setProperty("z-index", "2147483647", "important");
    positionToast(retiringToast);

    // Commit the visible start state before removing it so the existing
    // toast exit transition always runs, even when the replacement happens
    // in the same browser task.
    retiringToast.getBoundingClientRect();

    const removeRetiringToast = () => retiringToast.remove();
    retiringToast.addEventListener("transitionend", removeRetiringToast, { once: true });
    window.setTimeout(removeRetiringToast, 240);
    window.requestAnimationFrame(() => {
      if (retiringToast.isConnected) retiringToast.classList.remove("visible");
    });
  }

  function syncApplicationToastObserver() {
    const toast = document.getElementById("toastMessage");
    if (toast === applicationToastTarget) return;

    applicationToastObserver?.disconnect();
    applicationToastObserver = null;
    applicationToastTarget = toast instanceof HTMLElement ? toast : null;
    applicationToastSnapshot = null;

    if (!(applicationToastTarget instanceof HTMLElement)) return;

    const visible = applicationToastTarget.classList.contains("visible") && !applicationToastTarget.hidden;
    if (visible) applicationToastSnapshot = applicationToastTarget.cloneNode(true);

    applicationToastObserver = new MutationObserver((records) => {
      if (!(applicationToastTarget instanceof HTMLElement)) return;

      const contentChanged = records.some((record) =>
        (record.type === "childList" || record.type === "characterData")
        && (record.target === applicationToastTarget || applicationToastTarget.contains(record.target))
      );
      const wasVisible = applicationToastSnapshot instanceof HTMLElement
        && applicationToastSnapshot.classList.contains("visible")
        && !applicationToastSnapshot.hidden;
      const isVisible = applicationToastTarget.classList.contains("visible")
        && !applicationToastTarget.hidden;

      if (contentChanged && wasVisible && isVisible) {
        retireApplicationToast(applicationToastSnapshot, applicationToastTarget);
      }

      applicationToastSnapshot = isVisible
        ? applicationToastTarget.cloneNode(true)
        : null;
    });
    applicationToastObserver.observe(applicationToastTarget, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });
  }

  function syncToastHosts() {
    if (destroyed || !document.body) return;
    const host = openModalHost() || document.body;
    document.querySelectorAll(".toastMessage").forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      if (toast.parentElement !== host) host.appendChild(toast);
      toast.style.setProperty("z-index", "2147483647", "important");
    });
    syncApplicationToastObserver();
  }

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
    syncToastHosts();
    return toast;
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
    syncToastHosts();
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

    layerObserver = new MutationObserver(syncToastHosts);
    layerObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  window.addEventListener("mfl:ready", sync);
  window.addEventListener("resize", sync);
  document.addEventListener("scroll", onScroll, true);
  window.visualViewport?.addEventListener("resize", sync, { passive: true });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true });
  sync();

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    layerObserver?.disconnect();
    applicationToastObserver?.disconnect();
    applicationToastObserver = null;
    applicationToastTarget = null;
    applicationToastSnapshot = null;
    if (tableScrollTimer) window.clearTimeout(tableScrollTimer);
    tableScrollTimer = 0;
    document.documentElement.classList.remove(TABLE_SCROLL_CLASS);
    window.removeEventListener("mfl:ready", sync);
    window.removeEventListener("resize", sync);
    document.removeEventListener("scroll", onScroll, true);
    window.visualViewport?.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("scroll", sync);
    document.querySelectorAll('.toastMessage[data-mfl-retiring-toast="true"]').forEach((toast) => toast.remove());
    if (document.body) {
      document.querySelectorAll(".toastMessage").forEach((toast) => {
        if (toast instanceof HTMLElement && toast.id !== TOAST_ID && toast.parentElement !== document.body) {
          document.body.appendChild(toast);
        }
      });
    }
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
