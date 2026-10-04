function updateStatusDate(generatedAt) {
  if (!generatedAt) {
    return;
  }

  statusText.textContent = `Updated ${new Date(generatedAt).toLocaleString()}`;
}

function updateSummaryCounts(playerCount, walletCount) {
  const players = playerCount === null || playerCount === undefined ? NaN : Number(playerCount);
  const wallets = walletCount === null || walletCount === undefined ? NaN : Number(walletCount);
  const playerText = Number.isSafeInteger(players) && players >= 0 ? formatCount(players) : "-";
  const walletText = Number.isSafeInteger(wallets) && wallets >= 0 ? formatCount(wallets) : "-";
  totalPlayers.textContent = playerText;
  totalWallets.textContent = walletText;
  homePlayers.textContent = playerText;
  homeWallets.textContent = walletText;
}

let summaryLoadPromise = null;
let summaryLoaded = false;
let summarySnapshot = null;

function setHomeSummaryLoadFailed(failed) {
  if (typeof document === "undefined") return;
  const notice = document.getElementById("homeSummaryLoadError");
  const retry = /** @type {HTMLButtonElement | null} */ (document.getElementById("homeSummaryRetryButton"));
  if (notice) notice.hidden = !failed;
  if (retry) retry.disabled = !failed;
}

if (typeof document !== "undefined") {
  document.getElementById("homeSummaryRetryButton")?.addEventListener("click", () => {
    if (summaryLoadPromise) return;
    void loadSummary();
  });
}

function homeSummaryCacheReady() {
  return summaryLoaded && Boolean(summarySnapshot);
}

function invalidateHomeSummarySnapshot() {
  summaryLoaded = false;
  summarySnapshot = null;
  if (state.currentPage === "home") updateSummaryCounts(null, null);
}

Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({
  isReady: homeSummaryCacheReady,
  invalidate: invalidateHomeSummarySnapshot,
}));

async function loadSummary() {
  if (summaryLoaded && summarySnapshot) {
    updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
    return true;
  }
  if (summaryLoadPromise) return summaryLoadPromise;

  summaryLoadPromise = (async () => {
    setHomeSummaryLoadFailed(false);
    try {
      const response = await window.__mflDataClient.fetch("/api/data?mode=bootstrap", { cache: "no-store", headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load the database summary.");
      const incomingGeneration = String(data.manifest?.generated_at || "").trim();
      const observedGeneration = String(state.manifest?.generated_at || "").trim();
      // A concurrent route may have already observed a newer immutable SQLite
      // generation while this Home bootstrap request was still pending.
      if (incomingGeneration && observedGeneration
        && Number.isFinite(Date.parse(incomingGeneration))
        && Number.isFinite(Date.parse(observedGeneration))
        && Date.parse(incomingGeneration) < Date.parse(observedGeneration)) {
        throw new Error("Database summary changed while loading. Retry.");
      }
      state.manifest = data.manifest || state.manifest || null;
      if (typeof syncIncrementalCacheNamespace === "function") syncIncrementalCacheNamespace();
      const summary = data.summary || {};
      if (![summary.playerCount, summary.walletCount].every(
        value => value !== null && value !== undefined
          && Number.isSafeInteger(Number(value)) && Number(value) >= 0
      )) throw new Error("Database summary is incomplete.");
      summarySnapshot = Object.freeze({
        playerCount: summary.playerCount,
        walletCount: summary.walletCount,
      });
      updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
      updateStatusDate(summary.generatedAt);
      summaryLoaded = true;
      return true;
    } catch (error) {
      console.error(error?.message || "Could not load the database summary.");
      updateSummaryCounts(null, null);
      setHomeSummaryLoadFailed(true);
      return false;
    }
  })();

  const result = await summaryLoadPromise;
  summaryLoadPromise = null;
  return result;
}
