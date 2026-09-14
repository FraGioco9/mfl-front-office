const validators = [
  "validate-database-stats-lazy-runtime.mjs",
  "validate-stats-animation-owner.mjs",
  "validate-stats-navigation-lifecycle.mjs",
  "validate-mfl-stats-first-paint.mjs",
  "validate-mfl-stats-data-scope.mjs",
];

for (const validator of validators) {
  console.log(`[stats] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[stats] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Stats validator domain passed: ${validators.length} validators in one process.`);
