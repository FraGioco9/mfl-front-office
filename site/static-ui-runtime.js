(() => {
  "use strict";

  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    squad: "attributes",
    stats: "stats",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const TOOLTIP_HEIGHT = 6;
  const MOBILE_TOOLTIP_MEDIA = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");

  function cssDurationMs(propertyName, fallbackMs) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return fallbackMs;
    if (raw.endsWith("ms")) return value;
    if (raw.endsWith("s")) return value * 1000;
    return fallbackMs;
  }

  const TOOLTIP_SETTINGS = Object.freeze({
    durationMs: cssDurationMs("--mfl-motion-tooltip", 170),
  });
  const FILTERED_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "agents", "myplayers"]);
  const SPECIALIZED_TOOLTIP_SELECTOR = [
    ".evaluationMetric.evaluationDiscountRate",
    "#evaluationLoadModal .evaluationLoadIconButton",
    ".playerNoteIcon",
  ].join(", ");
  const NOT_FOUND_KINDS = new Set(["Page", "Club", "Player", "Agent", "Watchlist"]);

  window.__mflStaticUiRuntime?.destroy?.();
  window.__mflTooltipHeight = TOOLTIP_HEIGHT;

  let destroyed = false;
  let tooltipPortal = null;
  let activeTooltipTarget = null;
  let activeTooltipText = "";
  let activeTooltipAttribute = "";
  let activeTooltipHovered = false;
  let activeTooltipFocused = false;
  let tooltipShowFrame = 0;
  let tooltipHideTimer = 0;
  let lastPrimedRouteIdentity = "";
  let lastRoutePage = "";
  let lastRouteView = "";

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

    const canonicalRequest = window.__mflAppConfig?.routes?.canonicalRequest;
    if (typeof canonicalRequest === "function") {
      const request = canonicalRequest(url.pathname);
      const options = request?.options && typeof request.options === "object" ? request.options : {};
      return {
        page: String(request?.pageName || "home"),
        view: String(options.view || ""),
        notFoundKind: String(options.notFoundKind || ""),
        url: url.href,
      };
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
    return { page, view, notFoundKind: "", url: url.href };
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

  function sharedViewOrderMatches(container, orderedButtons) {
    const visibleButtons = Array.from(container.querySelectorAll(":scope > .viewButton[data-view]"))
      .filter((button) => !button.hidden);
    return visibleButtons.length === orderedButtons.length
      && visibleButtons.every((button, index) => button === orderedButtons[index]);
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
      const shouldHide = !config.order.includes(buttonView);
      if (button.hidden !== shouldHide) button.hidden = shouldHide;
      if (buttonView === "attributes" && button instanceof HTMLButtonElement) {
        const label = page === "club" ? "Squad" : "Attributes";
        if (button.textContent !== label) {
          button.textContent = page === "club" ? "Squad" : "Attributes";
        }
      }
    });

    const orderedButtons = config.order
      .map((buttonView) => buttons.get(buttonView))
      .filter((button) => button instanceof HTMLElement);
    const switcher = document.getElementById("watchlistSwitcher");
    const scrollButton = container.querySelector(":scope > .viewsScrollButton");
    const insertionPoint = switcher instanceof HTMLElement && switcher.parentElement === container
      ? switcher
      : scrollButton instanceof HTMLElement
        ? scrollButton
        : null;
    if (!sharedViewOrderMatches(container, orderedButtons)) {
      orderedButtons.forEach((button) => {
        container.insertBefore(button, insertionPoint);
      });
    }

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

  function normalizedNotFoundKind(kind = "Page") {
    const value = String(kind || "Page").trim();
    return NOT_FOUND_KINDS.has(value) ? value : "Page";
  }

  function ensureNotFoundPage(kind = "Page") {
    const normalizedKind = normalizedNotFoundKind(kind);
    let page = document.getElementById("notFoundPage");
    if (!(page instanceof HTMLElement)) {
      page = document.createElement("section");
      page.id = "notFoundPage";
      page.className = "pageView homePage";
      page.hidden = true;
      page.innerHTML = `<h1 id="notFoundTitle">Page not found</h1>
      <button id="notFoundHomeButton" class="homeOptInButton" type="button">Home</button>`;
      const title = page.querySelector("#notFoundTitle");
      if (title instanceof HTMLElement) {
        title.style.justifySelf = "center";
        title.style.fontSize = "44px";
        title.style.textAlign = "center";
      }
      page.querySelector("#notFoundHomeButton")?.addEventListener("click", () => {
        const navigateHome = async () => {
          let setPage = Reflect.get(window, "setPage");
          if (typeof setPage !== "function") {
            const startup = Reflect.get(window, "__mflAppStartPromise");
            if (startup && typeof startup.then === "function") {
              try {
                await startup;
              } catch {
                // Fall through to the document-navigation recovery below.
              }
              setPage = Reflect.get(window, "setPage");
            }
          }
          if (typeof setPage === "function") {
            await setPage("home");
            return;
          }
          window.location.assign("/");
        };
        void navigateHome();
      });
      document.querySelector("main")?.appendChild(page);
    }
    const title = page.querySelector("#notFoundTitle");
    if (title instanceof HTMLElement) title.textContent = `${normalizedKind} not found`;
    return page;
  }

  function routeNeedsLockedShell(page) {
    return document.documentElement.dataset.storedWalletOptIn !== "true"
      && ["watchlist", "myplayers", "settings"].includes(page);
  }

  function shellForRoute(state) {
    if (state.page === "notfound") return ensureNotFoundPage(state.notFoundKind || "Page");
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

  function syncDestinationTableHeader(state) {
    const signatureFor = Reflect.get(window, "__mflPrimeTableHeaderSignature");
    const primeStructure = Reflect.get(window, "__mflPrimeTableStructure");
    if (typeof signatureFor !== "function" || typeof primeStructure !== "function") return false;

    const signature = String(signatureFor(state.page, state.view) || "");
    if (!signature) return false;
    const head = document.getElementById("tableHead");
    if (!(head instanceof HTMLTableSectionElement)) return false;
    const headerMatches = () => Boolean(head.rows[0]) && head.dataset.mflHeaderSignature === signature;
    if (headerMatches() && head.dataset.mflStaticHeader !== "true") return true;

    const contracts = Reflect.get(window, "__mflCoreContracts");
    const ensureHeader = contracts && typeof contracts === "object"
      ? contracts.ensureCanonicalTableHeader
      : null;
    if (typeof ensureHeader === "function" && ensureHeader()) {
      if (headerMatches() && head.dataset.mflStaticHeader !== "true") return true;
    }
    if (headerMatches()) return true;
    return Boolean(primeStructure(state.page, state.view));
  }

  function syncDestinationTableChrome(state, options = {}) {
    const prime = Reflect.get(window, "__mflPrimeTableChrome");
    if (typeof prime === "function") prime(state.page, state.url || window.location.href, options);
    syncDestinationTableHeader(state);
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

  function showRouteShell(state, options = {}) {
    const target = shellForRoute(state);
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "progressionPage") syncDestinationTableChrome(state, options);
    if (target.id !== "notFoundPage") primeDestinationRouteShell(state, target);

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
    if (target.id === "progressionPage") window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
  }

  function showNotFound(kind = "Page") {
    hideGlobalTooltip({ immediate: true });
    document.body.dataset.page = "notfound";
    setActiveNavigation("notfound");
    showRouteShell({
      page: "notfound",
      view: "",
      notFoundKind: normalizedNotFoundKind(kind),
      url: window.location.href,
    });
  }

  function syncRouteChrome(urlLike = window.location.href) {
    const state = routeState(urlLike);
    const previousPage = lastRoutePage;
    const previousView = lastRouteView;
    const pageChanged = Boolean(previousPage && previousPage !== state.page);
    const viewChanged = Boolean(previousPage && !pageChanged && previousView !== state.view);
    const resetFilters = pageChanged && FILTERED_TABLE_PAGES.has(state.page);
    lastRoutePage = state.page;
    lastRouteView = state.view;

    if (resetFilters) {
      document.documentElement.dataset.mflResetTableFilters = state.page;
    } else if (pageChanged) {
      delete document.documentElement.dataset.mflResetTableFilters;
    }
    if (pageChanged || viewChanged) {
      window.__mflSelectionStackRuntime?.clearForRouteTransition?.();
    }

    if (state.page === "notfound") document.body.dataset.page = "notfound";
    syncFooter();
    setActiveNavigation(state.page);
    syncTableViews(state.page, state.view);
    showRouteShell(state, { resetFilters });
    return state;
  }

  function tooltipTargetFrom(target) {
    if (!(target instanceof Element)) return null;
    const tooltipTarget = target.closest("[data-tooltip], [data-note-tooltip], [title]");
    if (!(tooltipTarget instanceof HTMLElement)) return null;
    if (!MOBILE_TOOLTIP_MEDIA.matches && tooltipTarget.matches(SPECIALIZED_TOOLTIP_SELECTOR)) return null;
    return tooltipTarget;
  }

  function tooltipSource(target) {
    if (!(target instanceof HTMLElement)) return null;
    const dataText = String(target.getAttribute("data-tooltip") || "").trim();
    if (dataText) return { attribute: "data-tooltip", text: dataText };
    const noteText = String(target.getAttribute("data-note-tooltip") || "").trim();
    if (noteText) return { attribute: "data-note-tooltip", text: noteText };
    const titleText = String(target.getAttribute("title") || "").trim();
    return titleText ? { attribute: "title", text: titleText } : null;
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
    let top = anchor.top - tooltip.height - TOOLTIP_HEIGHT;
    if (top < 8) top = anchor.bottom + TOOLTIP_HEIGHT;
    const left = Math.min(
      window.innerWidth - tooltip.width - 8,
      Math.max(8, anchor.left + (anchor.width - tooltip.width) / 2),
    );
    tooltipPortal.style.left = `${Math.round(left)}px`;
    tooltipPortal.style.top = `${Math.round(top)}px`;
  }

  function restoreActiveTooltipAttribute() {
    if (!(activeTooltipTarget instanceof HTMLElement) || !activeTooltipText || !activeTooltipAttribute) return;
    activeTooltipTarget.setAttribute(activeTooltipAttribute, activeTooltipText);
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
    activeTooltipAttribute = "";
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
      const source = tooltipSource(target);
      if (!source) return;
      const portal = ensureTooltipPortal();
      if (!portal) return;
      cancelTooltipMotion();
      activeTooltipTarget = target;
      activeTooltipText = source.text;
      activeTooltipAttribute = source.attribute;
      target.removeAttribute(source.attribute);
      target.setAttribute("aria-describedby", portal.id);
      portal.textContent = source.text;
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
    if (MOBILE_TOOLTIP_MEDIA.matches) return;
    if (activeTooltipTarget instanceof HTMLElement && activeTooltipTarget.contains(event.target)) {
      activeTooltipHovered = true;
      return;
    }
    const target = tooltipTargetFrom(event.target);
    if (target) showGlobalTooltip(target, "hover");
  }

  function onTooltipPointerOut(event) {
    if (MOBILE_TOOLTIP_MEDIA.matches) return;
    if (!(activeTooltipTarget instanceof HTMLElement) || !activeTooltipTarget.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && activeTooltipTarget.contains(event.relatedTarget)) return;
    activeTooltipHovered = false;
    if (!activeTooltipFocused) hideGlobalTooltip();
  }

  function onTooltipFocusIn(event) {
    if (MOBILE_TOOLTIP_MEDIA.matches) return;
    if (activeTooltipTarget instanceof HTMLElement && activeTooltipTarget.contains(event.target)) {
      activeTooltipFocused = true;
      return;
    }
    const target = tooltipTargetFrom(event.target);
    if (target) showGlobalTooltip(target, "focus");
  }

  function onTooltipFocusOut(event) {
    if (MOBILE_TOOLTIP_MEDIA.matches) return;
    if (!(activeTooltipTarget instanceof HTMLElement) || !activeTooltipTarget.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && activeTooltipTarget.contains(event.relatedTarget)) return;
    activeTooltipFocused = false;
    if (!activeTooltipHovered) hideGlobalTooltip();
  }

  function onTooltipClick(event) {
    if (!MOBILE_TOOLTIP_MEDIA.matches) return;
    const clickedTarget = tooltipTargetFrom(event.target);
    if (clickedTarget && clickedTarget === activeTooltipTarget) {
      hideGlobalTooltip({ immediate: true });
      return;
    }
    if (clickedTarget) {
      showGlobalTooltip(clickedTarget, "click");
      return;
    }
    hideGlobalTooltip({ immediate: true });
  }

  function onTooltipViewportChange() {
    if (MOBILE_TOOLTIP_MEDIA.matches) {
      hideGlobalTooltip({ immediate: true });
      return;
    }
    positionTooltipPortal();
  }

  function onTooltipModeChange() {
    hideGlobalTooltip({ immediate: true });
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

  function hideTooltips(options = {}) {
    hideGlobalTooltip({
      immediate: Boolean(options.immediate),
      restore: options.restore !== false,
    });
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
    document.removeEventListener("focus", onTooltipFocusIn, true);
    document.removeEventListener("blur", onTooltipFocusOut, true);
    document.removeEventListener("click", onTooltipClick, true);
    MOBILE_TOOLTIP_MEDIA.removeEventListener("change", onTooltipModeChange);
    window.removeEventListener("resize", onTooltipViewportChange);
    window.removeEventListener("scroll", onTooltipViewportChange, true);
    window.removeEventListener("popstate", onPopState);
  }

  syncRouteChrome(window.location.href);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerover", onTooltipPointerOver, true);
  document.addEventListener("pointerout", onTooltipPointerOut, true);
  document.addEventListener("focus", onTooltipFocusIn, true);
  document.addEventListener("blur", onTooltipFocusOut, true);
  document.addEventListener("click", onTooltipClick, true);
  MOBILE_TOOLTIP_MEDIA.addEventListener("change", onTooltipModeChange);
  window.addEventListener("resize", onTooltipViewportChange);
  window.addEventListener("scroll", onTooltipViewportChange, true);
  window.addEventListener("popstate", onPopState);

  window.__mflStaticUiRuntime = Object.freeze({ sync, syncTableViews, showNotFound, hideTooltips, destroy });
})();
