import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-responsive-layout.mjs",
  "validate-responsive-reflow.mjs",
  "validate-intermediate-desktop-smoke-layout.mjs",
  "validate-responsive-header-label-fallback.mjs",
  "validate-mobile-box-press-shape.mjs",
  "validate-mobile-footer-floor.mjs",
  "validate-footer-route-coverage.mjs",
  "validate-player-mobile-scaling.mjs",
  "validate-player-note-first-paint.mjs",
  "validate-player-view-scroll-preservation.mjs",
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

await runDomainValidators({
  domain: "responsive-ui",
  title: "Responsive UI",
  validators,
  baseUrl: import.meta.url,
});
