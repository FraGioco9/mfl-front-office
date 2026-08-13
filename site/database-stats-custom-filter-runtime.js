(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.123.9");

  window.__mflDatabaseStatsCustomFilterRuntime?.destroy?.();

  let frame = 0;
  let destroyed = false;

  function normalizeLabel(value) {
    return String(value || "").trim().toLowerCase();
  }

  function installStyles() {
    if (document.getElementById("databaseStatsRefinementStyles")) return;
    const style = document.createElement("style");
    style.id = "databaseStatsRefinementStyles";
    style.textContent = `
      #databaseStatsPage #databaseStatsCustomFilter {
        position: fixed !important;
        z-index: 2147483000 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        width: max-content;
        max-width: calc(100vw - 24px);
        margin: 0 !important;
        padding: 10px 11px !important;
        border: 1px solid var(--border, rgba(127, 127, 127, 0.35));
        border-radius: 9px;
        background: var(--surface, #fff);
        color: var(--text, #111);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
      }
      #databaseStatsPage #databaseStatsCustomFilter[hidden] {
        display: none !important;
      }
      #databaseStatsPage #databaseStatsCustomFilter::before {
        content: "";
        position: absolute;
        top: -6px;
        left: var(--database-stats-arrow-left, 50%);
        width: 10px;
        height: 10px;
        border-left: 1px solid var(--border, rgba(127, 127, 127, 0.35));
        border-top: 1px solid var(--border, rgba(127, 127, 127, 0.35));
        background: inherit;
        transform: translateX(-50%) rotate(45deg);
      }
      #databaseStatsPage #databaseStatsCustomFilter.databaseStatsTooltipAbove::before {
        top: auto;
        bottom: -6px;
        transform: translateX(-50%) rotate(225deg);
      }
    `;
    document.head.appendChild(style);
  }

  function customButton() {
    return Array.from(document.querySelectorAll("#databaseStatsOverallFilters .mflStatsFilterButton"))
      .find((button) => normalizeLabel(button.textContent) === "custom") || null;
  }

  function customPanel() {
    return document.querySelector("#databaseStatsCustomFilter");
  }

  function positionCustomPanel() {
    const button = customButton();
    const panel = customPanel();
    if (!button || !panel || panel.hidden) return;

    const buttonRect = button.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 9;
    let left = buttonRect.left + (buttonRect.width - panelRect.width) / 2;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - panelRect.width - viewportPadding));

    const fitsBelow = buttonRect.bottom + gap + panelRect.height <= window.innerHeight - viewportPadding;
    const top = fitsBelow
      ? buttonRect.bottom + gap
      : Math.max(viewportPadding, buttonRect.top - panelRect.height - gap);

    panel.classList.toggle("databaseStatsTooltipAbove", !fitsBelow);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    const arrowLeft = Math.max(10, Math.min(panelRect.width - 10, buttonRect.left + buttonRect.width / 2 - left));
    panel.style.setProperty("--database-stats-arrow-left", `${Math.round(arrowLeft)}px`);
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    installStyles();
    positionCustomPanel();
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  function clickCameFromDatabaseFilters(event) {
    return event.composedPath().some((node) => node instanceof Element && node.id === "databaseStatsOverallFilters");
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const panel = customPanel();
    const clickedFilter = target.closest(".mflStatsFilterButton");
    if (clickedFilter
        && clickCameFromDatabaseFilters(event)
        && normalizeLabel(clickedFilter.textContent) === "custom") {
      requestAnimationFrame(() => {
        const currentPanel = customPanel();
        if (currentPanel) currentPanel.hidden = false;
        positionCustomPanel();
        currentPanel?.querySelector("input")?.focus({ preventScroll: true });
      });
      schedule();
      return;
    }
    if (target.closest("#databaseStatsCustomApply")) {
      requestAnimationFrame(() => {
        const currentPanel = customPanel();
        if (currentPanel) currentPanel.hidden = true;
        schedule();
      });
      return;
    }
    if (panel && !panel.hidden && !panel.contains(target)) {
      panel.hidden = true;
    }
  }

  function onKeyDown(event) {
    const panel = customPanel();
    if (!panel || panel.hidden) return;
    if (event.key === "Enter" && event.target instanceof Element && panel.contains(event.target)) {
      requestAnimationFrame(() => {
        panel.hidden = true;
        schedule();
      });
      return;
    }
    if (event.key !== "Escape") return;
    panel.hidden = true;
    customButton()?.focus({ preventScroll: true });
  }

  installStyles();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  schedule();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    document.getElementById("databaseStatsRefinementStyles")?.remove();
  }

  window.__mflDatabaseStatsCustomFilterRuntime = {
    version: VERSION,
    sync: schedule,
    destroy,
  };
})();
