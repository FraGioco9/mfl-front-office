(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.123.8");
  const MFL_STATS_PATH = /^\/mfl\/stats\/?$/i;
  const FIRST_PAINT_GUARD_CLASS = "mflStatsFirstPaintGuard";
  const FILTERS = [
    ["all", "All"],
    ["90-94", "90-94"],
    ["legendary", "Legendary"],
    ["85-89", "85-89"],
    ["80-84", "80-84"],
    ["rare", "Rare"],
    ["75-79", "75-79"],
    ["70-74", "70-74"],
    ["uncommon", "Uncommon"],
    ["65-69", "65-69"],
    ["60-64", "60-64"],
    ["limited", "Limited"],
    ["55-59", "55-59"],
    ["50-54", "50-54"],
    ["common", "Common"],
  ];

  window.__mflStatsFirstPaintRuntime?.destroy?.();

  let frame = 0;
  let interval = 0;
  let destroyed = false;
  let loadRequested = false;
  let fullStatsReady = false;
  let animationShown = false;
  let animationTimer = 0;
  let originalRenderer = null;
  let wrappedRenderer = null;

  function isMflStats() {
    return MFL_STATS_PATH.test(String(location.pathname || ""));
  }

  function syncFirstPaintGuard() {
    document.documentElement.classList.toggle(FIRST_PAINT_GUARD_CLASS, isMflStats());
  }

  function installStyles() {
    if (document.getElementById("mflStatsFirstPaintStyles")) return;
    const style = document.createElement("style");
    style.id = "mflStatsFirstPaintStyles";
    style.textContent = `
      html.${FIRST_PAINT_GUARD_CLASS} #progressionPage {
        display: none !important;
      }

      html.${FIRST_PAINT_GUARD_CLASS} #mflStatsPage {
        display: block !important;
      }

      html[data-initial-page="mfl/stats"] body[data-page="home"] .navButton[data-page="mfl"],
      body[data-page="mflstats"] .navButton[data-page="mfl"] {
        border-color: var(--primary) !important;
        background: var(--primary) !important;
        color: #ffffff !important;
      }

      #mflStatsPage .mflStatsHistogramBar,
      #mflStatsPage .mflStatsHistogramBar::after,
      #databaseStatsPage .mflStatsHistogramBar,
      #databaseStatsPage .mflStatsHistogramBar::after {
        animation: none !important;
        transition: none !important;
      }

      #mflStatsPage .mflStatsHistogram.mflStatsFinalTransition .mflStatsHistogramBar::after {
        animation: mflStatsBarRise 220ms ease-out !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureStaticFilters() {
    if (!isMflStats()) return;
    const container = document.getElementById("mflStatsOverallFilters");
    if (!(container instanceof HTMLElement) || container.children.length) return;

    const fragment = document.createDocumentFragment();
    FILTERS.forEach(([id, label], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflStatsFilterButton";
      button.classList.toggle("active", index === 0);
      button.dataset.filter = id;
      button.dataset.mflStatsStatic = "true";
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.textContent = label;
      fragment.appendChild(button);
    });
    container.replaceChildren(fragment);
  }

  function syncNavigation() {
    if (!isMflStats()) return;
    document.querySelectorAll(".navButton[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "mfl");
    });
  }

  function clearAnimationClass() {
    if (animationTimer) {
      window.clearTimeout(animationTimer);
      animationTimer = 0;
    }
    document.querySelectorAll("#mflStatsPage .mflStatsHistogram.mflStatsFinalTransition")
      .forEach((histogram) => histogram.classList.remove("mflStatsFinalTransition"));
  }

  function animateFinalHistogram() {
    if (animationShown || !fullStatsReady || !isMflStats()) return;
    const histogram = document.querySelector("#mflStatsPage .mflStatsHistogram");
    if (!(histogram instanceof HTMLElement)) return;
    animationShown = true;
    clearAnimationClass();
    void histogram.offsetWidth;
    histogram.classList.add("mflStatsFinalTransition");
    animationTimer = window.setTimeout(() => {
      histogram.classList.remove("mflStatsFinalTransition");
      animationTimer = 0;
    }, 260);
  }

  function wrapRenderer() {
    const current = window.renderMflStatsPage;
    if (typeof current !== "function" || current === wrappedRenderer) return;
    if (current.__mflStatsFirstPaintWrapper === VERSION) {
      wrappedRenderer = current;
      return;
    }

    originalRenderer = current;
    wrappedRenderer = function mflStatsFirstPaintRenderer(...args) {
      const result = originalRenderer.apply(this, args);
      syncFirstPaintGuard();
      if (fullStatsReady && isMflStats() && !animationShown) {
        requestAnimationFrame(animateFinalHistogram);
      }
      return result;
    };
    wrappedRenderer.__mflStatsFirstPaintWrapper = VERSION;
    window.renderMflStatsPage = wrappedRenderer;
  }

  function requestCompleteStats() {
    if (loadRequested || !isMflStats()) return;
    const runtime = window.__mflStartupIntegrityRuntime;
    if (!runtime || typeof runtime.loadFullMflStats !== "function") return;

    loadRequested = true;
    Promise.resolve(runtime.loadFullMflStats())
      .then((payload) => {
        fullStatsReady = Boolean(payload);
        if (!fullStatsReady) {
          loadRequested = false;
          return;
        }
        runtime.sync?.();
        syncFirstPaintGuard();
        requestAnimationFrame(() => requestAnimationFrame(animateFinalHistogram));
      })
      .catch(() => {
        loadRequested = false;
      });
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    syncFirstPaintGuard();
    installStyles();
    ensureStaticFilters();
    syncNavigation();
    wrapRenderer();
    requestCompleteStats();
    if (!isMflStats()) clearAnimationClass();
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  syncFirstPaintGuard();
  installStyles();
  interval = window.setInterval(schedule, 50);
  window.addEventListener("popstate", schedule);
  schedule();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    if (animationTimer) clearTimeout(animationTimer);
    window.removeEventListener("popstate", schedule);
    document.documentElement.classList.remove(FIRST_PAINT_GUARD_CLASS);
    clearAnimationClass();
    if (wrappedRenderer && window.renderMflStatsPage === wrappedRenderer && originalRenderer) {
      window.renderMflStatsPage = originalRenderer;
    }
    document.getElementById("mflStatsFirstPaintStyles")?.remove();
  }

  window.__mflStatsFirstPaintRuntime = {
    version: VERSION,
    sync: schedule,
    destroy,
  };
})();
