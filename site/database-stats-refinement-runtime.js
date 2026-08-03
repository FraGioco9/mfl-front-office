(() => {
  const VERSION = "1.120.2";
  const STATS_ENDPOINT = "/api/database-stats";
  const FILTER_RANGES = new Map([
    ["all", { min: null, max: null }],
    ["ultimate", { min: 95, max: null }],
    ["legendary", { min: 85, max: 94 }],
    ["rare", { min: 75, max: 84 }],
    ["uncommon", { min: 65, max: 74 }],
    ["limited", { min: 55, max: 64 }],
    ["common", { min: null, max: 54 }],
  ]);

  window.__mflDatabaseStatsRefinementRuntime?.destroy?.();

  const originalFetch = window.fetch.bind(window);
  let payload = null;
  let observer = null;
  let frame = 0;
  let destroyed = false;

  function normalizeLabel(value) {
    return String(value || "").trim().toLowerCase();
  }

  function requestUrl(input) {
    try {
      const value = input instanceof Request ? input.url : String(input || "");
      return new URL(value, location.href);
    } catch {
      return null;
    }
  }

  window.fetch = (input, init) => {
    const url = requestUrl(input);
    let forwardedInput = input;
    if (url?.pathname === STATS_ENDPOINT) {
      url.searchParams.set("v", VERSION);
      forwardedInput = input instanceof Request
        ? new Request(url.toString(), input)
        : url.toString();
    }

    const responsePromise = originalFetch(forwardedInput, init);
    if (url?.pathname === STATS_ENDPOINT) {
      void responsePromise
        .then((response) => response.clone().json())
        .then((data) => {
          if (Array.isArray(data?.rows)) {
            payload = data;
            schedule();
          }
        })
        .catch(() => false);
    }
    return responsePromise;
  };

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

  function activeRange() {
    const activeButton = document.querySelector("#databaseStatsOverallFilters .mflStatsFilterButton.active");
    const label = normalizeLabel(activeButton?.textContent);
    if (label === "custom") {
      let min = Number(document.querySelector("#databaseStatsCustomMin")?.value);
      let max = Number(document.querySelector("#databaseStatsCustomMax")?.value);
      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max)) max = 99;
      min = Math.max(0, Math.min(99, Math.trunc(min)));
      max = Math.max(0, Math.min(99, Math.trunc(max)));
      if (min > max) [min, max] = [max, min];
      return { min, max };
    }
    return FILTER_RANGES.get(label) || FILTER_RANGES.get("all");
  }

  function filteredActiveCount() {
    if (!Array.isArray(payload?.rows)) return null;
    const range = activeRange();
    return payload.rows.reduce((total, group) => {
      const overall = Number(group?.[0]);
      const retirementYears = group?.[2];
      const count = Number(group?.[3] || 0);
      if (!Number.isFinite(overall) || retirementYears === 0 || count <= 0) return total;
      if (range.min !== null && overall < range.min) return total;
      if (range.max !== null && overall > range.max) return total;
      return total + count;
    }, 0);
  }

  function syncTotalActivePlayers() {
    const card = document.querySelector("#databaseStatsTotalPlayers")?.closest("article");
    const label = card?.querySelector("span");
    if (label && label.textContent !== "Total active players") {
      label.textContent = "Total active players";
    }

    const count = filteredActiveCount();
    const value = card?.querySelector("strong");
    if (value && count !== null) {
      const formatted = new Intl.NumberFormat("en-US").format(count);
      if (value.textContent !== formatted) value.textContent = formatted;
    }
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    installStyles();
    syncTotalActivePlayers();
    positionCustomPanel();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const panel = customPanel();
    const button = customButton();
    if (button && (target === button || button.contains(target))) {
      requestAnimationFrame(() => {
        positionCustomPanel();
        panel?.querySelector("input")?.focus({ preventScroll: true });
      });
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
    schedule();
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

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["hidden", "class", "data-page"],
  });
  schedule();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.fetch = originalFetch;
    document.getElementById("databaseStatsRefinementStyles")?.remove();
  }

  window.__mflDatabaseStatsRefinementRuntime = {
    version: VERSION,
    sync,
    destroy,
  };
})();
