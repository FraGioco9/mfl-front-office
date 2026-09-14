/* global state, renderTable */
(() => {
  "use strict";

  const MARKETPLACE_TTL_MS = 5_000;
  let snapshot = null;
  let snapshotLoadedAt = 0;
  let snapshotPromise = null;

  function emptySnapshot() {
    return Object.freeze({ generatedAt: "", flowBlockHeight: 0, prices: Object.freeze({}) });
  }

  function normalizeSnapshot(payload) {
    const rawPrices = payload?.prices;
    const prices = {};
    if (rawPrices && typeof rawPrices === "object" && !Array.isArray(rawPrices)) {
      Object.entries(rawPrices).forEach(([playerId, value]) => {
        const numericPlayerId = Number(playerId);
        const price = Number(value);
        if (!Number.isSafeInteger(numericPlayerId) || numericPlayerId <= 0 || !Number.isFinite(price) || price < 0) return;
        prices[String(numericPlayerId)] = price;
      });
    }
    return Object.freeze({
      generatedAt: String(payload?.generatedAt || ""),
      flowBlockHeight: Number(payload?.flowBlockHeight) || 0,
      prices: Object.freeze(prices),
    });
  }

  async function fetchSnapshot(force = false) {
    const now = Date.now();
    if (!force && snapshot && now - snapshotLoadedAt < MARKETPLACE_TTL_MS) return snapshot;
    if (snapshotPromise) return snapshotPromise;

    const dataClient = window.__mflDataClient;
    if (!dataClient || typeof dataClient.fetch !== "function") {
      snapshot = emptySnapshot();
      snapshotLoadedAt = Date.now();
      return snapshot;
    }

    snapshotPromise = dataClient.fetch("/api/marketplace", { cache: "no-store" }, {
      dedupe: true,
      cacheTtlMs: force ? 0 : MARKETPLACE_TTL_MS,
      key: "marketplace-overlay",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Could not load marketplace snapshot.");
        snapshot = normalizeSnapshot(payload);
        snapshotLoadedAt = Date.now();
        return snapshot;
      })
      .catch(() => {
        snapshot = emptySnapshot();
        snapshotLoadedAt = Date.now();
        return snapshot;
      })
      .finally(() => {
        snapshotPromise = null;
      });

    return snapshotPromise;
  }

  function listingSensitiveRequest(parameters) {
    if (String(parameters.get("sortKey") || "").toLowerCase() === "listing_price") return true;

    try {
      const rules = JSON.parse(parameters.get("filters") || "[]");
      return Array.isArray(rules) && rules.some((rule) => String(rule?.column || "").toLowerCase() === "listing_price");
    } catch {
      return false;
    }
  }

  function pageRequestKey(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== "/api/data") return "";
      if (url.searchParams.get("mode") !== "page" || listingSensitiveRequest(url.searchParams)) return "";
      return url.searchParams.toString();
    } catch {
      return "";
    }
  }

  function applySnapshotToCurrentRows(nextSnapshot, requestKey) {
    if (!nextSnapshot || !requestKey) return false;
    if (typeof state === "undefined" || state.incrementalLastKey !== requestKey) return false;
    if (!Array.isArray(state.columns) || !Array.isArray(state.rows)) return false;

    const playerIdIndex = state.columns.indexOf("player_id");
    const listingIndex = state.columns.indexOf("listing_price");
    if (playerIdIndex < 0 || listingIndex < 0) return false;

    state.rows.forEach((row) => {
      if (!Array.isArray(row)) return;
      const playerId = String(row[playerIdIndex] ?? "");
      row[listingIndex] = Object.prototype.hasOwnProperty.call(nextSnapshot.prices, playerId)
        ? nextSnapshot.prices[playerId]
        : null;
    });
    state.rowSortCache = new WeakMap();

    const currentPage = String(document.body?.dataset.page || state.currentPage || "").toLowerCase();
    const currentScope = String(state.incrementalRoute?.scope || "").toLowerCase();
    if (currentPage === "player" && currentScope === "player") {
      const playerId = String(state.incrementalRoute?.playerId || "").trim();
      const renderPlayer = Reflect.get(window, "__mflRenderPlayerPageOwner");
      if (playerId && typeof renderPlayer === "function") {
        renderPlayer(playerId);
        return true;
      }
    }

    const progressionPage = document.getElementById("progressionPage");
    if (progressionPage?.hidden === false && typeof renderTable === "function") {
      renderTable();
    }
    return true;
  }

  function scheduleSync(requestKey) {
    if (!requestKey) return;
    void fetchSnapshot().then((nextSnapshot) => {
      window.requestAnimationFrame(() => {
        if (applySnapshotToCurrentRows(nextSnapshot, requestKey)) return;
        window.requestAnimationFrame(() => applySnapshotToCurrentRows(nextSnapshot, requestKey));
      });
    });
  }

  function onDataTiming(event) {
    const requestKey = pageRequestKey(event?.detail?.url);
    if (requestKey) scheduleSync(requestKey);
  }

  window.addEventListener("mfl:data-client-timing", onDataTiming);
  void fetchSnapshot();

  window.__mflMarketplaceOverlayRuntime = Object.freeze({
    refresh: () => fetchSnapshot(true),
    snapshot: () => snapshot,
    sync: (requestKey) => scheduleSync(String(requestKey || "")),
  });
})();
