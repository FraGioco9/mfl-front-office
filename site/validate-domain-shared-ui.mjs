const validators = [
  "validate-css-priority.mjs",
  "validate-responsive-layout.mjs",
  "validate-runtime-style-ownership.mjs",
  "validate-sidebar-lifecycle-ownership.mjs",
  "validate-dropdown-style-ownership.mjs",
  "validate-filter-popup-interactions.mjs",
  "validate-control-style-ownership.mjs",
  "validate-css-ownership-consolidation.mjs",
  "validate-global-escape-ownership.mjs",
  "validate-motion-ownership.mjs",
  "validate-modal-entrance-lifecycle.mjs",
  "validate-z-index-ownership.mjs",
  "validate-nationality-flag-tooltips.mjs",
];

for (const validator of validators) {
  console.log(`[shared-ui] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[shared-ui] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Shared UI validator domain passed: ${validators.length} validators in one process.`);
