(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.47");
  const MFL_STATS_PATH = /^\/mfl\/stats\/?$/i;

  window.__mflStatsFirstPaintRuntime?.destroy?.();

  let frame = 0;
  let interval = 0;
  let observer = null;
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

  function installStyles() {
    let style = document.getElementById("mflStatsFirstPaintStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflStatsFirstPaintStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html[data-initial-page="mfl/stats"] body[data-page="home"] .navButton[data-page="mfl"],
      body[data-page="mflstats"] .navButton[data-page="mfl"] {
        border-color: var(--primary) !important;
        background: var(--primary) !important;
        color: #ffffff !important;
      }

      #mflStatsPage .mflStatsHistogramBar,
      #mflStatsPage .mflStatsHistogramBar::after {
        animation: none !important;
        transition: none !important;
      }

      #mflStatsPage .mflStatsHistogram.mflStatsFinalTransition .mflStatsHistogramBar::after {
        animation: mflStatsBarRise 220ms ease-out !important;
      }
    `;
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
        requestAnimationFrame(() => requestAnimationFrame(animateFinalHistogram));
      })
      .catch(() => {
        loadRequested = false;
      });
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    installStyles();
    syncNavigation();
    wrapRenderer();
    requestCompleteStats();
    if (!isMflStats()) clearAnimationClass();
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  installStyles();
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-page", "hidden"],
  });
  interval = window.setInterval(schedule, 50);
  window.addEventListener("popstate", schedule);
  schedule();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    if (animationTimer) clearTimeout(animationTimer);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
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
