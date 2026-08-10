(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.23");
  window.__mflWatchlistMyPlayersRouteRuntime?.destroy?.();

  const PAIR = new Set(["watchlist", "myplayers"]);
  let sequence = 0;
  let latestIntent = null;
  let originalSetPage = null;
  let wrappedSetPage = null;
  let reconciling = false;
  let destroyed = false;

  function statePage() {
    try {
      return typeof state === "object" && state ? String(state.currentPage || "") : "";
    } catch {
      return "";
    }
  }

  function bodyPage() {
    return String(document.body?.dataset.page || "");
  }

  function currentView(pageName) {
    try {
      if (typeof normalizeViewForPage === "function") {
        return normalizeViewForPage(state?.view || "attributes", pageName);
      }
      return String(state?.view || "attributes");
    } catch {
      return "attributes";
    }
  }

  function intentOptions(pageName, options = {}) {
    const view = String(options?.view || currentView(pageName) || "attributes");
    return { ...options, view };
  }

  async function reconcile(intent) {
    if (destroyed || reconciling || !intent || latestIntent?.sequence !== intent.sequence) return;
    if (statePage() === intent.pageName && bodyPage() === intent.pageName) return;
    reconciling = true;
    try {
      await originalSetPage.call(window, intent.pageName, false, {
        ...intent.options,
        replaceUrl: "",
        skipNavigationLoading: true,
      });
    } catch (error) {
      console.error("Could not keep the latest Watchlist/My Players route.", error);
    } finally {
      reconciling = false;
    }
  }

  function install() {
    let candidate = null;
    try { candidate = setPage; } catch {}
    if (typeof candidate !== "function") return false;
    if (candidate === wrappedSetPage) return true;

    originalSetPage = candidate;
    wrappedSetPage = async function setPageWithLatestWatchlistMyPlayersIntent(pageName, updateHash = true, options = {}) {
      const normalizedPage = String(pageName || "");
      const pairNavigation = PAIR.has(normalizedPage);
      const requestSequence = pairNavigation ? ++sequence : 0;
      const nextOptions = pairNavigation ? intentOptions(normalizedPage, options) : options;

      if (pairNavigation) {
        latestIntent = {
          sequence: requestSequence,
          pageName: normalizedPage,
          options: { ...nextOptions },
        };
      } else {
        latestIntent = null;
        sequence += 1;
      }

      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);

      if (pairNavigation && latestIntent?.sequence !== requestSequence) {
        await reconcile(latestIntent);
      } else if (pairNavigation && latestIntent?.sequence === requestSequence) {
        // A stale earlier request can settle in the same microtask checkpoint.
        // Recheck once all currently queued promise continuations have run.
        await Promise.resolve();
        await reconcile(latestIntent);
      }
      return result;
    };

    window.__mflLatestPairSetPage = wrappedSetPage;
    try { window.setPage = wrappedSetPage; } catch {}
    try { window.eval("setPage = window.__mflLatestPairSetPage"); } catch {}
    return true;
  }

  function destroy() {
    destroyed = true;
    latestIntent = null;
    sequence += 1;
    if (wrappedSetPage && originalSetPage) {
      try {
        if (window.setPage === wrappedSetPage) window.setPage = originalSetPage;
      } catch {}
      try {
        window.__mflPairOriginalSetPage = originalSetPage;
        window.eval("if (setPage === window.__mflLatestPairSetPage) setPage = window.__mflPairOriginalSetPage");
      } catch {}
      delete window.__mflPairOriginalSetPage;
    }
    delete window.__mflLatestPairSetPage;
  }

  if (!install()) {
    requestAnimationFrame(() => {
      if (!destroyed) install();
    });
  }

  window.__mflWatchlistMyPlayersRouteRuntime = Object.freeze({
    version: VERSION,
    install,
    destroy,
  });
})();
