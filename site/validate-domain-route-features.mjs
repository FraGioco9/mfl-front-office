const validators = [
  "validate-global-search-results.mjs",
  "validate-global-search-open-lifecycle.mjs",
  "validate-document-title-runtime.mjs",
  "validate-settings-route-core.mjs",
  "validate-player-route-core.mjs",
  "validate-render-reuse-contract.mjs",
  "validate-agent-title-loading.mjs",
  "validate-progression-retired-filter.mjs",
  "validate-watchlist-route-core.mjs",
  "validate-watchlist-progression-access.mjs",
  "validate-watchlist-selector-navigation.mjs",
];

for (const validator of validators) {
  console.log(`[route-features] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[route-features] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Route-features validator domain passed: ${validators.length} validators in one process.`);
