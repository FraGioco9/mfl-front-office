const validators = [
  "validate-table-route-core.mjs",
  "validate-pager-current-page.mjs",
  "validate-table-column-layout.mjs",
  "validate-table-progression-spacing.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
  "validate-listing-column.mjs",
  "validate-player-table-actions.mjs",
  "validate-player-table-action-menu-rerender.mjs",
  "validate-new-player-icon.mjs",
  "validate-progression-joined-agency-filter.mjs",
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
