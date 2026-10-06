import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// EDGE-04: isolated source-execution fixture. No account, Supabase, Vercel,
// production database, browser profile or external network.
const personalSource = await readFile("modules/core-sources/shared-personal-state.js", "utf8");
const plannerSource = await readFile("modules/core-sources/planner.js", "utf8");
const settingsSource = await readFile("modules/core-sources/settings.js", "utf8");

assert.match(
  plannerSource,
  /Network unavailable\. Check your connection and try again\./,
  "Planner mutations must keep explicit network failure feedback",
);
assert.match(
  settingsSource,
  /Settings could not be saved\. Your changes are kept; select Save to retry\./,
  "Settings must retain the local draft and expose an explicit retry path",
);
assert.match(
  personalSource,
  /Local wallet watchlist and notes are still available if cloud sync is unavailable\./,
  "Wallet preference loading must preserve the local offline fallback",
);

const start = personalSource.indexOf("function showWatchlistCloudSyncFailure()");
const end = personalSource.indexOf("function saveTableState()", start);
assert(start >= 0 && end > start, "EDGE-04 wallet preference owner boundaries missing");
const sourceSlice = personalSource.slice(start, end);

class Element {
  constructor(tagName = "") {
    this.tagName = String(tagName).toUpperCase();
    this.className = "";
    this.type = "";
    this.textContent = "";
    this.children = [];
    this.listeners = {};
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }
  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }
}

function nodeText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  const own = String(node.textContent || "");
  const children = Array.isArray(node.children) ? node.children.map(nodeText).join("") : "";
  return own + children;
}

let fetchMode = "reject";
let fetchCalls = 0;
let localWatchlistWrites = 0;
const toasts = [];
const state = {
  linkedWalletAddress: "0xabc",
  walletPreferencesSaveSequence: 0,
  walletPreferencesWritePromise: Promise.resolve(),
  watchlistPlayerIdsAdded: new Set(["1"]),
  watchlistPlayerIdsRemoved: new Set(),
  settingsSaveInFlight: false,
  settingsReceiveEmailsFor: [],
  playerNotes: {},
  currentWatchlistId: "watchlist-1",
  currentPage: "watchlist",
  walletPreferencesLoaded: true,
};

const context = vm.createContext({
  state,
  window: {
    __mflDataClient: {
      async fetch() {
        fetchCalls += 1;
        if (fetchMode === "reject") throw new TypeError("Failed to fetch");
        if (fetchMode === "503") {
          return { ok: false, status: 503, async json() { return { error: "Service unavailable" }; } };
        }
        return { ok: true, status: 200, async json() { return { watchlists: [] }; } };
      },
    },
  },
  document: {
    createElement: (tagName) => new Element(tagName),
    createTextNode: (text) => ({ textContent: String(text), children: [] }),
  },
  hasWalletProof: () => true,
  saveWalletWatchlistLocally() { localWatchlistWrites += 1; },
  saveWalletNotesLocally() {},
  loadPendingSettingsLocally: () => null,
  currentSettingsPayloadForSave: () => ({ receiveEmailsFor: [] }),
  savePendingSettingsLocally() {},
  normalizedPlayerNotes: (value) => value || {},
  watchlistsPayload: () => [{ id: "watchlist-1", name: "Default", playerIds: ["1"] }],
  stripPersistentSortState: (value) => value,
  currentTableState: () => ({}),
  currentEvaluationSettingsPayload: () => ({}),
  walletProofHeaders: () => ({}),
  clearSyncedWatchlistChanges() {},
  applyWatchlists() {},
  applySettingsPayload() {},
  reconcileSettingsReceiveEmailsForWithCurrentWatchlists: (value) => Array.isArray(value) ? value : [],
  clearPendingSettingsLocally() {},
  applyFilters() {},
  tablePageKey: () => "",
  renderTable() {},
  renderPlayerPage() {},
  playerIdFromUrl: () => "",
  async loadWalletPreferences() { return true; },
  hideToast() {},
  showToast(message, options = {}) {
    toasts.push({ message, text: nodeText(message), options });
  },
});

vm.runInContext(sourceSlice, context);

// Background/local-first saves remain quiet: EDGE-04 must not introduce an
// opaque automatic retry loop or noisy toast for every best-effort sync.
await context.performWalletPreferencesSave({ domains: ["watchlists"] });
assert.equal(fetchCalls, 1);
assert.equal(toasts.length, 0, "Background watchlist sync failure should remain quiet");
assert.equal(localWatchlistWrites, 1, "Watchlist must be persisted locally before cloud sync");

// A user-triggered watchlist mutation gets explicit, actionable offline feedback.
await context.performWalletPreferencesSave({
  domains: ["watchlists"],
  notifyWatchlistSyncFailure: true,
});
assert.equal(fetchCalls, 2);
assert.equal(localWatchlistWrites, 2);
assert.equal(toasts.length, 1);
const failureToast = toasts.at(-1);
assert.match(failureToast.text, /saved on this device but not synced/i);
assert.equal(failureToast.options.urgent, true);
assert.equal(failureToast.options.sticky, true);

const retryButton = failureToast.message.children.find((child) => child?.tagName === "BUTTON");
assert(retryButton, "Offline watchlist feedback must expose a Retry button");
assert.equal(retryButton.textContent, "Retry");
assert.equal(typeof retryButton.listeners.click, "function");
assert.equal(fetchCalls, 2, "Retry must not run automatically");

// Retry is localized to watchlists and only starts from the explicit click.
fetchMode = "ok";
retryButton.listeners.click();
await Promise.resolve();
await state.walletPreferencesWritePromise;
assert.equal(fetchCalls, 3);
assert.equal(toasts.at(-1).text, "Watchlist synced.");
assert.equal(localWatchlistWrites, 3);

// HTTP failures are surfaced exactly like offline transport failures.
fetchMode = "503";
await context.performWalletPreferencesSave({
  domains: ["watchlists"],
  notifyWatchlistSyncFailure: true,
});
assert.equal(fetchCalls, 4);
assert.match(toasts.at(-1).text, /saved on this device but not synced/i);

console.log("EDGE04_OFFLINE_RETRY_PASS " + JSON.stringify({
  plannerNetworkFeedback: true,
  settingsDraftRetry: true,
  watchlistLocalFirst: true,
  watchlistExplicitRetry: true,
  noAutomaticRetry: true,
  transportAndHttpFailuresCovered: true,
  noLiveServices: true,
}));
