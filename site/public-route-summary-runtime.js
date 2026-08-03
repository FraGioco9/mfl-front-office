(() => {
  const VERSION = "1.119.8";
  const previous = window.__mflPublicRouteSummaryRuntime;
  previous?.destroy?.();

  let frame = 0;
  let observer = null;
  let summaryPromise = null;
  let summaryLoaded = false;
  const nativePushState = history.pushState.bind(history);
  const nativeReplaceState = history.replaceState.bind(history);

  function normalizedPath() {
    const path = String(window.location.pathname || "/").replace(/\/+$/, "");
    return path || "/";
  }

  function isPublicSummaryPage() {
    const path = normalizedPath();
    return path === "/" || path === "/changelog";
  }

  function loadPublicSummary() {
    if (!isPublicSummaryPage() || summaryLoaded || summaryPromise || typeof loadSummary !== "function") return;
    summaryPromise = Promise.resolve(loadSummary()).then(() => {
      summaryLoaded = true;
    }).catch((error) => {
      console.error(error?.message || "Could not load public summary totals.");
    }).finally(() => {
      summaryPromise = null;
    });
  }

  function showHomepageAtRoot() {
    if (normalizedPath() !== "/") return;

    const home = document.getElementById("homePage");
    const changelog = document.getElementById("changelogPage");
    if (!home || !changelog) return;

    document.querySelectorAll("main > .pageView").forEach((page) => {
      const shouldHide = page !== home;
      if (page.hidden !== shouldHide) page.hidden = shouldHide;
    });
    if (home.hidden) home.hidden = false;
    if (!changelog.hidden) changelog.hidden = true;
    if (document.body.dataset.page !== "home") document.body.dataset.page = "home";

    try {
      if (typeof state !== "undefined" && state) state.currentPage = "home";
    } catch {
      // The application state can still be initializing on first paint.
    }

    document.querySelectorAll(".navButton.active").forEach((button) => button.classList.remove("active"));
  }

  function sync() {
    frame = 0;
    showHomepageAtRoot();
    loadPublicSummary();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  function onRouteChange() {
    schedule();
    window.setTimeout(schedule, 0);
    window.setTimeout(schedule, 100);
  }

  history.pushState = function patchedPushState(...args) {
    const result = nativePushState(...args);
    onRouteChange();
    return result;
  };
  history.replaceState = function patchedReplaceState(...args) {
    const result = nativeReplaceState(...args);
    onRouteChange();
    return result;
  };

  function onDocumentClick(event) {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    const url = new URL(link.href, window.location.origin);
    if (url.origin === window.location.origin && (url.pathname === "/" || url.pathname === "/changelog")) {
      window.setTimeout(onRouteChange, 0);
    }
  }

  window.addEventListener("popstate", onRouteChange);
  document.addEventListener("click", onDocumentClick, true);

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-page", "hidden"],
    childList: true,
    subtree: true,
  });

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("popstate", onRouteChange);
    document.removeEventListener("click", onDocumentClick, true);
    history.pushState = nativePushState;
    history.replaceState = nativeReplaceState;
  }

  window.__mflPublicRouteSummaryRuntime = {
    version: VERSION,
    sync,
    destroy,
  };

  sync();
  [0, 50, 150, 400, 1000, 2000, 5000].forEach((delay) => window.setTimeout(schedule, delay));
})();
