(() => {
  "use strict";

  const CONTROL_SELECTOR = "#pageSizeSelect, #watchlistButton, #openFiltersButton, .quickFilters input, #sidebar .navButton[data-page], #filtersModal button";
  const FILTERED_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "agents", "myplayers"]);

  window.__mflSharedTableUiRuntime?.destroy?.();

  let destroyed = false;
  let pointerControl = null;
  let originalPrimeTableChrome = null;
  let wrappedPrimeTableChrome = null;

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

  function filterRuleIsActive(rule) {
    if (!(rule instanceof HTMLElement)) return false;
    const operator = String(rule.querySelector("[data-filter-operator]")?.value || "");
    const values = Array.from(rule.querySelectorAll("[data-filter-value]"));
    const value = String(values[0]?.value || "").trim();
    const valueTo = String(values[1]?.value || "").trim();
    return operator === "between" || operator === "during"
      ? Boolean(value && valueTo)
      : Boolean(value);
  }

  function activeFilterCountFromDialog() {
    return Array.from(document.querySelectorAll("#filterRules .filterRule")).filter(filterRuleIsActive).length;
  }

  function syncFilterSummaryNow() {
    const summary = document.getElementById("filterSummary");
    if (!(summary instanceof HTMLElement)) return;
    summary.textContent = String(activeFilterCountFromDialog());
  }

  function syncFilterSummaryAfterClose() {
    queueMicrotask(() => {
      if (!destroyed) syncFilterSummaryNow();
    });
  }

  function filtersModalIsOpen() {
    const modal = document.getElementById("filtersModal");
    return modal instanceof HTMLElement && !modal.hidden;
  }

  function markInitialTableFiltersForReset() {
    const page = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
    if (FILTERED_TABLE_PAGES.has(page)) {
      document.documentElement.dataset.mflResetTableFilters = page;
    }
  }

  function installPrimeTableChromeBridge() {
    const prime = Reflect.get(window, "__mflPrimeTableChrome");
    if (typeof prime !== "function") return false;
    if (prime === wrappedPrimeTableChrome) return true;

    originalPrimeTableChrome = prime;
    wrappedPrimeTableChrome = function primeTableChromeWithCountOnlySummary(...args) {
      const result = originalPrimeTableChrome.apply(this, args);
      syncFilterSummaryNow();
      return result;
    };
    Reflect.set(window, "__mflPrimeTableChrome", wrappedPrimeTableChrome);
    return true;
  }

  function onPointerDown(event) {
    pointerControl = controlFromTarget(event.target);
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#applyFiltersButton")) {
      syncFilterSummaryNow();
    } else if (target?.closest("#closeFiltersButton") || target?.id === "filtersModal") {
      syncFilterSummaryAfterClose();
    }

    const control = controlFromTarget(event.target);
    if (control && control === pointerControl) releaseFocus(control);
    pointerControl = null;
  }

  function onChange(event) {
    const control = controlFromTarget(event.target);
    if (control?.id === "pageSizeSelect") releaseFocus(control);
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && filtersModalIsOpen()) {
      syncFilterSummaryNow();
    }

    if (event.key !== "Escape") return;
    if (filtersModalIsOpen()) syncFilterSummaryAfterClose();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(CONTROL_SELECTOR)) releaseFocus(active);
  }

  function sync() {
    installPrimeTableChromeBridge();
    markInitialTableFiltersForReset();
    syncFilterSummaryNow();
  }

  function destroy() {
    destroyed = true;
    if (wrappedPrimeTableChrome && Reflect.get(window, "__mflPrimeTableChrome") === wrappedPrimeTableChrome && originalPrimeTableChrome) {
      Reflect.set(window, "__mflPrimeTableChrome", originalPrimeTableChrome);
    }
    originalPrimeTableChrome = null;
    wrappedPrimeTableChrome = null;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("keydown", onKeyDown, true);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKeyDown, true);

  sync();
  window.__mflSharedTableUiRuntime = Object.freeze({ sync, destroy });
})();
