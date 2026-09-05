const validators = [
  "validate-css-priority.mjs",
  "validate-runtime-style-ownership.mjs",
  "validate-sidebar-lifecycle-ownership.mjs",
  "validate-dropdown-style-ownership.mjs",
  "validate-dropdown-trigger-open-highlight.mjs",
  "validate-filter-popup-interactions.mjs",
  "validate-active-filter-control.mjs",
  "validate-table-hover-scroll.mjs",
  "validate-control-style-ownership.mjs",
  "validate-evaluation-mfl-usd-focus.mjs",
  "validate-css-ownership-consolidation.mjs",
  "validate-global-escape-ownership.mjs",
  "validate-motion-ownership.mjs",
  "validate-modal-entrance-lifecycle.mjs",
  "validate-z-index-ownership.mjs",
  "validate-nationality-flag-tooltips.mjs",
  "validate-checkbox-style.mjs",
  "validate-account-button-icon.mjs",
  "validate-theme-icons.mjs",
  "validate-footer-redesign.mjs",
  "validate-footer-loading-stability.mjs",
  "validate-privacy-page.mjs",
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
