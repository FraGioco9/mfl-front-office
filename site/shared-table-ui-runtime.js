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

  function syncFiltersViewControl() {
    const views = document.querySelector("#progressionPage .views");
    const button = document.getElementById("openFiltersButton");
    if (!(views instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return false;

    button.classList.add("filtersViewButton");
    button.setAttribute("aria-label", "Filters");
    if (!button.querySelector(":scope > .filtersViewIcon")) {
      const label = document.createElement("span");
      label.textContent = "Filters";
      button.replaceChildren(createFiltersIcon(), label);
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