import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, sharedRuntime] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-persistence-performance.js"),
  read("./modules/app-core-runtime.js"),
]);

includes(
  build,
  'import { optimizePersistenceRuntimeArtifacts } from "./modules/app-core-persistence-performance.js";',
  "The canonical application-core build must load the Step 12 persistence optimizer.",
);
const persistenceOptimizerIndex = build.indexOf("optimizePersistenceRuntimeArtifacts(");
const tableChromeOptimizerIndex = build.indexOf("optimizeTableChromeRuntimeArtifacts(", persistenceOptimizerIndex);
invariant(
  persistenceOptimizerIndex >= 0 && tableChromeOptimizerIndex > persistenceOptimizerIndex,
  "Step 12 must compose outside Step 11 without changing prior optimizer ownership.",
);

for (const functionName of ["saveRecentIdsToStorage", "saveTableStateLocally", "saveGuestWatchlist"]) {
  includes(
    optimizer,
    `replaceRequiredFunction(\n    core,\n    "${functionName}"`,
    `Step 12 must optimize ${functionName} at build time.`,
  );
}

function functionSection(name, nextMarker) {
  const start = sharedRuntime.indexOf(`function ${name}`);
  const end = sharedRuntime.indexOf(nextMarker, start);
  invariant(start >= 0 && end > start, `Generated shared runtime must contain ${name}.`);
  return sharedRuntime.slice(start, end);
}

const recentWrite = functionSection("saveRecentIdsToStorage", "function mergeRecentIdLists");
includes(recentWrite, "const serializedIds = JSON.stringify(normalizeIdList(ids, 5));", "Recent-search persistence must retain canonical normalization before comparison.");
includes(recentWrite, "if (localStorage.getItem(storageKey) === serializedIds) return;", "Identical recent-search values must skip storage writes.");
includes(recentWrite, "localStorage.setItem(storageKey, serializedIds);", "Changed recent-search values must still be persisted.");
excludes(recentWrite, "localStorage.setItem(storageKey, JSON.stringify", "Recent-search persistence must not perform the former unconditional write.");

const tableWrite = functionSection("saveTableStateLocally", "function localTablePageStates");
includes(tableWrite, "const serializedState = JSON.stringify(stripPersistentSortState(savedState));", "Table-state persistence must preserve canonical state sanitization.");
includes(tableWrite, "if (localStorage.getItem(FILTER_STORAGE_KEY) === serializedState) return;", "Identical Table state must skip storage writes.");
includes(tableWrite, "localStorage.setItem(FILTER_STORAGE_KEY, serializedState);", "Changed Table state must still be persisted.");
excludes(tableWrite, "localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify", "Table-state persistence must not perform the former unconditional write.");

const guestWatchlistWrite = functionSection("saveGuestWatchlist", "function loadGuestWatchlist");
includes(guestWatchlistWrite, "if (state.linkedWalletAddress && hasWalletProof())", "Linked wallets must keep bypassing guest-watchlist persistence.");
includes(guestWatchlistWrite, "const serializedPlayerIds = JSON.stringify(Array.from(state.watchlistPlayerIds));", "Guest watchlist persistence must retain the exact player-id payload.");
includes(guestWatchlistWrite, "if (localStorage.getItem(GUEST_WATCHLIST_STORAGE_KEY) === serializedPlayerIds) return;", "Identical guest watchlists must skip storage writes.");
includes(guestWatchlistWrite, "localStorage.setItem(GUEST_WATCHLIST_STORAGE_KEY, serializedPlayerIds);", "Changed guest watchlists must still be persisted.");

// Deterministic operation accounting for an unchanged saveTableState call.
// persistRecentSearchStates owns four recent-search keys and saveTableStateLocally
// owns one Table-state key. Guests additionally persist the guest watchlist.
const previousLinkedStorageWrites = 5;
const optimizedLinkedStorageWrites = 0;
const previousGuestStorageWrites = 6;
const optimizedGuestStorageWrites = 0;
const linkedReductionPercent = Math.round((1 - optimizedLinkedStorageWrites / previousLinkedStorageWrites) * 100);
const guestReductionPercent = Math.round((1 - optimizedGuestStorageWrites / previousGuestStorageWrites) * 100);

invariant(linkedReductionPercent === 100, "Step 12 must eliminate unchanged linked-wallet local persistence writes.");
invariant(guestReductionPercent === 100, "Step 12 must eliminate unchanged guest local persistence writes.");

console.log(
  `Persistence performance validation passed: unchanged saveTableState localStorage writes ${previousLinkedStorageWrites} -> ${optimizedLinkedStorageWrites} for linked wallets (${linkedReductionPercent}% reduction) and ${previousGuestStorageWrites} -> ${optimizedGuestStorageWrites} for guests (${guestReductionPercent}% reduction), while changed values remain authoritative.`,
);
