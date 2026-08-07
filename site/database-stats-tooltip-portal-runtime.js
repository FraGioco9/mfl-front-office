(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.123.11");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  window.__mflDatabaseStatsTooltipPortal?.destroy?.();

  let tooltip = null;
  let frame = 0;
  let applyAnimationTimer = 0;
  let pendingApplyAnimation = false;
  let previousHistogram = null;

  function label(value) {
    return String(value || "").trim().toLowerCase();
  }

  function customButton() {
    return Array.from(document.querySelectorAll("#databaseStatsOverallFilters .mflStatsFilterButton"))
      .find((button) => label(button.textContent) === "custom") || null;
  }

  function currentHistogram() {
    return document.querySelector("#databaseStatsDistribution .mflStatsHistogram");
  }

  function keepStatsPageVisible() {
    if (!STATS_PATH.test(location.pathname)) return;
    window.setDatabaseStatsPageVisibility?.(true);
    if (document.body?.dataset.page !== "databasestats") document.body.dataset.page = "databasestats";
  }

  function clearApplyAnimation(cancelPending = true) {
    if (applyAnimationTimer) {
      window.clearTimeout(applyAnimationTimer);
      applyAnimationTimer = 0;
    }
    document.querySelectorAll("#databaseStatsPage .mflStatsHistogram[data-database-stats-apply-transition]")
      .forEach((histogram) => histogram.removeAttribute("data-database-stats-apply-transition"));
    document.querySelectorAll("#databaseStatsPage .mflStatsHistogram.databaseStatsAnimate")
      .forEach((histogram) => histogram.classList.remove("databaseStatsAnimate"));
    if (cancelPending) {
      pendingApplyAnimation = false;
      previousHistogram = null;
    }
  }

  function ensureStyles() {
    if (document.getElementById("databaseStatsTooltipPortalStyles")) return;
    const style = document.createElement("style");
    style.id = "databaseStatsTooltipPortalStyles";
    style.textContent = `
      #databaseStatsPage #databaseStatsCustomFilter { display: none !important; }
      #databaseStatsPage .mflStatsHistogramBar,
      #databaseStatsPage .mflStatsHistogramBar::after {
        animation: none !important;
        transition: none !important;
      }
      #databaseStatsPage .mflStatsHistogram[data-database-stats-apply-transition="true"] .mflStatsHistogramBar::after {
        animation: mflStatsBarRise 220ms ease-out !important;
      }
      #databaseStatsCustomTooltipPortal {
        position: fixed;
        z-index: 2147483640;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: max-content;
        max-width: calc(100vw - 24px);
        padding: 10px 11px;
        border: 1px solid var(--border, rgba(127,127,127,.35));
        border-radius: 9px;
        background: var(--surface, #fff);
        color: var(--text, #111);
        box-shadow: 0 12px 30px rgba(0,0,0,.24);
      }
      #databaseStatsCustomTooltipPortal[hidden] { display: none !important; }
      #databaseStatsCustomTooltipPortal::before {
        content: "";
        position: absolute;
        top: -6px;
        left: var(--database-stats-arrow-left, 50%);
        width: 10px;
        height: 10px;
        border-left: 1px solid var(--border, rgba(127,127,127,.35));
        border-top: 1px solid var(--border, rgba(127,127,127,.35));
        background: inherit;
        transform: translateX(-50%) rotate(45deg);
      }
      #databaseStatsCustomTooltipPortal.is-above::before {
        top: auto;
        bottom: -6px;
        transform: translateX(-50%) rotate(225deg);
      }
      #databaseStatsCustomTooltipPortal label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        font-weight: 600;
      }
      #databaseStatsCustomTooltipPortal input {
        width: 62px;
        min-height: 34px;
        padding: 5px 7px;
        border: 1px solid var(--border, rgba(127,127,127,.35));
        border-radius: 7px;
        background: var(--surface, #fff);
        color: var(--text, #111);
        font: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTooltip() {
    if (tooltip?.isConnected) return tooltip;
    if (!document.body) return null;
    tooltip = document.createElement("div");
    tooltip.id = "databaseStatsCustomTooltipPortal";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-label", "Custom Overall filter");
    tooltip.innerHTML = `
      <label>Min <input data-role="min" type="number" inputmode="numeric" min="0" max="99" value="0"></label>
      <label>Max <input data-role="max" type="number" inputmode="numeric" min="0" max="99" value="99"></label>
      <button data-role="apply" class="compactButton" type="button">Apply</button>
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function position() {
    const button = customButton();
    const panel = ensureTooltip();
    if (!button || !panel || panel.hidden) return;
    const buttonRect = button.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const padding = 12;
    const gap = 9;
    let left = buttonRect.left + (buttonRect.width - panelRect.width) / 2;
    left = Math.max(padding, Math.min(left, innerWidth - panelRect.width - padding));
    const below = buttonRect.bottom + gap + panelRect.height <= innerHeight - padding;
    const top = below ? buttonRect.bottom + gap : Math.max(padding, buttonRect.top - panelRect.height - gap);
    panel.classList.toggle("is-above", !below);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    const arrow = Math.max(10, Math.min(panelRect.width - 10, buttonRect.left + buttonRect.width / 2 - left));
    panel.style.setProperty("--database-stats-arrow-left", `${Math.round(arrow)}px`);
  }

  function open() {
    clearApplyAnimation();
    keepStatsPageVisible();
    ensureStyles();
    const panel = ensureTooltip();
    if (!panel) return;
    panel.querySelector('[data-role="min"]').value = document.querySelector("#databaseStatsCustomMin")?.value || "0";
    panel.querySelector('[data-role="max"]').value = document.querySelector("#databaseStatsCustomMax")?.value || "99";
    panel.hidden = false;
    document.documentElement.dataset.databaseStatsCustomDraft = "true";
    position();
    panel.querySelector('[data-role="min"]')?.focus({ preventScroll: true });
  }

  function close(restoreFocus = false) {
    const panel = ensureTooltip();
    if (panel) panel.hidden = true;
    delete document.documentElement.dataset.databaseStatsCustomDraft;
    if (restoreFocus) customButton()?.focus({ preventScroll: true });
  }

  function normalizedRange() {
    const panel = ensureTooltip();
    let min = Number(panel?.querySelector('[data-role="min"]')?.value);
    let max = Number(panel?.querySelector('[data-role="max"]')?.value);
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 99;
    min = Math.max(0, Math.min(99, Math.trunc(min)));
    max = Math.max(0, Math.min(99, Math.trunc(max)));
    if (min > max) [min, max] = [max, min];
    return { min, max };
  }

  function startApplyAnimation(histogram) {
    if (!(histogram instanceof HTMLElement) || document.body?.dataset.page !== "databasestats") return false;
    pendingApplyAnimation = false;
    previousHistogram = null;
    clearApplyAnimation(false);
    histogram.classList.remove("databaseStatsAnimate");
    void histogram.offsetWidth;
    histogram.setAttribute("data-database-stats-apply-transition", "true");
    applyAnimationTimer = window.setTimeout(() => {
      histogram.removeAttribute("data-database-stats-apply-transition");
      histogram.classList.remove("databaseStatsAnimate");
      applyAnimationTimer = 0;
    }, 260);
    return true;
  }

  function resolveApplyAnimation() {
    if (!pendingApplyAnimation) return;
    if (document.body?.dataset.page !== "databasestats") {
      clearApplyAnimation();
      return;
    }
    const histogram = currentHistogram();
    if (!(histogram instanceof HTMLElement) || histogram === previousHistogram) return;
    startApplyAnimation(histogram);
  }

  function apply(animate = true) {
    const range = normalizedRange();
    const min = document.querySelector("#databaseStatsCustomMin");
    const max = document.querySelector("#databaseStatsCustomMax");
    const applyButton = document.querySelector("#databaseStatsCustomApply");
    if (!(applyButton instanceof HTMLElement)) return;

    clearApplyAnimation();
    previousHistogram = animate ? currentHistogram() : null;
    pendingApplyAnimation = animate;
    if (min) min.value = String(range.min);
    if (max) max.value = String(range.max);
    delete document.documentElement.dataset.databaseStatsCustomDraft;
    applyButton.click();
    keepStatsPageVisible();

    const renderedHistogram = currentHistogram();
    if (animate && renderedHistogram instanceof HTMLElement && renderedHistogram !== previousHistogram) {
      startApplyAnimation(renderedHistogram);
    } else if (!animate) {
      clearApplyAnimation();
    }

    const original = document.querySelector("#databaseStatsCustomFilter");
    if (original) original.hidden = true;
    close();
    schedule();
  }

  function portalContains(target) {
    const panel = ensureTooltip();
    return Boolean(panel && !panel.hidden && target instanceof Element && panel.contains(target));
  }

  function stopPortalEvent(event) {
    if (!portalContains(event.target)) return;
    clearApplyAnimation();
    document.documentElement.dataset.databaseStatsCustomDraft = "true";
    keepStatsPageVisible();
    event.stopImmediatePropagation();
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const filter = target.closest("#databaseStatsOverallFilters .mflStatsFilterButton");
    if (filter && label(filter.textContent) === "custom") {
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
      return;
    }

    if (target.closest('#databaseStatsCustomTooltipPortal [data-role="apply"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      apply(true);
      return;
    }

    if (portalContains(target)) {
      event.stopImmediatePropagation();
      return;
    }

    const panel = ensureTooltip();
    if (panel && !panel.hidden) close();
  }

  function onKeyDown(event) {
    const panel = ensureTooltip();
    if (!panel || panel.hidden || !(event.target instanceof Element) || !panel.contains(event.target)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      apply(false);
      return;
    }
    clearApplyAnimation();
    keepStatsPageVisible();
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
      return;
    }
    event.stopImmediatePropagation();
  }

  function onGlobalPointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || portalContains(target)) return;
    if (target.closest("a[href], .navButton, [data-page], [data-view]")) {
      clearApplyAnimation();
    }
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureStyles();
      keepStatsPageVisible();
      const original = document.querySelector("#databaseStatsCustomFilter");
      if (original && !original.hidden) original.hidden = true;
      if (document.body?.dataset.page !== "databasestats") clearApplyAnimation();
      else resolveApplyAnimation();
      position();
    });
  }

  const stoppedEvents = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "beforeinput",
    "input",
    "change",
    "wheel",
  ];

  ensureStyles();
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onGlobalPointerDown, true);
  stoppedEvents.forEach((type) => document.addEventListener(type, stopPortalEvent, true));
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", stopPortalEvent, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  schedule();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    clearApplyAnimation();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerdown", onGlobalPointerDown, true);
    stoppedEvents.forEach((type) => document.removeEventListener(type, stopPortalEvent, true));
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keyup", stopPortalEvent, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    tooltip?.remove();
    delete document.documentElement.dataset.databaseStatsCustomDraft;
    document.getElementById("databaseStatsTooltipPortalStyles")?.remove();
  }

  window.__mflDatabaseStatsTooltipPortal = { version: VERSION, destroy, open };
})();
