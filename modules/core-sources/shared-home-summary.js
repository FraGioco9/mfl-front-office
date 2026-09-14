function updateStatusDate(generatedAt) {
  if (!generatedAt) {
    return;
  }

  statusText.textContent = `Updated ${new Date(generatedAt).toLocaleString()}`;
}

function updateSummaryCounts(playerCount, walletCount) {
  const players = Number(playerCount || 0);
  const wallets = Number(walletCount || 0);
  totalPlayers.textContent = players ? formatCount(players) : "-";
  totalWallets.textContent = wallets ? formatCount(wallets) : "-";
  homePlayers.textContent = players ? formatCount(players) : "-";
  homeWallets.textContent = wallets ? formatCount(wallets) : "-";
}

let summaryLoadPromise = null;
let summaryLoaded = false;
let summarySnapshot = null;

function homeSummaryCacheReady() {
  return summaryLoaded && Boolean(summarySnapshot);
}

Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({
  isReady: homeSummaryCacheReady,
}));

async function loadSummary() {
  if (summaryLoaded && summarySnapshot) {
    updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
    return true;
  }
  if (summaryLoadPromise) return summaryLoadPromise;

  summaryLoadPromise = (async () => {
    try {
      const response = await window.__mflDataClient.fetch("/api/data?mode=bootstrap", { cache: "no-store", headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load the database summary.");
      state.manifest = data.manifest || null;
      const summary = data.summary || {};
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
      updateSummaryCounts(0, 0);
      return false;
    }
  })();

  const result = await summaryLoadPromise;
  summaryLoadPromise = null;
  return result;
}
