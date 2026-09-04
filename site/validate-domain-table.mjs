const validators = [
  "validate-table-route-core.mjs",
  "validate-pager-current-page.mjs",
  "validate-table-column-layout.mjs",
  "validate-table-progression-spacing.mjs",
  "validate-table-row-vertical-centering.mjs",
  "validate-table-header-typography.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
  "validate-listing-column.mjs",
  "validate-marketplace-state-freshness.mjs",
  "validate-player-table-actions.mjs",
  "validate-player-table-action-menu-rerender.mjs",
  "validate-player-table-action-menu-scroll.mjs",
  "validate-selection-action-menu-readiness.mjs",
  "validate-table-sort-session.mjs",
  "validate-progression-sorting.mjs",
  "validate-header-selection-loading.mjs",
  "validate-new-player-icon.mjs",
  "validate-progression-joined-agency-filter.mjs",
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
  console.log(`[table] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[table] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Table validator domain passed: ${validators.length} validators in one process.`);
