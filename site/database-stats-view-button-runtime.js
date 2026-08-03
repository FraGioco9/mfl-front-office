(() => {
  const VERSION = "1.120.11";
  const DATABASE_PATH = /^\/database(?:\/|$)/i;
  const STATS_PATH = /^\/database\/stats\/?$/i;

  window.__mflDatabaseStatsButtonRuntime?.destroy?.();

  let frame = 0;
  let interval = 0;
  let observer = null;
  let destroyed = false;

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
    return STATS_PATH.test(location.pathname)
      || document.body?.dataset.page === "databasestats"
      || Boolean(statsPage && !statsPage.hidden);
  }

  function openStats(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (typeof window.renderDatabaseStatsPage === "function") {
      void window.renderDatabaseStatsPage(true);
      return;
    }
    history.pushState({}, "", "/database/stats");
    window.__mflDatabaseStatsRuntime?.sync?.();
  }

  function ensureStatsButton() {
    if (!DATABASE_PATH.test(location.pathname) && document.body?.dataset.page !== "databasestats") return;

    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement)) return;

    let button = views.querySelector('.viewButton[data-view="stats"]');
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "viewButton";
      button.dataset.view = "stats";
      button.textContent = "Stats";
      button.addEventListener("click", openStats, true);

      const contracts = views.querySelector('.viewButton[data-view="contracts"]');
      if (contracts) contracts.after(button);
      else views.appendChild(button);
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
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    syncFooter();
    ensureStatsButton();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "data-page", "aria-hidden"],
  });
  window.addEventListener("popstate", schedule);
  interval = window.setInterval(schedule, 250);
  schedule();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
  }

  window.__mflDatabaseStatsButtonRuntime = {
    version: VERSION,
    sync: schedule,
    destroy,
  };
})();
