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

    /* Loading owns pointer interaction completely. Keeping the transparent
       shield as the sole hit target also clears button hover states while the
       underlying page changes. */
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

    /* Older route-specific CSS hides body::after on Evaluation and Stats.
       Busy mode must win that conflict so Load, Reset, Filters, and every other
       control are no longer hover targets until the last busy token ends. */
    html.mflInteractionBusy body::after {
      content: "" !important;
      display: block !important;
      visibility: visible !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: transparent !important;
      pointer-events: auto !important;
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

  function sync() {
    if (destroyed || !document.body) return;
    const toast = ensureToast();
    positionToast(toast);
    const busy = interactionBusy();

    if (busy) {
      toast.hidden = false;
      toast.classList.add("visible");
      return;
    }

    // Hide immediately when the final busy token ends. Do not leave a toast
    // fade-out behind after interactions have already been re-enabled.
    toast.classList.remove("visible");
    toast.hidden = true;
  }

  observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-interaction-busy"],
  });

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