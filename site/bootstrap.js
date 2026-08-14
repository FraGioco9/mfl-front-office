(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.1";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const EVALUATION_PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
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

  function initialSidebarPage() {
    const first = String(window.location.pathname || "/").split("/").filter(Boolean)[0]?.toLowerCase() || "";
    if (first === "my-players") return "myplayers";
    if (["database", "mfl", "progression", "evaluation", "watchlist", "settings"].includes(first)) return first;
    return "";
  }

  function syncSidebarFirstPaint() {
    const pageName = initialSidebarPage();
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const active = Boolean(pageName) && String(button.dataset.page || "") === pageName;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function installImmediateUiInteractions() {
    if (window.__mflImmediateUiInteractionsInstalled) return;
    window.__mflImmediateUiInteractionsInstalled = true;

    /* Sidebar selection is visual navigation feedback and must happen on the
     * click itself, before cached or uncached route work starts. */
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest?.("#sidebar .navButton[data-page]");
      if (!(button instanceof HTMLElement)) return;

      document.querySelectorAll("#sidebar .navButton[data-page]").forEach((link) => {
        if (!(link instanceof HTMLElement)) return;
        const active = link === button;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }, true);

    /* app-core historically focuses the first Filters field. Clear that focus
     * after its synchronous open handler completes so the popup starts neutral. */
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest?.("#openFiltersButton");
      if (!(trigger instanceof HTMLButtonElement)) return;

      queueMicrotask(() => {
        if (!document.body.classList.contains("filtersOpen")) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      });
    }, true);
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

  function storedEvaluationPlayerLabel(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return "";
    try {
      return String(localStorage.getItem(`${EVALUATION_PLAYER_LABEL_STORAGE_PREFIX}${id}`) || "").trim();
    } catch {
      return "";
    }
  }

  function storeEvaluationPlayerLabel(playerId, playerName) {
    const id = String(playerId || "").trim();
    const name = String(playerName || "").trim();
    if (!id || !name) return;
    try {
      localStorage.setItem(`${EVALUATION_PLAYER_LABEL_STORAGE_PREFIX}${id}`, name);
    } catch {
      // First paint still uses the resolved name when browser storage is blocked.
    }
  }

  function primeEvaluationPlayerLabel(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return;
    const requestUrl = new URL("/api/data", window.location.origin);
    requestUrl.searchParams.set("mode", "search");
    requestUrl.searchParams.set("type", "players");
    requestUrl.searchParams.set("q", id);
    requestUrl.searchParams.set("limit", "5");

    void fetch(requestUrl.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then((response) => response.ok ? response.json() : null).then((payload) => {
      const columns = Array.isArray(payload?.columns) ? payload.columns : [];
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const idIndex = columns.indexOf("player_id");
      const nameIndex = columns.indexOf("name");
      if (idIndex < 0 || nameIndex < 0) return;
      const row = rows.find((candidate) => Array.isArray(candidate) && String(candidate[idIndex]) === id);
      const playerName = String(row?.[nameIndex] || "").trim();
      if (!playerName) return;
      storeEvaluationPlayerLabel(id, playerName);
      if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;
      if (String(new URLSearchParams(window.location.search).get("player") || "").trim() !== id) return;
      const input = document.getElementById("evaluationSearchInput");
      if (!(input instanceof HTMLInputElement)) return;
      const fallback = `Player #${id}`;
      if (!input.value.trim() || input.value === fallback) input.value = playerName;
    }).catch(() => {
      // The normal Evaluation data load will replace the fallback when available.
    });
  }

  function normalizeEvaluationSearchClearButton() {
    const button = document.getElementById("evaluationSearchClearButton");
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.remove("evaluationSearchClearButton");
    button.classList.add("playerSearchClearButton");
  }

  function syncEvaluationActionsFirstPaint() {
    if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;

    const root = document.documentElement;
    const buttons = document.getElementById("evaluationButtons");
    const resetButton = document.getElementById("evaluationResetButton");
    const loadButton = document.getElementById("evaluationLoadButton");
    const playerPageButton = document.getElementById("evaluationPlayerPageButton");
    const searchInput = document.getElementById("evaluationSearchInput");
    const searchClearButton = document.getElementById("evaluationSearchClearButton");
    const params = new URLSearchParams(window.location.search);
    const playerId = String(params.get("player") || "").trim();
    const storedWalletOptIn = root.dataset.storedWalletOptIn === "true";
    const hasInitialSelection = root.dataset.initialEvaluationSelection === "true";

    if (resetButton instanceof HTMLButtonElement) resetButton.hidden = true;
    if (loadButton instanceof HTMLButtonElement) loadButton.hidden = true;
    if (playerPageButton instanceof HTMLButtonElement) playerPageButton.hidden = true;

    if (!(buttons instanceof HTMLElement)) return;

    if (playerId) {
      buttons.hidden = false;
      if (resetButton instanceof HTMLButtonElement) resetButton.hidden = false;
      if (playerPageButton instanceof HTMLButtonElement) playerPageButton.hidden = false;
      if (searchInput instanceof HTMLInputElement && !searchInput.value.trim()) {
        searchInput.value = storedEvaluationPlayerLabel(playerId) || `Player #${playerId}`;
      }
      if (searchClearButton instanceof HTMLButtonElement) searchClearButton.hidden = false;
      primeEvaluationPlayerLabel(playerId);
      return;
    }

    if (!hasInitialSelection && storedWalletOptIn) {
      buttons.hidden = false;
      if (loadButton instanceof HTMLButtonElement) loadButton.hidden = false;
      return;
    }
    buttons.hidden = true;
  }

  const PLAYER_NATIONALITY_CODES = Object.freeze({
    ALBANIA: "AL", ALGERIA: "DZ", ARGENTINA: "AR", AUSTRALIA: "AU", AUSTRIA: "AT",
    BELGIUM: "BE", BOSNIA_AND_HERZEGOVINA: "BA", BRAZIL: "BR", CAMEROON: "CM",
    CANADA: "CA", CAPE_VERDE_ISLANDS: "CV", CHILE: "CL", COLOMBIA: "CO", CONGO_DR: "CD",
    COSTA_RICA: "CR", COTE_D_IVOIRE: "CI", CROATIA: "HR", CURACAO: "CW", CZECH_REPUBLIC: "CZ",
    CZECHIA: "CZ", DENMARK: "DK", ECUADOR: "EC", EGYPT: "EG",
    ENGLAND: "1f3f4-e0067-e0062-e0065-e006e-e0067-e007f", FINLAND: "FI", FRANCE: "FR",
    GEORGIA: "GE", GERMANY: "DE", GHANA: "GH", HAITI: "HT", HUNGARY: "HU", IRAN: "IR",
    IRAQ: "IQ", ITALY: "IT", IVORY_COAST: "CI", JAPAN: "JP", JORDAN: "JO",
    KOREA_REPUBLIC: "KR", MEXICO: "MX", MOROCCO: "MA", NETHERLANDS: "NL", NEW_ZEALAND: "NZ",
    NIGERIA: "NG", NORWAY: "NO", PANAMA: "PA", PARAGUAY: "PY", PERU: "PE", POLAND: "PL",
    PORTUGAL: "PT", QATAR: "QA", REPUBLIC_OF_IRELAND: "IE", ROMANIA: "RO", RUSSIA: "RU",
    SAUDI_ARABIA: "SA", SCOTLAND: "1f3f4-e0067-e0062-e0073-e0063-e0074-e007f", SENEGAL: "SN",
    SERBIA: "RS", SLOVAKIA: "SK", SLOVENIA: "SI", SOUTH_AFRICA: "ZA", SOUTH_KOREA: "KR",
    SPAIN: "ES", SWEDEN: "SE", SWITZERLAND: "CH", TUNISIA: "TN", TURKEY: "TR", UKRAINE: "UA",
    UNITED_KINGDOM: "GB", UNITED_STATES: "US", UNITED_STATES_OF_AMERICA: "US", URUGUAY: "UY",
    USA: "US", UZBEKISTAN: "UZ", WALES: "1f3f4-e0067-e0062-e0077-e006c-e0073-e007f",
  });

  function playerNationalityFlagCodepoints(nationality) {
    const countryKey = String(nationality || "")
      .toUpperCase()
      .replaceAll("&", "AND")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const code = PLAYER_NATIONALITY_CODES[countryKey] || "";
    if (!code) return "";
    return code.includes("-")
      ? code.toLowerCase()
      : code.toUpperCase().split("").map((character) => (127397 + character.charCodeAt(0)).toString(16)).join("-");
  }

  function syncKnownPlayerNationalityFlag() {
    const detail = document.getElementById("playerDetail");
    const loadingGrid = detail?.querySelector?.('[data-mfl-player-loading-grid="true"]');
    if (!(loadingGrid instanceof HTMLElement)) return;

    const nationalityCard = Array.from(loadingGrid.querySelectorAll(".playerInfoPanel .detailGrid > div"))
      .find((card) => String(card.querySelector(":scope > span")?.textContent || "").trim() === "Nationality");
    const value = nationalityCard?.querySelector(":scope > strong");
    if (!(value instanceof HTMLElement) || value.querySelector("img.flagImage")) return;

    const textClone = value.cloneNode(true);
    textClone.querySelectorAll(".flagText, .flagImage").forEach((node) => node.remove());
    const nationality = String(textClone.textContent || "").trim();
    if (!nationality) return;

    const codepoints = playerNationalityFlagCodepoints(nationality);
    if (!codepoints) return;

    const image = document.createElement("img");
    image.className = "flagImage";
    image.src = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg`;
    image.alt = "";
    const placeholder = value.querySelector(".flagText");
    if (placeholder) {
      placeholder.replaceWith(image);
      return;
    }
    value.prepend(document.createTextNode(" "));
    value.prepend(image);
  }

  function installPlayerNationalityFirstPaint() {
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement)) return;
    if (window.__mflPlayerNationalityFirstPaintInstalled) {
      syncKnownPlayerNationalityFlag();
      return;
    }
    window.__mflPlayerNationalityFirstPaintInstalled = true;
    const observer = new MutationObserver(syncKnownPlayerNationalityFlag);
    observer.observe(detail, { childList: true, subtree: true, characterData: true });
    syncKnownPlayerNationalityFlag();
  }

  function syncBootstrapFirstPaint() {
    installImmediateUiInteractions();
    installPlayerNationalityFirstPaint();
    syncSidebarFirstPaint();
    normalizeEvaluationSearchClearButton();
    installEvaluationTableSpacing();
    installPopupContentCentering();
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
  loadBootstrapRuntime("/player-loading-runtime.js");
  loadBootstrapRuntime("/dropdowns-runtime.js");
  loadBootstrapRuntime("/club-squad-route-runtime.js");
  loadBootstrapRuntime("/filter-controls-runtime.js");

  const core = document.createElement("script");
  core.src = "/bootstrap-core.js";
  core.async = false;
  core.addEventListener("load", syncBootstrapFirstPaint, { once: true });
  core.addEventListener("error", () => {
    document.documentElement.dataset.mflReady = "error";
  }, { once: true });
  document.head.appendChild(core);
})();
