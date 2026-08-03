(() => {
  const VERSION = "1.120.3";
  window.__mflDatabaseStatsTooltipPortal?.destroy?.();

  let tooltip = null;
  let allowOriginalCustomClick = false;
  let frame = 0;

  function label(value) {
    return String(value || "").trim().toLowerCase();
  }

  function customButton() {
    return Array.from(document.querySelectorAll("#databaseStatsOverallFilters .mflStatsFilterButton"))
      .find((button) => label(button.textContent) === "custom") || null;
  }

  function ensureStyles() {
    if (document.getElementById("databaseStatsTooltipPortalStyles")) return;
    const style = document.createElement("style");
    style.id = "databaseStatsTooltipPortalStyles";
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
    document.head.appendChild(style);
  }

  function ensureTooltip() {
    if (tooltip?.isConnected) return tooltip;
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
    if (!button || panel.hidden) return;
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
    panel.querySelector('[data-role="min"]').value = document.querySelector("#databaseStatsCustomMin")?.value || "0";
    panel.querySelector('[data-role="max"]').value = document.querySelector("#databaseStatsCustomMax")?.value || "99";
    panel.hidden = false;
    position();
    panel.querySelector('[data-role="min"]')?.focus({ preventScroll: true });
  }

  function close(restoreFocus = false) {
    const panel = ensureTooltip();
    panel.hidden = true;
    if (restoreFocus) customButton()?.focus({ preventScroll: true });
  }

  function normalizedRange() {
    const panel = ensureTooltip();
    let min = Number(panel.querySelector('[data-role="min"]')?.value);
    let max = Number(panel.querySelector('[data-role="max"]')?.value);
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 99;
    min = Math.max(0, Math.min(99, Math.trunc(min)));
    max = Math.max(0, Math.min(99, Math.trunc(max)));
    if (min > max) [min, max] = [max, min];
    return { min, max };
  }

  function apply() {
    const range = normalizedRange();
    const button = customButton();
    if (!button) return;
    allowOriginalCustomClick = true;
    try { button.click(); } finally { allowOriginalCustomClick = false; }
    const min = document.querySelector("#databaseStatsCustomMin");
    const max = document.querySelector("#databaseStatsCustomMax");
    if (min) min.value = String(range.min);
    if (max) max.value = String(range.max);
    document.querySelector("#databaseStatsCustomApply")?.click();
    const original = document.querySelector("#databaseStatsCustomFilter");
    if (original) original.hidden = true;
    close();
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const filter = target.closest("#databaseStatsOverallFilters .mflStatsFilterButton");
    if (filter && label(filter.textContent) === "custom") {
      if (allowOriginalCustomClick) return;
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
    const panel = ensureTooltip();
    if (!panel.hidden && !panel.contains(target)) close();
  }

  function onKeyDown(event) {
    const panel = ensureTooltip();
    if (panel.hidden) return;
    if (event.key === "Enter" && event.target instanceof Element && panel.contains(event.target)) {
      event.preventDefault();
      apply();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
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

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
  schedule();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    tooltip?.remove();
    document.getElementById("databaseStatsTooltipPortalStyles")?.remove();
  }

  window.__mflDatabaseStatsTooltipPortal = { version: VERSION, destroy, open };
})();
