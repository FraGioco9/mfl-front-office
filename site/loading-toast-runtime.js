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

  function interactionBusy() {
    const root = document.documentElement;
    return root.classList.contains("mflInteractionBusy")
      || root.dataset.interactionBusy === "true";
  }

  function sync() {
    if (destroyed || !document.body) return;
    const toast = ensureToast();
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
  sync();

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    window.removeEventListener("mfl:ready", sync);
    document.getElementById(TOAST_ID)?.remove();
    style.remove();
  }

  window.__mflLoadingToastRuntime = Object.freeze({ sync, destroy });
})();
