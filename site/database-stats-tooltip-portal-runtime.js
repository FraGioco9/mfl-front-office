(() => {
  const VERSION = "1.120.6";
  window.__mflDatabaseStatsTooltipPortal?.destroy?.();

  let tooltip = null;
  let frame = 0;
  let observer = null;

  function label(value) {
    return String(value || "").trim().toLowerCase();
  }

  function customButton() {
    return Array.from(document.querySelectorAll("#databaseStatsOverallFilters .mflStatsFilterButton"))
      .find((button) => label(button.textContent) === "custom") || null;
  }

  function ensureStyles() {
    let style = document.getElementById("databaseStatsTooltipPortalStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "databaseStatsTooltipPortalStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      #databaseStatsPage #databaseStatsCustomFilter { display: none !important; }
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

  function apply() {
    const range = normalizedRange();
    const min = document.querySelector("#databaseStatsCustomMin");
    const max = document.querySelector("#databaseStatsCustomMax");
    const applyButton = document.querySelector("#databaseStatsCustomApply");
    if (!(applyButton instanceof HTMLElement)) return;

    if (min) min.value = String(range.min);
    if (max) max.value = String(range.max);
    delete document.documentElement.dataset.databaseStatsCustomDraft;
    applyButton.click();

    const original = document.querySelector("#databaseStatsCustomFilter");
    if (original) original.hidden = true;
    close();
  }

  function portalContains(target) {
    const panel = ensureTooltip();
    return Boolean(panel && !panel.hidden && target instanceof Element && panel.contains(target));
  }

  function stopPortalEvent(event) {
    if (portalContains(event.target)) event.stopImmediatePropagation();
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
      apply();
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
      apply();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
      return;
    }
    event.stopImmediatePropagation();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureStyles();
      const original = document.querySelector("#databaseStatsCustomFilter");
      if (original && !original.hidden) original.hidden = true;
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

  document.addEventListener("click", onClick, true);
  stoppedEvents.forEach((type) => document.addEventListener(type, stopPortalEvent, true));
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", stopPortalEvent, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "class"],
  });
  schedule();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    document.removeEventListener("click", onClick, true);
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
