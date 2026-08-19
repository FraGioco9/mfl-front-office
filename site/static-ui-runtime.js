(() => {
  "use strict";

  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    squad: "attributes",
    stats: "stats",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const STATIC_TABLE_BASE_COLUMNS = Object.freeze([
    "player_id", "nationality_flag", "name", "nationality", "age", "positions", "player_seasons",
  ]);
  const STATIC_TABLE_STAT_COLUMNS = Object.freeze([
    "overall", "pace", "shooting", "passing", "dribbling", "defense", "physical",
  ]);
  const STATIC_TABLE_CONTRACT_COLUMNS = Object.freeze([
    "overall", "active_contract_club_name", "active_contract_club_division", "active_contract_revenue_share",
  ]);
  const STATIC_TABLE_VIEW_COLUMNS = Object.freeze({
    attributes: Object.freeze([...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
    current: Object.freeze([...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
    all: Object.freeze([...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
    next: Object.freeze([...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"]),
    contracts: Object.freeze([...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_CONTRACT_COLUMNS, "wallet_name", "player_link"]),
  });
  const STATIC_JOINED_AGENCY_PAGES = new Set(["myplayers", "agents", "mfl"]);
  const STATIC_TABLE_SORTABLE_COLUMNS = new Set([
    "player_id", "name", "age", "player_seasons", "owned_since",
    "active_contract_revenue_share", "active_contract_club_division",
    ...STATIC_TABLE_STAT_COLUMNS,
  ]);
  const STATIC_TABLE_COLUMN_LABELS = Object.freeze({
    player_id: "ID",
    nationality_flag: "",
    wallet_name: "Agent",
    owned_since: "Joined Agency",
    name: "Name",
    nationality: "Nationality",
    age: "Age",
    positions: "Positions",
    player_seasons: "Seasons",
    overall: "Overall",
    pace: "Pace",
    shooting: "Shooting",
    passing: "Passing",
    dribbling: "Dribbling",
    defense: "Defense",
    physical: "Physical",
    active_contract_revenue_share: "Rev. Share",
    active_contract_club_name: "Club Name",
    active_contract_club_division: "Division",
    player_link: "",
  });
  const STATIC_TABLE_COLUMN_CLASSES = Object.freeze({
    player_id: "col-id",
    nationality_flag: "col-flag",
    name: "col-name",
    nationality: "col-nationality",
    age: "col-age",
    positions: "col-positions",
    player_seasons: "col-seasons",
    wallet_name: "col-agent",
    owned_since: "col-agent",
    active_contract_revenue_share: "col-contract-revenue",
    active_contract_club_name: "col-contract-club",
    active_contract_club_division: "col-contract-division",
    player_link: "col-link",
  });
  const TOOLTIP_SETTINGS = Object.freeze({
    durationMs: 170,
    gap: 8,
  });
  const SPECIALIZED_TOOLTIP_SELECTOR = [
    ".evaluationMetric.evaluationDiscountRate",
    "#evaluationLoadModal .evaluationLoadIconButton",
    ".playerNoteIcon",
  ].join(", ");

  window.__mflStaticUiRuntime?.destroy?.();
  window.__mflTooltipSettings = TOOLTIP_SETTINGS;

  let destroyed = false;
  let tooltipPortal = null;
  let activeTooltipTarget = null;
  let activeTooltipText = "";
  let activeTooltipHovered = false;
  let activeTooltipFocused = false;
  let tooltipShowFrame = 0;
  let tooltipHideTimer = 0;
  let lastPrimedRouteIdentity = "";

  function tableViewConfig() {
    const configured = window.__mflTableViewConfig;
    return configured && typeof configured === "object" ? configured : {};
  }

  function routeState(urlLike = window.location.href) {
    let url;
    try {
      url = new URL(String(urlLike || window.location.href), window.location.href);
    } catch {
      url = new URL(window.location.href);
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    const page = first === "my-players"
      ? "myplayers"
      : first === "clubs" || first === "club"
        ? "club"
        : ["database", "mfl", "progression", "watchlist", "agents"].includes(first)
          ? first
          : first === "players"
            ? "player"
            : first || "home";
    const requestedView = VIEW_BY_SLUG[String(parts.at(-1) || "").toLowerCase()] || "";
    const config = tableViewConfig()[page];
    const view = config && Array.isArray(config.order) && config.order.includes(requestedView)
      ? requestedView
      : String(config?.fallback || requestedView || "");
    return { page, view, url: url.href };
  }

  function syncFooter() {
    const version = String(window.__mflReleaseVersion || window.__mflRelease?.version || "").trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) return;
    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer instanceof HTMLElement) footer.textContent = `MFL Front Office v${version}`;
    document.querySelectorAll("[data-app-version]").forEach((element) => {
      if (element instanceof HTMLElement) element.textContent = `v${version}`;
    });
  }

  function setActiveNavigation(page) {
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      const buttonPage = String(button.dataset.page || "").toLowerCase();
      button.classList.toggle("active", buttonPage === page);
    });
  }

  function setActiveView(container, view) {
    if (!(container instanceof Element) || !view) return;
    container.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.view || "") === view);
    });
  }

  function syncSharedViewSet(page, view) {
    const config = tableViewConfig()[page];
    if (!config || !Array.isArray(config.order)) return;
    const container = document.querySelector("#progressionPage .views");
    if (!(container instanceof HTMLElement)) return;

    const buttons = new Map();
    container.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      const buttonView = String(button.dataset.view || "");
      buttons.set(buttonView, button);
      button.hidden = !config.order.includes(buttonView);
      if (buttonView === "attributes" && button instanceof HTMLButtonElement) {
        button.textContent = page === "club" ? "Squad" : "Attributes";
      }
    });

    const switcher = document.getElementById("watchlistSwitcher");
    config.order.forEach((buttonView) => {
      const button = buttons.get(buttonView);
      if (!(button instanceof HTMLElement)) return;
      button.hidden = false;
      container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);
    });

    const activeView = config.order.includes(view)
      ? view
      : String(config.fallback || config.order[0] || "");
    setActiveView(container, activeView);
  }

  function syncStatsViews(page, view) {
    if (page === "database" && view === "stats") setActiveView(document.querySelector("#databaseStatsPage .views"), "stats");
    if (page === "mfl" && view === "stats") setActiveView(document.querySelector("#mflStatsPage .views"), "stats");
  }

  function syncTableViews(page, view) {
    syncSharedViewSet(String(page || ""), String(view || ""));
    syncStatsViews(String(page || ""), String(view || ""));
  }

  function routeNeedsLockedShell(page) {
    return document.documentElement.dataset.storedWalletOptIn !== "true"
      && ["watchlist", "myplayers", "settings"].includes(page);
  }

  function shellForRoute(state) {
    if (routeNeedsLockedShell(state.page)) return document.getElementById("myPlayersLockedPage");
    if (state.page === "database" && state.view === "stats") return document.getElementById("databaseStatsPage");
    if (state.page === "mfl" && state.view === "stats") return document.getElementById("mflStatsPage");
    if (tableViewConfig()[state.page]) return document.getElementById("progressionPage");
    if (state.page === "evaluation") return document.getElementById("evaluationPage");
    if (state.page === "player") return document.getElementById("playerPage");
    if (state.page === "settings") return document.getElementById("settingsPage");
    if (state.page === "changelog") return document.getElementById("changelogPage");
    return document.getElementById("homePage");
  }

  function staticTableDisplayColumn(page, column) {
    return column === "wallet_name" && STATIC_JOINED_AGENCY_PAGES.has(page) ? "owned_since" : column;
  }

  function staticTableColumns(page, view) {
    const source = STATIC_TABLE_VIEW_COLUMNS[view] || STATIC_TABLE_VIEW_COLUMNS.attributes;
    return source.map((column) => staticTableDisplayColumn(page, column));
  }

  function staticTableColumnClass(column) {
    if (column === "overall") return "col-stat col-overall";
    if (STATIC_TABLE_STAT_COLUMNS.includes(column)) return "col-stat";
    return STATIC_TABLE_COLUMN_CLASSES[column] || "";
  }

  function staticTableSortState(route) {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const pageState = saved?.pages?.[route.page];
      const viewState = pageState?.viewSortStates?.[route.view] || pageState || null;
      const savedSortKey = String(viewState?.sortKey || "");
      const savedSortDirection = String(viewState?.sortDirection || "");
      if (STATIC_TABLE_SORTABLE_COLUMNS.has(savedSortKey)) {
        return {
          sortKey: savedSortKey,
          sortDirection: savedSortDirection === "asc" ? "asc" : "desc",
        };
      }
    } catch {
      // Use canonical defaults when storage is unavailable.
    }

    if (route.page === "club") return { sortKey: "positions", sortDirection: "asc" };
    return { sortKey: "overall", sortDirection: route.view === "next" ? "asc" : "desc" };
  }

  function tryCanonicalTableHeader(signature) {
    const contracts = Reflect.get(window, "__mflCoreContracts");
    const ensureHeader = contracts && typeof contracts === "object"
      ? contracts.ensureCanonicalTableHeader
      : null;
    if (typeof ensureHeader !== "function" || !ensureHeader()) return false;
    const head = document.getElementById("tableHead");
    return head instanceof HTMLTableSectionElement
      && Boolean(head.rows[0])
      && head.dataset.mflStaticHeader !== "true"
      && head.dataset.mflHeaderSignature === signature;
  }

  function primeStaticTableHeader(route) {
    const head = document.getElementById("tableHead");
    const colGroup = document.getElementById("tableColGroup");
    if (!(head instanceof HTMLTableSectionElement) || !(colGroup instanceof HTMLTableColElement)) return false;

    const columns = staticTableColumns(route.page, route.view);
    const sort = staticTableSortState(route);
    const signature = [route.page, route.view, sort.sortKey, sort.sortDirection].join("|");
    if (head.rows[0] && head.dataset.mflHeaderSignature === signature && head.dataset.mflStaticHeader !== "true") {
      return true;
    }
    if (tryCanonicalTableHeader(signature)) return true;
    if (head.rows[0] && head.dataset.mflHeaderSignature === signature && head.dataset.mflStaticHeader === "true") return true;

    const headerRow = document.createElement("tr");
    const selectionHeader = document.createElement("th");
    selectionHeader.className = "selectionCell";
    const selectionInput = document.createElement("input");
    selectionInput.id = "selectVisiblePlayersInput";
    selectionInput.type = "checkbox";
    selectionInput.setAttribute("aria-label", "Select visible players");
    selectionHeader.appendChild(selectionInput);
    headerRow.appendChild(selectionHeader);

    columns.forEach((column) => {
      const cell = document.createElement("th");
      const columnClass = staticTableColumnClass(column);
      if (columnClass) cell.classList.add(...columnClass.split(" "));
      const label = document.createElement("span");
      label.textContent = STATIC_TABLE_COLUMN_LABELS[column] || "";
      cell.appendChild(label);
      if (STATIC_TABLE_SORTABLE_COLUMNS.has(column)) {
        cell.classList.add("sortable");
        if (sort.sortKey === column) {
          const arrow = document.createElement("span");
          arrow.className = `sortArrow ${sort.sortDirection}`;
          arrow.setAttribute("aria-hidden", "true");
          cell.appendChild(arrow);
        }
      }
      headerRow.appendChild(cell);
    });

    const targetClasses = ["col-select", ...columns.map((column) => staticTableColumnClass(column))];
    const existingCols = Array.from(colGroup.children);
    const alreadyCanonical = existingCols.length === targetClasses.length
      && existingCols.every((col, index) => col.className === targetClasses[index]);
    if (!alreadyCanonical) {
      const columnFragment = document.createDocumentFragment();
      targetClasses.forEach((columnClass) => {
        const col = document.createElement("col");
        if (columnClass) col.classList.add(...columnClass.split(" "));
        columnFragment.appendChild(col);
      });
      colGroup.replaceChildren(columnFragment);
    }

    head.replaceChildren(headerRow);
    head.dataset.mflHeaderSignature = signature;
    head.dataset.mflStaticHeader = "true";
    return true;
  }

  function syncDestinationTableChrome(state) {
    const prime = Reflect.get(window, "__mflPrimeTableChrome");
    if (typeof prime === "function") prime(state.page, state.url || window.location.href);
    primeStaticTableHeader(state);
  }

  function routeIdentity(state) {
    try {
      const url = new URL(String(state.url || window.location.href), window.location.href);
      return `${state.page}|${state.view}|${url.pathname}${url.search}`;
    } catch {
      return `${state.page}|${state.view}|${window.location.pathname}${window.location.search}`;
    }
  }

  function primePlayerStaticLabels(target) {
    if (!(target instanceof HTMLElement) || target.id !== "playerPage") return;
    const profileLabels = ["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract"];
    const profileCards = Array.from(target.querySelectorAll(".playerInfoPanel .detailGrid > div"));
    profileCards.slice(profileLabels.length).forEach((card) => card.remove());
    profileCards.slice(0, profileLabels.length).forEach((card, index) => {
      const label = card.querySelector("span");
      if (label instanceof HTMLElement) label.textContent = profileLabels[index];
      if (index === profileLabels.length - 1) card.classList.add("contractDetailCard");
    });

    const attributeLabels = ["Overall", "Pace", "Shooting", "Passing", "Dribbling", "Defense", "Physical"];
    Array.from(target.querySelectorAll(".attributesPanel .attributeGrid > .playerAttributeCard")).forEach((card, index) => {
      const label = card.querySelector("span");
      if (label instanceof HTMLElement && attributeLabels[index]) label.textContent = attributeLabels[index];
    });
  }

  function primeDestinationRouteShell(state, target) {
    const identity = routeIdentity(state);
    if (target.id === "progressionPage") {
      if (identity !== lastPrimedRouteIdentity) {
        const primeRows = Reflect.get(window, "__mflPrimeTableRows");
        if (typeof primeRows === "function") primeRows(true);
      }
      lastPrimedRouteIdentity = identity;
      return;
    }
    if (identity === lastPrimedRouteIdentity) return;
    const prime = Reflect.get(window, "__mflPrimeRouteSkeleton");
    if (typeof prime === "function") prime(target);
    primePlayerStaticLabels(target);
    lastPrimedRouteIdentity = identity;
  }

  function showRouteShell(state) {
    const target = shellForRoute(state);
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "progressionPage") syncDestinationTableChrome(state);
    primeDestinationRouteShell(state, target);

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
  }

  function syncRouteChrome(urlLike = window.location.href) {
    const state = routeState(urlLike);
    syncFooter();
    setActiveNavigation(state.page);
    syncTableViews(state.page, state.view);
    showRouteShell(state);
    return state;
  }

  function tooltipTargetFrom(target) {
    if (!(target instanceof Element)) return null;
    const tooltipTarget = target.closest("[data-tooltip]");
    if (!(tooltipTarget instanceof HTMLElement) || tooltipTarget.matches(SPECIALIZED_TOOLTIP_SELECTOR)) return null;
    return tooltipTarget;
  }

  function ensureTooltipPortal() {
    if (tooltipPortal?.isConnected) return tooltipPortal;
    if (!document.body) return null;
    tooltipPortal = document.createElement("div");
    tooltipPortal.id = "mflGlobalTooltip";
    tooltipPortal.className = "floatingActionTooltip mflGlobalTooltip";
    tooltipPortal.setAttribute("role", "tooltip");
    tooltipPortal.hidden = true;
    document.body.appendChild(tooltipPortal);
    return tooltipPortal;
  }

  function cancelTooltipMotion() {
    if (tooltipShowFrame) cancelAnimationFrame(tooltipShowFrame);
    tooltipShowFrame = 0;
    if (tooltipHideTimer) window.clearTimeout(tooltipHideTimer);
    tooltipHideTimer = 0;
  }

  function positionTooltipPortal() {
    if (!(tooltipPortal instanceof HTMLElement) || !(activeTooltipTarget instanceof HTMLElement)) return;
    const anchor = activeTooltipTarget.getBoundingClientRect();
    const tooltip = tooltipPortal.getBoundingClientRect();
    const gap = TOOLTIP_SETTINGS.gap;
    let top = anchor.top - tooltip.height - gap;
    if (top < 8) top = anchor.bottom + gap;
    const left = Math.min(
      window.innerWidth - tooltip.width - 8,
      Math.max(8, anchor.left + (anchor.width - tooltip.width) / 2),
    );
    tooltipPortal.style.left = `${Math.round(left)}px`;
    tooltipPortal.style.top = `${Math.round(top)}px`;
  }

  function restoreActiveTooltipAttribute() {
    if (!(activeTooltipTarget instanceof HTMLElement) || !activeTooltipText) return;
    activeTooltipTarget.dataset.tooltip = activeTooltipText;
    activeTooltipTarget.removeAttribute("aria-describedby");
  }

  function finishTooltipHide(portal) {
    if (tooltipPortal !== portal) return;
    portal.hidden = true;
    portal.classList.remove("visible", "tooltipHiding");
    portal.textContent = "";
    tooltipHideTimer = 0;
  }

  function hideGlobalTooltip({ restore = true, immediate = false } = {}) {
    if (restore) restoreActiveTooltipAttribute();
    activeTooltipTarget = null;
    activeTooltipText = "";
    activeTooltipHovered = false;
    activeTooltipFocused = false;
    if (!(tooltipPortal instanceof HTMLElement)) return;

    cancelTooltipMotion();
    const portal = tooltipPortal;
    portal.classList.remove("visible");
    if (immediate) {
      finishTooltipHide(portal);
      return;
    }
    portal.classList.add("tooltipHiding");
    tooltipHideTimer = window.setTimeout(() => finishTooltipHide(portal), TOOLTIP_SETTINGS.durationMs);
  }

  function showGlobalTooltip(target, mode) {
    if (!(target instanceof HTMLElement)) return;
    if (target !== activeTooltipTarget) {
      hideGlobalTooltip({ immediate: true });
      const text = String(target.dataset.tooltip || "").trim();
      if (!text) return;
      const portal = ensureTooltipPortal();
      if (!portal) return;
      cancelTooltipMotion();
      activeTooltipTarget = target;
      activeTooltipText = text;
      target.removeAttribute("data-tooltip");
      target.setAttribute("aria-describedby", portal.id);
      portal.textContent = text;
      portal.hidden = false;
      portal.classList.remove("tooltipHiding");
      positionTooltipPortal();
      tooltipShowFrame = requestAnimationFrame(() => {
        tooltipShowFrame = 0;
        if (destroyed || tooltipPortal !== portal || activeTooltipTarget !== target) return;
        portal.classList.add("visible");
        positionTooltipPortal();
      });
    }
    if (mode === "hover") activeTooltipHovered = true;
    if (mode === "focus") activeTooltipFocused = true;
    positionTooltipPortal();
  }

  function onTooltipPointerOver(event) {
    if (activeTooltipTarget instanceof HTMLElement && activeTooltipTarget.contains(event.target)) {
      activeTooltipHovered = true;
      return;
    }
    const target = tooltipTargetFrom(event.target);
    if (target) showGlobalTooltip(target, "hover");
  }

  function onTooltipPointerOut(event) {
    if (!(activeTooltipTarget instanceof HTMLElement) || !activeTooltipTarget.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && activeTooltipTarget.contains(event.relatedTarget)) return;
    activeTooltipHovered = false;
    if (!activeTooltipFocused) hideGlobalTooltip();
  }

  function onTooltipFocusIn(event) {
    if (activeTooltipTarget instanceof HTMLElement && activeTooltipTarget.contains(event.target)) {
      activeTooltipFocused = true;
      return;
    }
    const target = tooltipTargetFrom(event.target);
    if (target) showGlobalTooltip(target, "focus");
  }

  function onTooltipFocusOut(event) {
    if (!(activeTooltipTarget instanceof HTMLElement) || !activeTooltipTarget.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && activeTooltipTarget.contains(event.relatedTarget)) return;
    activeTooltipFocused = false;
    if (!activeTooltipHovered) hideGlobalTooltip();
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    hideGlobalTooltip();
    queueMicrotask(() => {
      if (destroyed) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
    });
  }

  function onPopState() {
    hideGlobalTooltip({ immediate: true });
    syncRouteChrome(window.location.href);
  }

  function sync() {
    syncRouteChrome(window.location.href);
  }

  function destroy() {
    destroyed = true;
    hideGlobalTooltip({ immediate: true });
    cancelTooltipMotion();
    tooltipPortal?.remove();
    tooltipPortal = null;
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerover", onTooltipPointerOver, true);
    document.removeEventListener("pointerout", onTooltipPointerOut, true);
    document.removeEventListener("focusin", onTooltipFocusIn, true);
    document.removeEventListener("focusout", onTooltipFocusOut, true);
    window.removeEventListener("resize", positionTooltipPortal);
    window.removeEventListener("scroll", positionTooltipPortal, true);
    window.removeEventListener("popstate", onPopState);
  }

  syncRouteChrome(window.location.href);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerover", onTooltipPointerOver, true);
  document.addEventListener("pointerout", onTooltipPointerOut, true);
  document.addEventListener("focusin", onTooltipFocusIn, true);
  document.addEventListener("focusout", onTooltipFocusOut, true);
  window.addEventListener("resize", positionTooltipPortal);
  window.addEventListener("scroll", positionTooltipPortal, true);
  window.addEventListener("popstate", onPopState);

  window.__mflStaticUiRuntime = Object.freeze({ sync, syncTableViews, destroy });
})();