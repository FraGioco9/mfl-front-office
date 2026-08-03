(() => {
  const VERSION = "1.120.15";
  const DATABASE_PATH = /^\/database(?:\/|$)/i;
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const RUNTIME_KEY = "__mflDatabaseStatsReloadBootstrap";
  const INTENT_KEY = "mfl-database-stats-reload-intent";

  const existing = window[RUNTIME_KEY];
  if (existing?.version === VERSION) {
    existing.finalize?.();
    return;
  }
  existing?.destroy?.();

  const basePushState = history.pushState.bind(history);
  const baseReplaceState = history.replaceState.bind(history);
  let active = STATS_PATH.test(location.pathname);
  let timeout = 0;

  function asUrl(value) {
    try {
      return new URL(value == null ? location.href : value, location.origin);
    } catch {
      return new URL(location.href);
    }
  }

  function shouldPreserveStats(value) {
    if (!active) return false;
    const next = asUrl(value);
    return DATABASE_PATH.test(next.pathname) && !STATS_PATH.test(next.pathname);
  }

  function guardedPushState(stateValue, title, value) {
    if (shouldPreserveStats(value)) {
      return baseReplaceState(stateValue, title, "/database/stats");
    }
    return basePushState(stateValue, title, value);
  }

  function guardedReplaceState(stateValue, title, value) {
    if (shouldPreserveStats(value)) {
      return baseReplaceState(stateValue, title, "/database/stats");
    }
    return baseReplaceState(stateValue, title, value);
  }

  function clearIntent() {
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Storage may be unavailable in private contexts.
    }
  }

  function restoreHistory() {
    if (history.pushState === guardedPushState) history.pushState = basePushState;
    if (history.replaceState === guardedReplaceState) history.replaceState = baseReplaceState;
    active = false;
    clearIntent();
    if (timeout) {
      clearTimeout(timeout);
      timeout = 0;
    }
  }

  function finalize() {
    restoreHistory();
    queueMicrotask(() => {
      window.__mflDatabaseStatsRuntime?.sync?.();
      window.__mflDatabaseStatsButtonRuntime?.rebind?.();
    });
  }

  function destroy() {
    restoreHistory();
  }

  if (active) {
    history.pushState = guardedPushState;
    history.replaceState = guardedReplaceState;
    timeout = window.setTimeout(restoreHistory, 15000);
  }

  window[RUNTIME_KEY] = {
    version: VERSION,
    finalize,
    destroy,
  };
})();
