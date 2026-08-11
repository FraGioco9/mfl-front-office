(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.33");
  window.__mflSearchResultClickRuntime?.destroy?.();

  let destroyed = false;
  let forwarding = false;

  function appBusy() {
    return document.documentElement.classList.contains("mflInteractionBusy")
      || document.documentElement.dataset.interactionBusy === "true";
  }

  function onClick(event) {
    if (destroyed || forwarding || appBusy()) return;
    const target = event.target instanceof Element
      ? event.target.closest("#playerSearchResults .searchResult, #evaluationSearchResults .evaluationSearchResult")
      : null;
    if (!(target instanceof HTMLButtonElement) || target.hidden || target.disabled) return;

    // Own the real pointer click before document-level compatibility blockers.
    // Re-dispatch one synthetic click while the forwarding flag is set so the
    // result's original listener still runs exactly once.
    event.preventDefault();
    event.stopImmediatePropagation();
    forwarding = true;
    try {
      target.click();
    } finally {
      forwarding = false;
    }
  }

  window.addEventListener("click", onClick, true);

  function destroy() {
    destroyed = true;
    window.removeEventListener("click", onClick, true);
  }

  window.__mflSearchResultClickRuntime = Object.freeze({
    version: VERSION,
    destroy,
  });
})();
