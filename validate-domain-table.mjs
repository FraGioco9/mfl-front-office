import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-table-route-core.mjs",
  "validate-pager-current-page.mjs",
  "validate-pager-cached-route-restore.mjs",
  "validate-single-page-pager-render-commit.mjs",
  "validate-table-column-layout.mjs",
  "validate-table-foundations.mjs",
  "validate-table-progression-spacing.mjs",
  "validate-table-row-vertical-centering.mjs",
  "validate-table-header-typography.mjs",
  "validate-mobile-sticky-name-column.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
  "validate-filtered-empty-recovery.mjs",
  "validate-empty-onboarding.mjs",
  "validate-table-url-state.mjs",
  "validate-listing-column.mjs",
  "validate-marketplace-state-freshness.mjs",
  "validate-table-count-fast-path.mjs",
  "validate-player-table-actions.mjs",
  "validate-player-table-action-menu-rerender.mjs",
  "validate-player-table-action-menu-scroll.mjs",
  "validate-selection-action-menu-readiness.mjs",
  "validate-table-sort-session.mjs",
  "validate-progression-sorting.mjs",
  "validate-header-selection-loading.mjs",
  "validate-new-player-icon.mjs",
  "validate-progression-joined-agency-filter.mjs",
];

await runDomainValidators({
  domain: "table",
  title: "Table",
  validators,
  baseUrl: import.meta.url,
});
