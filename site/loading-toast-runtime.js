(() => {
  "use strict";

  window.__mflLoadingToastRuntime?.destroy?.();

  const TOAST_ID = "mflLoadingToast";
  const STYLE_ID = "mflLoadingToastRuntimeStyles";
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

    /* Keep native scrolling available while descendants remain non-targetable.
       Wheel input lands on the nearest scroll surface rather than a control. */
    html.mflInteractionBusy body main,
    html.mflInteractionBusy body .tableScroller,
    html.mflInteractionBusy body .evaluationLoadList,
    html.mflInteractionBusy body .searchBody,
    html.mflInteractionBusy body .filterBuilder,
    html.mflInteractionBusy body .advancedSettingsBody,
    html.mflInteractionBusy body .sidebar {
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

  function toastSuppressed() {
    // evaluationLoadIntent is owned exclusively by the initial fetch that opens
    // the saved-evaluations popup. Keep the interaction lock active, but let
    // the popup's own "Loading saved evaluations..." state be the only feedback.
    return Boolean(document.body?.classList.contains("evaluationLoadIntent"));
  }

  function sync() {
    if (destroyed || !document.body) return;
    const toast = ensureToast();
    positionToast(toast);
    const busy = interactionBusy();

    if (busy && !toastSuppressed()) {
      toast.hidden = false;
      toast.classList.add("visible");
      return;
    }

    // Hide immediately when the final busy token ends or when this busy period
    // is the saved-evaluations popup fetch, which has its own loading message.
    toast.classList.remove("visible");
    toast.hidden = true;
  }

  observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-interaction-busy"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  window.addEventListener("mfl:ready", sync);
  window.addEventListener("resize", sync);
  sync();

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    window.removeEventListener("mfl:ready", sync);
    window.removeEventListener("resize", sync);
    document.getElementById(TOAST_ID)?.remove();
    style.remove();
  }

  window.__mflLoadingToastRuntime = Object.freeze({ sync, destroy });
})();