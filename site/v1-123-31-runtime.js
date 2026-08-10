(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.31");
  const previous = window.__mflV12331Runtime;
  previous?.destroy?.();

  let destroyed = false;
  let observer = null;
  let evaluationFocusQueued = false;

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function appBusy() {
    return document.documentElement.classList.contains("mflInteractionBusy")
      || document.documentElement.dataset.interactionBusy === "true";
  }

  function linkedWallet() {
    try {
      const value = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim().toLowerCase();
      if (!value) return "";
      return value.startsWith("0x") ? value : `0x${value}`;
    } catch {
      return "";
    }
  }

  function routeWatchlistId() {
    const segment = decodeURIComponent(cleanPath().match(/^\/watchlist(?:\/([^/]+))?/)?.[1] || "");
    return new Set(["attributes", "next-overall", "contracts", "current-season", "all-time"]).has(segment)
      ? ""
      : segment;
  }

  function liveWatchlistIdentity() {
    try {
      if (typeof state !== "object" || !state || !Array.isArray(state.watchlists)) return null;
      const routeId = routeWatchlistId();
      const id = routeId || String(state.currentWatchlistId || "");
      const selected = state.watchlists.find((watchlist) => String(watchlist?.id || "") === id)
        || (!id ? state.watchlists[0] : null);
      return selected ? { id: String(selected.id || ""), name: String(selected.name || "").trim() } : null;
    } catch {
      return null;
    }
  }

  function cachedWatchlistIdentity() {
    const wallet = linkedWallet();
    if (!wallet) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(`mfl-wallet-watchlist-v1:${wallet}`) || "[]");
      if (!Array.isArray(saved)) return null;
      const watchlists = saved.filter((item) => item && typeof item === "object" && !Array.isArray(item));
      const routeId = routeWatchlistId();
      const selected = routeId
        ? watchlists.find((watchlist) => String(watchlist.id || "") === routeId)
        : watchlists[0];
      return selected ? { id: String(selected.id || ""), name: String(selected.name || "").trim() } : null;
    } catch {
      return null;
    }
  }

  function visibleWatchlistName() {
    const text = String(document.getElementById("tablePageTitle")?.textContent || "").trim();
    const match = text.match(/^Watchlist\s*-\s*(.+)$/i);
    const name = String(match?.[1] || "").trim();
    return name && name !== "Default" && name !== "-" ? name : "";
  }

  function pinWatchlistTitle() {
    if (!/^\/watchlist(?:\/|$)/i.test(cleanPath())) return;
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;
    const identity = liveWatchlistIdentity() || cachedWatchlistIdentity();
    const name = String(identity?.name || visibleWatchlistName() || "Default").trim() || "Default";
    const nextTitle = `Watchlist - ${name}`;
    if (title.textContent !== nextTitle) title.textContent = nextTitle;
  }

  function evaluationSelected() {
    if (cleanPath() !== "/evaluation") return true;
    const params = new URLSearchParams(location.search);
    if (params.get("player") || params.get("saved") || params.get("share")) return true;
    try {
      if (typeof state === "object" && state?.evaluationPlayerId) return true;
    } catch {
      // Static startup runs before legacy state exists.
    }
    const panel = document.getElementById("evaluationPanel");
    return panel instanceof HTMLElement && !panel.hidden;
  }

  function evaluationReady() {
    return cleanPath() === "/evaluation"
      && document.documentElement.dataset.mflReady === "true"
      && !appBusy();
  }

  function keepEvaluationAtStaticPosition() {
    if (cleanPath() !== "/evaluation" || evaluationReady()) return;
    const main = document.querySelector("main");
    if (main instanceof HTMLElement && main.scrollTop !== 0) main.scrollTop = 0;
    if (document.scrollingElement && document.scrollingElement.scrollTop !== 0) {
      document.scrollingElement.scrollTop = 0;
    }
  }

  function syncEvaluationInput() {
    const input = document.getElementById("evaluationSearchInput");
    if (!(input instanceof HTMLInputElement)) return;
    if (cleanPath() !== "/evaluation") {
      if (input.dataset.staticFocusGuard === "true") {
        input.inert = false;
        delete input.dataset.staticFocusGuard;
      }
      return;
    }

    if (!evaluationReady()) {
      input.inert = true;
      input.dataset.staticFocusGuard = "true";
      if (document.activeElement === input) input.blur();
      keepEvaluationAtStaticPosition();
      return;
    }

    input.inert = false;
    delete input.dataset.staticFocusGuard;
  }

  function focusEvaluationWhenReady() {
    if (evaluationFocusQueued || !evaluationReady() || evaluationSelected()) return;
    const input = document.getElementById("evaluationSearchInput");
    if (!(input instanceof HTMLInputElement) || input.value.trim()) return;
    evaluationFocusQueued = true;
    requestAnimationFrame(() => {
      evaluationFocusQueued = false;
      syncEvaluationInput();
      if (!evaluationReady() || evaluationSelected() || input.value.trim()) return;
      input.focus({ preventScroll: true });
    });
  }

  function guardEvaluationFocus(event) {
    const input = document.getElementById("evaluationSearchInput");
    if (event.target !== input || evaluationReady()) return;
    input.blur();
    keepEvaluationAtStaticPosition();
  }

  function sync() {
    if (destroyed) return;
    pinWatchlistTitle();
    syncEvaluationInput();
    keepEvaluationAtStaticPosition();
    focusEvaluationWhenReady();
  }

  document.addEventListener("focusin", guardEvaluationFocus, true);

  observer = new MutationObserver(() => {
    // MutationObserver callbacks run before paint. Pin the watchlist title and
    // Evaluation focus/scroll state synchronously so hydration cannot flash a
    // temporary title, selected input, or shifted layout for one rendered frame.
    sync();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "data-page", "data-mfl-ready", "data-interaction-busy"],
  });
  window.addEventListener("popstate", sync);
  window.addEventListener("mfl:ready", sync);
  sync();

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    observer = null;
    document.removeEventListener("focusin", guardEvaluationFocus, true);
    window.removeEventListener("popstate", sync);
    window.removeEventListener("mfl:ready", sync);
    const input = document.getElementById("evaluationSearchInput");
    if (input instanceof HTMLInputElement && input.dataset.staticFocusGuard === "true") {
      input.inert = false;
      delete input.dataset.staticFocusGuard;
    }
  }

  window.__mflV12331Runtime = Object.freeze({ version: VERSION, sync, destroy });
})();
