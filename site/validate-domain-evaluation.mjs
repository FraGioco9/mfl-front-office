const validators = [
  "validate-eval-ownership.mjs",
  "validate-evaluation-search-lifecycle.mjs",
  "validate-evaluation-search-clear-selection.mjs",
  "validate-evaluation-load-cache.mjs",
  "validate-evaluation-route-ownership.mjs",
  "validate-evaluation-refresh-hydration.mjs",
  "validate-evaluation-mfl-usd-edit-cancel.mjs",
  "validate-evaluation-snapshot-edit-route.mjs",
  "validate-evaluation-saved-share-icon.mjs",
];

for (const validator of validators) {
  console.log(`[evaluation] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[evaluation] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Evaluation validator domain passed: ${validators.length} validators in one process.`);
