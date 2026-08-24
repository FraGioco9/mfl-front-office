const validators = [
  "validate-club-entry-workflow.mjs",
  "validate-club-refresh-startup.mjs",
  "validate-club-sorting.mjs",
  "validate-club-route-core.mjs",
  "validate-club-cache-ownership.mjs",
  "validate-club-title-loading.mjs",
];

for (const validator of validators) {
  console.log(`[club] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[club] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Club validator domain passed: ${validators.length} validators in one process.`);
