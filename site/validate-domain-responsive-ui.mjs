const validators = [
  "validate-responsive-layout.mjs",
  "validate-mobile-footer-floor.mjs",
  "validate-settings-mobile-actions.mjs",
  "validate-evaluation-mobile-first-paint.mjs",
  "validate-evaluation-responsive-player-names.mjs",
  "validate-stats-mobile-scaling.mjs",
  "validate-mobile-table-retry.mjs",
  "validate-mobile-progression-view-widths.mjs",
  "validate-mobile-table-compact-contract.mjs",
  "validate-small-screen-table-compaction.mjs",
  "validate-mobile-first-paint-cascade.mjs",
  "validate-mobile-header-first-paint-metrics.mjs",
  "validate-mobile-pager-scaling.mjs",
  "validate-mobile-selection-bar-scaling.mjs",
  "validate-changelog-responsive-scaling.mjs",
];

for (const validator of validators) {
  console.log(`[responsive-ui] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[responsive-ui] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Responsive UI validator domain passed: ${validators.length} validators in one process.`);
