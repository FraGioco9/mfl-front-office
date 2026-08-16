(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const WATCHLIST_PATH = /^\/watchlist(?:\/|$)/;
  const EXACT_PATH = /^\/watchlist\/[^/]+\/(?:attributes|next-overall|contracts|current-season|all-time)\/?$/;

  window.__mflWatchlistUiRuntime?.destroy?.();

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
    const raw = String(pathname || "").match(/^\/watchlist(?:\/([^/]+))?/)?.[1] || "";
    let segment = raw;
    try {
      segment = decodeURIComponent(raw);
    } catch {}
    return viewSlugs.has(segment) ? "" : segment;
  }

  function stateWatchlistId() {
    try {
      return typeof state === "object" && state ? String(state.currentWatchlistId || "") : "";
    } catch {
      return "";
    }
  }

  function cachedWatchlists() {
    try {
      const wallet = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim().toLowerCase();
      if (!wallet) return [];
      const saved = JSON.parse(localStorage.getItem(`mfl-wallet-watchlist-v1:${wallet}`) || "[]");
      return Array.isArray(saved)
        ? saved.filter((item) => item && typeof item === "object" && !Array.isArray(item))
        : [];
    } catch {
      return [];
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
    const watchlists = cachedWatchlists();
    const selected = watchlistId
      ? watchlists.find((watchlist) => String(watchlist.id || "") === watchlistId)
      : watchlists[0];
    return String(selected?.name || "").trim();
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
    if (!(title instanceof HTMLElement)) return;

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
    const tooltip = document.getElementById("watchlistRenameTooltip");
    if (!tooltip) {
      tooltipTarget = null;
      return;
    }
    const remove = () => {
      tooltip.remove();
      tooltipTarget = null;
      tooltipTimer = 0;
    };
    if (immediate) {
      remove();
      return;
    }
    tooltip.classList.remove("visible");
    tooltipTimer = window.setTimeout(remove, 150);
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

  function stateReady() {
    if (!protectedRoute || document.body?.dataset.page !== "watchlist") return false;
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
    let tooltip = document.getElementById("watchlistRenameTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "watchlistRenameTooltip";
      tooltip.className = "watchlistRenameTooltip";
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
    if (isWatchlistPath()) syncWatchlistTitle();
    schedule();
  }

  function performHistoryChange(method, stateValue, title, value) {
    const next = asUrl(value);
    const nextRoute = `${next.pathname}${next.search}${next.hash}`;
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

  function eventLeavesWatchlist(target) {
    const page = target?.closest?.("[data-page]")?.dataset.page;
    if (page) return page !== "watchlist";
    const link = target?.closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return false;
    const url = asUrl(link.href);
    return url.origin === location.origin && !isWatchlistPath(url.pathname);
  }

  function beginNavigation(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (isWatchlistPath() && target.closest(".viewButton")) rememberVisibleWatchlistTitle();
    if (eventLeavesWatchlist(target)) {
      protectedRoute = "";
      hideSwitcher();
    } else if (target.closest("#watchlistSwitcher, .viewButton")) {
      protectedRoute = "";
    }
    if (target.closest(".watchlistDropdownRename")) hideTooltip(true);
  }

  function onPointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
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
    tooltipTimer = window.setTimeout(() => {
      tooltipTimer = 0;
      const replacement = renameAtPointer();
      if (replacement) showTooltip(replacement);
      else hideTooltip();
    }, 90);
  }

  function onFocusIn(event) {
    const button = event.target instanceof Element
      ? event.target.closest(".watchlistDropdownRename")
      : null;
    if (button) showTooltip(button);
  }

  function onFocusOut(event) {
    if (event.target instanceof Element && event.target.closest(".watchlistDropdownRename")) hideTooltip();
  }

  function onPopState() {
    protectedRoute = "";
    if (!isWatchlistPath()) hideSwitcher();
    else syncWatchlistTitle();
    schedule();
  }

  function repositionTooltip() {
    const tooltip = document.getElementById("watchlistRenameTooltip");
    if (tooltip && tooltipTarget) positionTooltip(tooltipTarget, tooltip);
  }

  const style = document.createElement("style");
  style.id = "mflWatchlistUiRuntimeStyles";
  style.textContent = `
    .watchlistDropdownRename::before,
    .watchlistDropdownRename::after {
      display: none !important;
      content: none !important;
    }
    .watchlistRenameTooltip {
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
    .watchlistRenameTooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("pointerdown", beginNavigation, true);
  document.addEventListener("click", beginNavigation, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("resize", repositionTooltip);
  window.addEventListener("scroll", repositionTooltip, true);
  window.addEventListener("mfl:ready", sync);

  observer = new MutationObserver(onMutation);
  const title = document.getElementById("tablePageTitle");
  const switcher = document.getElementById("watchlistSwitcher");
  const dropdown = document.getElementById("watchlistDropdown");
  if (title) observer.observe(title, { childList: true, subtree: true, characterData: true });
  if (switcher) observer.observe(switcher, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  if (dropdown) observer.observe(dropdown, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-tooltip"] });
  if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["data-page"] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-stored-wallet-opt-in", "data-mfl-ready"] });

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = 0;
    observer?.disconnect();
    observer = null;
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    document.removeEventListener("pointerdown", beginNavigation, true);
    document.removeEventListener("click", beginNavigation, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerover", onPointerOver, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("focusout", onFocusOut, true);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("resize", repositionTooltip);
    window.removeEventListener("scroll", repositionTooltip, true);
    window.removeEventListener("mfl:ready", sync);
    hideTooltip(true);
    style.remove();
  }

  window.__mflWatchlistUiRuntime = Object.freeze({
    version: VERSION,
    currentName: () => currentWatchlistIdentity().name,
    sync,
    destroy,
  });
  rememberVisibleWatchlistTitle();
  sync();
})();
