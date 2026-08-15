(() => {
  const VERSION = String(window.__mflReleaseVersion || "dev");
  const WATCHLIST_PATH = /^\/watchlist(?:\/|$)/;
  const EXACT_PATH = /^\/watchlist\/[^/]+\/(?:attributes|next-overall|contracts|current-season|all-time)\/?$/;
  const previous = window.__mflWatchlistRouteUiRuntime;
  previous?.destroy?.();

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  let protectedRoute = EXACT_PATH.test(location.pathname)
    ? `${location.pathname}${location.search}${location.hash}`
    : "";
  let frame = 0;
  let observer = null;
  let tooltipTarget = null;
  let tooltipTimer = 0;
  let pointerX = -1;
  let pointerY = -1;
  let stableWatchlistId = "";
  let stableWatchlistName = "";

  const isWatchlistPath = (pathname = location.pathname) => WATCHLIST_PATH.test(String(pathname || ""));
  const viewSlugs = new Set(["attributes", "next-overall", "contracts", "current-season", "all-time"]);

  function routeWatchlistId(pathname = location.pathname) {
    const segment = decodeURIComponent(String(pathname || "").match(/^\/watchlist(?:\/([^/]+))?/)?.[1] || "");
    return viewSlugs.has(segment) ? "" : segment;
  }

  function stateWatchlistId() {
    try {
      return typeof state === "object" && state ? String(state.currentWatchlistId || "") : "";
    } catch {
      return "";
    }
  }

  function rememberVisibleWatchlistTitle() {
    if (!isWatchlistPath()) return;
    const visibleTitle = String(document.getElementById("tablePageTitle")?.textContent || "").trim();
    const match = visibleTitle.match(/^Watchlist\s*-\s*(.+)$/i);
    if (match?.[1] && match[1].trim() !== "-") stableWatchlistName = match[1].trim();
    const id = routeWatchlistId() || stateWatchlistId();
    if (id) stableWatchlistId = id;
  }

  function liveWatchlistName(watchlistId) {
    try {
      if (typeof state !== "object" || !Array.isArray(state?.watchlists)) return "";
      const selected = watchlistId
        ? state.watchlists.find((watchlist) => String(watchlist?.id || "") === watchlistId)
        : state.watchlists.find((watchlist) => String(watchlist?.id || "") === String(state?.currentWatchlistId || ""))
          || state.watchlists[0];
      return String(selected?.name || "").trim();
    } catch {
      return "";
    }
  }

  function cachedWatchlistName(watchlistId) {
    try {
      const wallet = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim().toLowerCase();
      if (!wallet) return "";
      const saved = JSON.parse(localStorage.getItem(`mfl-wallet-watchlist-v1:${wallet}`) || "[]");
      if (!Array.isArray(saved)) return "";
      const watchlists = saved.filter((item) => item && typeof item === "object" && !Array.isArray(item));
      const selected = watchlistId
        ? watchlists.find((watchlist) => String(watchlist.id || "") === watchlistId)
        : watchlists[0];
      return String(selected?.name || "").trim();
    } catch {
      return "";
    }
  }

  function currentWatchlistIdentity() {
    const routeId = routeWatchlistId();
    const liveId = stateWatchlistId();
    const watchlistId = routeId || liveId || stableWatchlistId;
    if (routeId || liveId) stableWatchlistId = routeId || liveId;
    const name = liveWatchlistName(watchlistId)
      || cachedWatchlistName(watchlistId)
      || stableWatchlistName;
    if (name) stableWatchlistName = name;
    return { watchlistId, name };
  }

  function syncWatchlistSwitcher() {
    const switcher = document.getElementById("watchlistSwitcher");
    const buttonText = document.getElementById("watchlistButtonText");
    if (!(switcher instanceof HTMLElement) || !(buttonText instanceof HTMLElement)) return;

    const optedIn = document.documentElement.dataset.storedWalletOptIn !== "false";
    if (!isWatchlistPath() || !optedIn || document.body?.dataset.page === "myplayers") {
      if (!switcher.hidden) switcher.hidden = true;
      return;
    }

    const { name } = currentWatchlistIdentity();
    const nextText = name || "-";
    if (buttonText.textContent !== nextText) buttonText.textContent = nextText;
    if (switcher.hidden) switcher.hidden = false;
  }

  function syncWatchlistTitle() {
    if (!isWatchlistPath()) return;
    const title = document.getElementById("tablePageTitle");
    if (!title) return;

    const { name: resolvedName } = currentWatchlistIdentity();
    const switcherText = String(document.getElementById("watchlistButtonText")?.textContent || "").trim();
    const name = resolvedName
      || (switcherText && switcherText !== "-" ? switcherText : "")
      || "Default";
    stableWatchlistName = name;
    const nextTitle = `Watchlist - ${name}`;
    if (title.textContent !== nextTitle) title.textContent = nextTitle;
  }

  function asUrl(value) {
    try {
      return new URL(value == null ? location.href : value, location.origin);
    } catch {
      return new URL(location.href);
    }
  }

  function hideTooltip(immediate = false) {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = 0;
    }
    const tooltip = document.getElementById("watchlistRenameStableTooltip");
    if (!tooltip) {
      tooltipTarget = null;
      return;
    }
    const remove = () => {
      tooltip.remove();
      tooltipTarget = null;
      tooltipTimer = 0;
    };
    if (immediate) return remove();
    tooltip.classList.remove("visible");
    tooltipTimer = setTimeout(remove, 150);
  }

  function hideSwitcher() {
    const switcher = document.getElementById("watchlistSwitcher");
    const dropdown = document.getElementById("watchlistDropdown");
    const button = document.getElementById("watchlistButton");
    if (switcher) switcher.hidden = true;
    if (dropdown) dropdown.hidden = true;
    button?.setAttribute("aria-expanded", "false");
    hideTooltip(true);
  }

  function loadingActive() {
    const root = document.documentElement;
    return root.classList.contains("mflInteractionBusy")
      || root.dataset.interactionBusy === "true"
      || root.classList.contains("mflDataLoading")
      || document.body?.getAttribute("aria-busy") === "true";
  }

  function stateReady() {
    if (!protectedRoute || document.body?.dataset.page !== "watchlist" || loadingActive()) return false;
    try {
      return typeof state === "object"
        && state?.currentPage === "watchlist"
        && Boolean(state?.currentWatchlistId)
        && Boolean(state?.walletPreferencesLoaded);
    } catch {
      return false;
    }
  }

  function releaseInitialRoute() {
    if (!protectedRoute || !stateReady()) return;
    originalReplaceState(history.state, "", protectedRoute);
    protectedRoute = "";
  }

  function renameAtPointer() {
    if (pointerX < 0 || pointerY < 0 || typeof document.elementFromPoint !== "function") return null;
    return document.elementFromPoint(pointerX, pointerY)?.closest?.(".watchlistDropdownRename") || null;
  }

  function positionTooltip(button, tooltip) {
    if (!button?.isConnected || !tooltip?.isConnected) return;
    const rect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - tooltipRect.width / 2, 8),
      Math.max(8, innerWidth - tooltipRect.width - 8),
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(8, rect.top - tooltipRect.height - 8)}px`;
  }

  function showTooltip(button) {
    if (!button?.isConnected || !isWatchlistPath()) return;
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = 0;
    }
    document.querySelectorAll(".evaluationLoadFloatingTooltip").forEach((item) => {
      if (String(item.textContent || "").trim() === "Rename") item.remove();
    });
    let tooltip = document.getElementById("watchlistRenameStableTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "watchlistRenameStableTooltip";
      tooltip.className = "watchlistRenameStableTooltip";
      tooltip.setAttribute("role", "tooltip");
      tooltip.textContent = "Rename";
      document.body.appendChild(tooltip);
    }
    tooltipTarget = button;
    positionTooltip(button, tooltip);
    requestAnimationFrame(() => {
      if (tooltipTarget === button && tooltip.isConnected) tooltip.classList.add("visible");
    });
  }

  function normalizeRenameButtons() {
    document.querySelectorAll(".watchlistDropdownRename").forEach((button) => {
      button.removeAttribute("data-tooltip");
    });
    if (tooltipTarget && !tooltipTarget.isConnected) {
      const replacement = renameAtPointer();
      if (replacement) showTooltip(replacement);
      else hideTooltip();
    }
  }

  function sync() {
    frame = 0;
    normalizeRenameButtons();
    releaseInitialRoute();
    syncWatchlistSwitcher();
    syncWatchlistTitle();
    if (!isWatchlistPath()) hideSwitcher();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function onMutation() {
    if (isWatchlistPath()) {
      // Title identity is first-paint chrome. Re-pin it in the mutation microtask
      // so legacy hydration cannot expose a fallback title for one rendered frame.
      syncWatchlistTitle();
    }
    schedule();
  }

  function performHistoryChange(method, stateValue, title, value) {
    const currentIsExactWatchlistRoute = EXACT_PATH.test(location.pathname);
    const next = asUrl(value);
    const nextRoute = `${next.pathname}${next.search}${next.hash}`;

    // The first fully resolved Watchlist URL owns the loading transaction,
    // including the normal /watchlist -> /watchlist/<id>/<view> handoff.
    // Existing exact routes are not recaptured, so intentional view/list changes
    // can continue to navigate normally after beginNavigation clears protection.
    if (!protectedRoute && !currentIsExactWatchlistRoute && EXACT_PATH.test(next.pathname)) {
      protectedRoute = nextRoute;
    }

    if (protectedRoute && isWatchlistPath(next.pathname) && nextRoute !== protectedRoute) {
      const result = originalReplaceState(stateValue, title, protectedRoute);
      syncWatchlistTitle();
      schedule();
      return result;
    }
    const result = method(stateValue, title, value);
    if (!isWatchlistPath(next.pathname)) {
      protectedRoute = "";
      hideSwitcher();
    } else {
      syncWatchlistTitle();
    }
    schedule();
    return result;
  }

  history.pushState = (stateValue, title, value) => performHistoryChange(originalPushState, stateValue, title, value);
  history.replaceState = (stateValue, title, value) => performHistoryChange(originalReplaceState, stateValue, title, value);

  function routeFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest("a[href]");
    if (link) {
      const url = asUrl(link.href);
      if (url.origin === location.origin) return url.pathname;
    }
    const page = target?.closest("[data-page]")?.dataset.page;
    return page ? (page === "watchlist" ? "/watchlist" : `/${page}`) : "";
  }

  function beginNavigation(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (isWatchlistPath() && target.closest(".viewButton")) rememberVisibleWatchlistTitle();
    const route = routeFromEvent(event);
    if (route && !isWatchlistPath(route)) {
      protectedRoute = "";
      hideSwitcher();
    } else if (target.closest("#watchlistSwitcher, .viewButton")) {
      protectedRoute = "";
    }
    if (target.closest(".watchlistDropdownRename")) hideTooltip(true);
  }

  function onPointerOver(event) {
    const button = event.target instanceof Element
      ? event.target.closest(".watchlistDropdownRename")
      : null;
    if (button && !button.contains(event.relatedTarget)) showTooltip(button);
  }

  function onPointerOut(event) {
    const button = event.target instanceof Element
      ? event.target.closest(".watchlistDropdownRename")
      : null;
    if (!button || button.contains(event.relatedTarget)) return;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      tooltipTimer = 0;
      const replacement = renameAtPointer();
      if (replacement) showTooltip(replacement);
      else hideTooltip();
    }, 90);
  }

  function repositionTooltip() {
    const tooltip = document.getElementById("watchlistRenameStableTooltip");
    if (tooltip && tooltipTarget) positionTooltip(tooltipTarget, tooltip);
  }

  const style = document.createElement("style");
  style.id = "watchlistRouteUiRuntimeStyles";
  style.textContent = `
    body[data-page="watchlist"] #progressionPage .viewButton {
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease !important;
    }
    body[data-page="watchlist"] #progressionPage .viewButton:not(.active):hover:not(:disabled) {
      border-color: var(--primary-hover) !important;
      background: var(--row-hover) !important;
      color: var(--text) !important;
    }
    .watchlistDropdownRename::before,
    .watchlistDropdownRename::after {
      display: none !important;
      content: none !important;
    }
    .watchlistRenameStableTooltip {
      position: fixed;
      z-index: 2147483000;
      max-width: min(240px, calc(100vw - 16px));
      padding: 6px 9px;
      border-radius: 6px;
      background: #171922;
      color: #fff;
      font-size: 12px;
      line-height: 1.2;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(2px);
      transition: opacity 140ms ease, transform 140ms ease;
    }
    .watchlistRenameStableTooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("pointerdown", beginNavigation, true);
  document.addEventListener("click", beginNavigation, true);
  document.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  }, true);
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("focusin", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest(".watchlistDropdownRename")
      : null;
    if (button) showTooltip(button);
  }, true);
  document.addEventListener("focusout", (event) => {
    if (event.target instanceof Element && event.target.closest(".watchlistDropdownRename")) hideTooltip();
  }, true);
  window.addEventListener("popstate", () => {
    protectedRoute = "";
    if (!isWatchlistPath()) hideSwitcher();
    else syncWatchlistTitle();
    schedule();
  });
  window.addEventListener("resize", repositionTooltip);
  window.addEventListener("scroll", repositionTooltip, true);

  observer = new MutationObserver(onMutation);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "data-page", "data-tooltip", "data-stored-wallet-opt-in"],
  });

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    if (tooltipTimer) clearTimeout(tooltipTimer);
    observer?.disconnect();
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    hideTooltip(true);
    style.remove();
  }

  window.__mflWatchlistRouteUiRuntime = {
    version: VERSION,
    currentName: () => currentWatchlistIdentity().name,
    sync,
    destroy,
  };
  rememberVisibleWatchlistTitle();
  sync();
  [0, 50, 150, 400, 1000, 2000, 5000].forEach((delay) => setTimeout(schedule, delay));
})();