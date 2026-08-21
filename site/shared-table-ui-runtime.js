(() => {
  "use strict";

  const CONTROL_SELECTOR = "#pageSizeSelect, #watchlistButton, #openFiltersButton, #quickClearFiltersButton, .quickFilters input, #sidebar .navButton[data-page], #filtersModal button";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  window.__mflSharedTableUiRuntime?.destroy?.();

  let destroyed = false;
  let pointerControl = null;

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
    summary.textContent = `${activeFilterCountFromDialog()} active`;
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

  function createFiltersIcon() {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.classList.add("filtersViewIcon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", "M4 6h16M7 12h10M10 18h4");
    svg.appendChild(path);
    return svg;
  }

  function hideLegacyQuickClear() {
    const quickClear = document.getElementById("quickClearFiltersButton");
    if (!(quickClear instanceof HTMLButtonElement)) return;
    quickClear.hidden = true;
    quickClear.tabIndex = -1;
    quickClear.setAttribute("aria-hidden", "true");
  }

  function syncFiltersViewControl() {
    const views = document.querySelector("#progressionPage .views");
    const button = document.getElementById("openFiltersButton");
    const summary = document.getElementById("filterSummary");
    if (!(views instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return false;

    button.classList.add("filtersViewButton");
    button.setAttribute("aria-label", "Filters");
    if (!button.querySelector(":scope > .filtersViewIcon")) {
      const label = document.createElement("span");
      label.className = "filtersViewLabel";
      label.textContent = "Filters";
      button.textContent = "";
      button.append(createFiltersIcon(), label);
    }

    if (summary instanceof HTMLElement) {
      summary.classList.add("filtersViewCount");
      button.append(summary);
    }

    let separator = document.getElementById("viewControlsSeparator");
    if (!(separator instanceof HTMLSpanElement)) {
      separator = document.createElement("span");
      separator.id = "viewControlsSeparator";
      separator.className = "viewControlsSeparator";
      separator.setAttribute("aria-hidden", "true");
    }

    const firstViewButton = views.querySelector(":scope > .viewButton[data-view]");
    views.insertBefore(button, firstViewButton);
    views.insertBefore(separator, firstViewButton);
    hideLegacyQuickClear();
    return true;
  }

  function sync() {
    syncFiltersViewControl();
  }

  function destroy() {
    destroyed = true;
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
