(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const PAIR = new Set(["watchlist", "myplayers"]);
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const SLUG_BY_VIEW = Object.freeze({
    attributes: "attributes",
    next: "next-overall",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  });
  const INITIAL_VIEW_MAX_WAIT_MS = 15000;

  window.__mflWatchlistMyPlayersRouteRuntime?.destroy?.();
  window.__mflMyPlayersRefreshViewRuntime?.destroy?.();

  let sequence = 0;
  let latestIntent = null;
  let originalSetPage = null;
  let wrappedSetPage = null;
  let reconciling = false;
  let destroyed = false;
  let initialViewObserver = null;
  let initialViewTimer = 0;
  let initialViewFrame = 0;

  const rememberedPath = String(window.__mflInitialMyPlayersPath || "").replace(/\/+$/, "");
  const initialViewMatch = rememberedPath.match(/^\/my-players\/(attributes|next-overall|contracts|current-season|all-time)$/i);
  const desiredInitialSlug = String(initialViewMatch?.[1] || "").toLowerCase();
  const desiredInitialView = VIEW_BY_SLUG[desiredInitialSlug] || "";

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

  function cleanPath() {
    return String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
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

  function releaseInitialMyPlayersGuard() {
    try {
      window.__mflReleaseMyPlayersRouteGuard?.();
    } catch {
      // The guard may already have been released by the route bootstrap.
    }
  }

  function finishInitialViewRestore() {
    if (initialViewTimer) clearTimeout(initialViewTimer);
    initialViewTimer = 0;
    if (initialViewFrame) cancelAnimationFrame(initialViewFrame);
    initialViewFrame = 0;
    initialViewObserver?.disconnect();
    initialViewObserver = null;
    releaseInitialMyPlayersGuard();
    window.__mflInitialMyPlayersPath = "";
  }

  function restoreInitialMyPlayersView() {
    initialViewFrame = 0;
    if (destroyed || !desiredInitialView) {
      finishInitialViewRestore();
      return;
    }

    if (!/^\/my-players(?:\/|$)/i.test(cleanPath())) {
      finishInitialViewRestore();
      return;
    }

    const appPage = statePage();
    if (appPage && appPage !== "myplayers") return;

    const page = document.getElementById("progressionPage");
    const button = page?.querySelector(`.viewButton[data-view="${desiredInitialView}"]`);
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;

    const canonicalPath = `/my-players/${SLUG_BY_VIEW[desiredInitialView]}`;
    if (!button.classList.contains("active")) button.click();

    window.setTimeout(() => {
      if (destroyed) return;
      if (/^\/my-players(?:\/|$)/i.test(cleanPath()) && cleanPath() !== canonicalPath) {
        window.history.replaceState({}, "", canonicalPath);
      }
      finishInitialViewRestore();
    }, 0);
  }

  function scheduleInitialViewRestore() {
    if (!destroyed && !initialViewFrame && initialViewObserver) {
      initialViewFrame = requestAnimationFrame(restoreInitialMyPlayersView);
    }
  }

  function installInitialViewRestore() {
    if (!desiredInitialView) {
      finishInitialViewRestore();
      return;
    }
    initialViewObserver = new MutationObserver(scheduleInitialViewRestore);
    initialViewObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "data-page", "data-mfl-ready"],
    });
    initialViewTimer = window.setTimeout(finishInitialViewRestore, INITIAL_VIEW_MAX_WAIT_MS);
    restoreInitialMyPlayersView();
  }

  function destroy() {
    destroyed = true;
    latestIntent = null;
    sequence += 1;
    finishInitialViewRestore();
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
  installInitialViewRestore();

  window.__mflWatchlistMyPlayersRouteRuntime = Object.freeze({
    version: VERSION,
    install,
    restoreInitialMyPlayersView,
    destroy,
  });
})();
