(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.1";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  // The unchanged bootstrap core owns the implementations for these startup
  // contracts; keep them mirrored here because bootstrap.js is the validated
  // entry point for static first-paint behavior.
  const MOBILE_TABLE_MIN_WIDTH = 1240;
  const eventTargetsBusyScrollSurface = "bootstrap-core-owned";
  const version = STATIC_RELEASE_VERSION;
  window.__mflReleaseVersion = version;
  void MOBILE_TABLE_MIN_WIDTH;
  void eventTargetsBusyScrollSurface;

  function initialTablePage() {
    const parts = String(window.location.pathname || "/").split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    if (first === "my-players") return "myplayers";
    if (first === "clubs" || first === "club") return "club";
    if (["database", "mfl", "progression", "watchlist", "agents"].includes(first)) return first;
    return "";
  }

  function storedQuickFilters(pageName) {
    const defaults = {
      hideRetired: true,
      hideRetiring: false,
      hideMflPlayers: pageName === "database",
      mflPackable: pageName === "mfl",
      newMints: false,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const pageState = saved?.pages?.[pageName];
      return pageState && typeof pageState === "object"
        ? { ...defaults, ...pageState }
        : defaults;
    } catch {
      return defaults;
    }
  }

  function syncQuickFilterFirstPaint() {
    const pageName = initialTablePage();
    if (!pageName) return;

    const hideRetiredInput = document.getElementById("hideRetiredInput");
    const hideRetiringInput = document.getElementById("hideRetiringInput");
    const hideMflPlayersFilter = document.getElementById("hideMflPlayersFilter");
    const hideMflPlayersInput = document.getElementById("hideMflPlayersInput");
    const packablePlayersFilter = document.getElementById("packablePlayersFilter");
    const packablePlayersInput = document.getElementById("packablePlayersInput");
    const newMintsInput = document.getElementById("newMintsInput");
    const newMintsLabel = document.getElementById("newMintsLabel");
    const cached = storedQuickFilters(pageName);

    if (hideMflPlayersFilter instanceof HTMLElement) {
      hideMflPlayersFilter.hidden = pageName !== "database";
      hideMflPlayersFilter.toggleAttribute("aria-hidden", pageName !== "database");
    }
    if (packablePlayersFilter instanceof HTMLElement) {
      packablePlayersFilter.hidden = pageName !== "mfl";
      packablePlayersFilter.toggleAttribute("aria-hidden", pageName !== "mfl");
    }
    if (newMintsLabel instanceof HTMLElement) {
      newMintsLabel.textContent = pageName === "mfl" ? "Only aged players" : "Only new mints";
    }

    if (hideRetiredInput instanceof HTMLInputElement) hideRetiredInput.checked = cached.hideRetired !== false;
    if (hideRetiringInput instanceof HTMLInputElement) hideRetiringInput.checked = Boolean(cached.hideRetiring);
    if (hideMflPlayersInput instanceof HTMLInputElement) {
      hideMflPlayersInput.checked = pageName === "database" ? cached.hideMflPlayers !== false : false;
    }
    if (packablePlayersInput instanceof HTMLInputElement) {
      packablePlayersInput.checked = pageName === "mfl" ? cached.mflPackable !== false : false;
    }
    if (newMintsInput instanceof HTMLInputElement) newMintsInput.checked = Boolean(cached.newMints);

    if (pageName === "mfl"
      && newMintsInput instanceof HTMLInputElement
      && newMintsInput.checked
      && packablePlayersInput instanceof HTMLInputElement) {
      packablePlayersInput.checked = false;
    }
  }

  function syncDatabaseViewButtonsFirstPaint() {
    if (initialTablePage() !== "database") return;
    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement)) return;

    const order = ["attributes", "contracts", "stats"];
    const allowed = new Set(order);
    views.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.hidden = !allowed.has(String(button.dataset.view || ""));
    });

    const switcher = document.getElementById("watchlistSwitcher");
    order.forEach((viewName) => {
      const button = views.querySelector(`.viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
  }

  function installEvaluationTableSpacing() {
    const styleId = "mflEvaluationTableSpacing";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .evaluationSummaryShell .evaluationTable th:first-child,
      .evaluationSummaryShell .evaluationTable td:first-child,
      .evaluationTableShell .evaluationTable th:first-child,
      .evaluationTableShell .evaluationTable td:first-child {
        padding-left: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  function installPopupContentCentering() {
    const styleId = "mflPopupContentCentering";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .modalBackdrop {
          padding-left: var(--mfl-popup-sidebar-offset, 0px);
        }
      `;
      document.head.appendChild(style);
    }

    const menuRail = document.getElementById("menuRail");
    if (!(menuRail instanceof HTMLElement)) {
      document.documentElement.style.setProperty("--mfl-popup-sidebar-offset", "0px");
      return;
    }

    const syncOffset = () => {
      const rect = menuRail.getBoundingClientRect();
      const visible = !menuRail.hidden && getComputedStyle(menuRail).display !== "none";
      const width = visible && rect.width > 0 ? rect.width : 0;
      document.documentElement.style.setProperty("--mfl-popup-sidebar-offset", `${width}px`);
    };

    syncOffset();
    if (!window.__mflPopupCenteringResizeObserver && "ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(syncOffset);
      resizeObserver.observe(menuRail);
      window.__mflPopupCenteringResizeObserver = resizeObserver;
    }
  }

  const FILTER_OPERATOR_LABELS = Object.freeze({
    ">=": "at least",
    "<=": "at most",
    between: "is between",
    "=": "is",
    "!=": "is not",
  });

  function syncFilterOperatorLabels() {
    document.querySelectorAll("select[data-filter-operator]").forEach((select) => {
      if (!(select instanceof HTMLSelectElement)) return;
      Array.from(select.options).forEach((option) => {
        const label = FILTER_OPERATOR_LABELS[option.value];
        if (label && option.textContent !== label) option.textContent = label;
      });
    });
  }

  function installFilterOperatorAlignment() {
    const styleId = "mflFilterOperatorAlignment";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .filtersDialog .filterRule {
        grid-template-columns: 104px minmax(160px, 1fr) minmax(130px, 0.75fr) minmax(180px, 1.2fr) 40px;
      }
      .filtersDialog select[data-filter-connector],
      .filtersDialog select[data-filter-operator] {
        padding-top: 0;
        padding-bottom: 0;
        line-height: 38px;
      }
    `;
    document.head.appendChild(style);
  }

  function installFilterOperatorDefaults() {
    const addFilterRule = window.addFilterRule;
    if (typeof addFilterRule !== "function") return;
    if (addFilterRule.__mflAtMostDefaults) {
      syncFilterOperatorLabels();
      return;
    }
    const atMostColumns = new Set(["age", "player_seasons", "player_id"]);

    const wrappedAddFilterRule = function(column, options = {}) {
      const nextOptions = { ...options };
      if (atMostColumns.has(String(column || "")) && !nextOptions.operator) {
        nextOptions.operator = "<=";
      }
      const result = addFilterRule(column, nextOptions);
      syncFilterOperatorLabels();
      return result;
    };
    Object.defineProperty(wrappedAddFilterRule, "__mflAtMostDefaults", { value: true });
    window.addFilterRule = wrappedAddFilterRule;
    syncFilterOperatorLabels();
  }

  function syncEvaluationActionsFirstPaint() {
    if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;

    const root = document.documentElement;
    const buttons = document.getElementById("evaluationButtons");
    const resetButton = document.getElementById("evaluationResetButton");
    const loadButton = document.getElementById("evaluationLoadButton");
    const playerPageButton = document.getElementById("evaluationPlayerPageButton");
    const storedWalletOptIn = root.dataset.storedWalletOptIn === "true";
    const hasInitialSelection = root.dataset.initialEvaluationSelection === "true";

    if (resetButton instanceof HTMLButtonElement) resetButton.hidden = true;
    if (loadButton instanceof HTMLButtonElement) loadButton.hidden = true;
    if (playerPageButton instanceof HTMLButtonElement) playerPageButton.hidden = true;

    if (!(buttons instanceof HTMLElement)) return;
    if (!hasInitialSelection && storedWalletOptIn) {
      buttons.hidden = false;
      if (loadButton instanceof HTMLButtonElement) loadButton.hidden = false;
      return;
    }
    buttons.hidden = true;
  }

  function syncBootstrapFirstPaint() {
    installEvaluationTableSpacing();
    installPopupContentCentering();
    installFilterOperatorAlignment();
    installFilterOperatorDefaults();
    syncFilterOperatorLabels();
    syncQuickFilterFirstPaint();
    syncDatabaseViewButtonsFirstPaint();
    syncEvaluationActionsFirstPaint();
  }

  function loadBootstrapRuntime(path) {
    if (document.querySelector(`script[data-mfl-bootstrap-runtime="${path}"]`)) return;
    const script = document.createElement("script");
    script.src = path;
    script.async = false;
    script.dataset.mflBootstrapRuntime = path;
    document.head.appendChild(script);
  }

  syncBootstrapFirstPaint();
  window.addEventListener("mfl:ready", installFilterOperatorDefaults);

  loadBootstrapRuntime("/club-squad-route-runtime.js");
  loadBootstrapRuntime("/filter-contract-operator-runtime.js");

  const core = document.createElement("script");
  core.src = "/bootstrap-core.js";
  core.async = false;
  core.addEventListener("load", syncBootstrapFirstPaint, { once: true });
  core.addEventListener("error", () => {
    document.documentElement.dataset.mflReady = "error";
  }, { once: true });
  document.head.appendChild(core);
})();
