(() => {
  "use strict";

  const STYLE_ID = "mflTableChromeRuntimeStyles";
  const CONTROL_SELECTOR = "#pageSizeSelect, #watchlistButton, #openFiltersButton, #quickClearFiltersButton, .quickFilters input, #sidebar .navButton[data-page], #filtersModal button";

  window.__mflSharedTableUiRuntime?.destroy?.();

  let destroyed = false;
  let pointerControl = null;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #mflStatsPage #mflStatsOverallFilters {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 6px !important;
        width: 100% !important;
      }
      #mflStatsPage #mflStatsOverallFilters .mflStatsFilterButton {
        flex: 1 1 0 !important;
        width: auto !important;
        min-width: 0 !important;
        padding-left: 5px !important;
        padding-right: 5px !important;
        white-space: nowrap !important;
      }
      .field.rowsField { min-width: 0 !important; pointer-events: none !important; }
      .field.rowsField > span { flex: 0 0 auto !important; pointer-events: none !important; }
      .field.rowsField > #pageSizeSelect { flex: 1 1 0 !important; width: 0 !important; min-width: 0 !important; pointer-events: auto !important; }
      .quickFilters label { cursor: default !important; }
      .quickFilters input { cursor: pointer !important; }
      #pageSizeSelect:focus:not(:focus-visible):not(:hover),
      #openFiltersButton:focus:not(:focus-visible):not(:hover),
      #quickClearFiltersButton:focus:not(:focus-visible):not(:hover),
      .quickFilters input:focus:not(:focus-visible):not(:hover),
      #sidebar .navButton[data-page]:focus:not(:focus-visible):not(:hover) {
        outline: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function controlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(CONTROL_SELECTOR);
    return control instanceof HTMLElement ? control : null;
  }

  function releaseFocus(control) {
    if (!(control instanceof HTMLElement)) return;
    queueMicrotask(() => {
      if (!destroyed && document.activeElement === control) control.blur();
    });
  }

  function onPointerDown(event) {
    pointerControl = controlFromTarget(event.target);
  }

  function onClick(event) {
    const control = controlFromTarget(event.target);
    if (control && control === pointerControl) releaseFocus(control);
    pointerControl = null;
  }

  function onChange(event) {
    const control = controlFromTarget(event.target);
    if (control?.id === "pageSizeSelect") releaseFocus(control);
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(CONTROL_SELECTOR)) releaseFocus(active);
  }

  function sync() {
    // Dynamic table chrome is owned by app-core and the route-specific stats runtimes.
  }

  function destroy() {
    destroyed = true;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKeyDown, true);

  window.__mflSharedTableUiRuntime = Object.freeze({ sync, destroy });
})();