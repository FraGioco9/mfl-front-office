(() => {
  const FEATURE_VERSION = "1.120.18";
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.123.25");
  const DATABASE_PATH = /^\/database(?:\/|$)/i;
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const WITHOUT_DATABASE_STATS_PATH = /^\/(?:watchlists?|my-players|myplayers|progression)(?:\/|$)/i;

  window.__mflReleaseVersion = RELEASE_VERSION;

  const existing = window.__mflDatabaseStatsButtonRuntime;
  if (existing?.version === FEATURE_VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  let frame = 0;
  let interval = 0;
  let observer = null;
  let observedRoot = null;
  let destroyed = false;

  function currentPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;

    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }

    const text = `MFL Front Office v${RELEASE_VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.href = "/changelog";
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = RELEASE_VERSION;
  }

  function statsIsActive() {
    const statsPage = document.getElementById("databaseStatsPage");
    return STATS_PATH.test(currentPath())
      || document.body?.dataset.page === "databasestats"
      || Boolean(statsPage && !statsPage.hidden);
  }

  function isDatabaseContext() {
    return DATABASE_PATH.test(currentPath());
  }

  function openStats(event) {
    // The same Stats button DOM node is reused by Database and MFL. A listener
    // attached while Database was active must become inert after navigation to
    // /mfl so the normal MFL handler can route to /mfl/stats.
    if (!isDatabaseContext()) return;

    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();

    if (typeof window.renderDatabaseStatsPage === "function") {
      void window.renderDatabaseStatsPage(true);
      return;
    }

    history.pushState({}, "", "/database/stats");
    location.reload();
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

    if (button.dataset.mflStatsButtonBound !== FEATURE_VERSION) {
      button.addEventListener("click", openStats, true);
      button.dataset.mflStatsButtonBound = FEATURE_VERSION;
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

    const contracts = views.querySelector('.viewButton[data-view="contracts"]');
    if (contracts && contracts.nextElementSibling !== button) contracts.after(button);

    return button;
  }

  function removeStatsFromExcludedViews() {
    if (!WITHOUT_DATABASE_STATS_PATH.test(currentPath())) return;
    document.querySelectorAll('#progressionPage .views .viewButton[data-view="stats"]')
      .forEach((button) => button.remove());
  }

  function syncStatsButtons() {
    removeStatsFromExcludedViews();
    if (!isDatabaseContext()) return;
    document.querySelectorAll("#progressionPage .views, #databaseStatsPage .views")
      .forEach(ensureButtonInViews);
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
    bindObserver();
    syncFooter();
    syncStatsButtons();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function rebind() {
    if (destroyed) return;
    observedRoot = null;
    bindObserver();
    schedule();
  }

  function onPopState() {
    schedule();
  }

  window.addEventListener("popstate", onPopState);
  interval = window.setInterval(schedule, 250);
  rebind();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", onPopState);
  }

  window.__mflDatabaseStatsButtonRuntime = {
    version: FEATURE_VERSION,
    releaseVersion: RELEASE_VERSION,
    sync: schedule,
    rebind,
    destroy,
  };
})();
