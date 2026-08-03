(() => {
  const VERSION = "1.120.12";
  const DATABASE_PATH = /^\/database(?:\/|$)/i;
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const INTENT_KEY = "mfl-database-stats-reload-intent";
  const GUARD_MS = 15000;
  const STABLE_MS = 5000;

  const existing = window.__mflDatabaseStatsButtonRuntime;
  if (existing?.version === VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  let upstreamPushState = history.pushState.bind(history);
  let upstreamReplaceState = history.replaceState.bind(history);
  let frame = 0;
  let interval = 0;
  let observer = null;
  let observedRoot = null;
  let destroyed = false;
  let statsIntent = false;
  let guardUntil = 0;
  let stableSince = 0;

  function currentPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function readStoredIntent() {
    try {
      const storedAt = Number(sessionStorage.getItem(INTENT_KEY) || 0);
      return Number.isFinite(storedAt) && storedAt > 0 && Date.now() - storedAt < GUARD_MS;
    } catch {
      return false;
    }
  }

  function storeIntent() {
    try {
      sessionStorage.setItem(INTENT_KEY, String(Date.now()));
    } catch {
      // Storage may be unavailable in private contexts.
    }
  }

  function clearStoredIntent() {
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Storage may be unavailable in private contexts.
    }
  }

  function activateStatsIntent() {
    statsIntent = true;
    guardUntil = Date.now() + GUARD_MS;
    stableSince = 0;
    storeIntent();
  }

  function releaseStatsIntent() {
    statsIntent = false;
    guardUntil = 0;
    stableSince = 0;
    clearStoredIntent();
  }

  if (STATS_PATH.test(currentPath()) || readStoredIntent()) {
    activateStatsIntent();
  }

  function asUrl(value) {
    try {
      return new URL(value == null ? location.href : value, location.origin);
    } catch {
      return new URL(location.href);
    }
  }

  function shouldPreserveStats(value) {
    if (!statsIntent || Date.now() >= guardUntil) return false;
    const next = asUrl(value);
    return DATABASE_PATH.test(next.pathname) && !STATS_PATH.test(next.pathname);
  }

  function guardedPushState(stateValue, title, value) {
    if (shouldPreserveStats(value)) {
      return upstreamReplaceState(stateValue, title, "/database/stats");
    }
    const result = upstreamPushState(stateValue, title, value);
    if (STATS_PATH.test(asUrl(value).pathname)) activateStatsIntent();
    return result;
  }

  function guardedReplaceState(stateValue, title, value) {
    if (shouldPreserveStats(value)) {
      return upstreamReplaceState(stateValue, title, "/database/stats");
    }
    const result = upstreamReplaceState(stateValue, title, value);
    if (STATS_PATH.test(asUrl(value).pathname)) activateStatsIntent();
    return result;
  }

  function installHistoryGuard() {
    if (history.pushState !== guardedPushState) {
      upstreamPushState = history.pushState.bind(history);
    }
    if (history.replaceState !== guardedReplaceState) {
      upstreamReplaceState = history.replaceState.bind(history);
    }
    history.pushState = guardedPushState;
    history.replaceState = guardedReplaceState;
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;

    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }

    const text = `MFL Front Office v${VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.href = "/changelog";
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
  }

  function statsIsActive() {
    const statsPage = document.getElementById("databaseStatsPage");
    return STATS_PATH.test(currentPath())
      || statsIntent
      || document.body?.dataset.page === "databasestats"
      || Boolean(statsPage && !statsPage.hidden);
  }

  function openStats(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    activateStatsIntent();
    if (!STATS_PATH.test(currentPath())) {
      upstreamPushState({}, "", "/database/stats");
    }
    if (typeof window.renderDatabaseStatsPage === "function") {
      void window.renderDatabaseStatsPage(false);
    }
    window.__mflDatabaseStatsRuntime?.sync?.();
    schedule();
  }

  function ensureButtonInViews(views) {
    if (!(views instanceof HTMLElement)) return null;

    let button = views.querySelector('.viewButton[data-view="stats"]');
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "viewButton";
      button.dataset.view = "stats";
      button.textContent = "Stats";

      const contracts = views.querySelector('.viewButton[data-view="contracts"]');
      if (contracts) contracts.after(button);
      else views.appendChild(button);
    }

    if (button.dataset.mflStatsReloadBound !== VERSION) {
      button.addEventListener("click", openStats, true);
      button.dataset.mflStatsReloadBound = VERSION;
    }

    const active = statsIsActive();
    button.hidden = false;
    button.removeAttribute("aria-hidden");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));

    if (active) {
      views.querySelectorAll('.viewButton[data-view]:not([data-view="stats"])').forEach((other) => {
        other.classList.remove("active");
        other.setAttribute("aria-pressed", "false");
      });
    }

    return button;
  }

  function ensureStatsButtons() {
    const onDatabase = DATABASE_PATH.test(currentPath())
      || statsIntent
      || document.body?.dataset.page === "databasestats";
    if (!onDatabase) return;

    document.querySelectorAll("#progressionPage .views, #databaseStatsPage .views")
      .forEach(ensureButtonInViews);
  }

  function statsPageReady() {
    const page = document.getElementById("databaseStatsPage");
    if (!(page instanceof HTMLElement) || page.hidden) return false;
    return Boolean(page.querySelector('.viewButton[data-view="stats"]'));
  }

  function syncStatsReload() {
    if (!statsIntent) return;
    if (Date.now() >= guardUntil) {
      releaseStatsIntent();
      return;
    }

    const path = currentPath();
    if (DATABASE_PATH.test(path) && !STATS_PATH.test(path)) {
      upstreamReplaceState(history.state, "", "/database/stats");
    }

    window.__mflDatabaseStatsRuntime?.sync?.();
    if (typeof window.renderDatabaseStatsPage === "function" && !statsPageReady()) {
      void window.renderDatabaseStatsPage(false);
    }

    if (STATS_PATH.test(currentPath()) && statsPageReady()) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= STABLE_MS) releaseStatsIntent();
    } else {
      stableSince = 0;
    }
  }

  function releaseForUserNavigation(target) {
    if (!(target instanceof Element)) return;
    const statsButton = target.closest('.viewButton[data-view="stats"]');
    if (statsButton) {
      activateStatsIntent();
      return;
    }

    const navigationTarget = target.closest('a[href], [data-page], .viewButton[data-view]');
    if (navigationTarget) releaseStatsIntent();
  }

  function bindObserver() {
    const root = document.documentElement;
    if (!root || root === observedRoot) return;
    observer?.disconnect();
    observedRoot = root;
    observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-page", "aria-hidden"],
    });
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    installHistoryGuard();
    bindObserver();
    syncFooter();
    ensureStatsButtons();
    syncStatsReload();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function rebind() {
    if (destroyed) return;
    observedRoot = null;
    installHistoryGuard();
    bindObserver();
    schedule();
  }

  function onPopState() {
    if (STATS_PATH.test(currentPath())) activateStatsIntent();
    else if (!DATABASE_PATH.test(currentPath())) releaseStatsIntent();
    schedule();
  }

  document.addEventListener("pointerdown", (event) => releaseForUserNavigation(event.target), true);
  window.addEventListener("popstate", onPopState);
  interval = window.setInterval(schedule, 100);
  rebind();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", onPopState);
    if (history.pushState === guardedPushState) history.pushState = upstreamPushState;
    if (history.replaceState === guardedReplaceState) history.replaceState = upstreamReplaceState;
  }

  window.__mflDatabaseStatsButtonRuntime = {
    version: VERSION,
    sync: schedule,
    rebind,
    destroy,
  };
})();
