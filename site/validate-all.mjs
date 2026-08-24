import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const validationTextPreload = pathToFileURL(resolve(siteRoot, "validate-text-read-preload.mjs")).href;

const validators = [
  "validate-text-read-normalization.mjs",
  "validate.mjs",
  "validate-global-search-results.mjs",
  "validate-global-search-open-lifecycle.mjs",
  "validate-release-history.mjs",
  "validate-release-version-source.mjs",
  "validate-release-runtime-ownership.mjs",
  "validate-document-title-runtime.mjs",
  "validate-app-config.mjs",
  "validate-shared-api-logic.mjs",
  "validate-supabase-persistence.mjs",
  "validate-css-priority.mjs",
  "validate-responsive-layout.mjs",
  "validate-runtime-style-ownership.mjs",
  "validate-sidebar-lifecycle-ownership.mjs",
  "validate-dropdown-style-ownership.mjs",
  "validate-filter-popup-interactions.mjs",
  "validate-control-style-ownership.mjs",
  "validate-global-escape-ownership.mjs",
  "validate-motion-ownership.mjs",
  "validate-modal-entrance-lifecycle.mjs",
  "validate-z-index-ownership.mjs",
  "validate-loading-ownership.mjs",
  "validate-home-summary-first-paint.mjs",
  "validate-eval-ownership.mjs",
  "validate-evaluation-search-lifecycle.mjs",
  "validate-evaluation-search-clear-selection.mjs",
  "validate-evaluation-load-cache.mjs",
  "validate-route-runtime.mjs",
  "validate-app-core-splitter-architecture.mjs",
  "validate-shared-core-route-ownership.mjs",
  "validate-evaluation-route-ownership.mjs",
  "validate-evaluation-refresh-hydration.mjs",
  "validate-nationality-flag-tooltips.mjs",
  "validate-bootstrap-ownership.mjs",
  "validate-prebuilt-core-loading.mjs",
  "validate-asset-cache-policy.mjs",
  "validate-production-core-sources.mjs",
  "validate-database-refresh-deployment.mjs",
  "validate-route-core-startup-routing.mjs",
  "validate-route-page-normalization.mjs",
  "validate-database-stats-lazy-runtime.mjs",
  "validate-stats-animation-owner.mjs",
  "validate-stats-navigation-lifecycle.mjs",
  "validate-static-route-ui.mjs",
  "validate-view-button-refresh-handoff.mjs",
  "validate-mfl-stats-first-paint.mjs",
  "validate-mfl-stats-data-scope.mjs",
  "validate-generated-view-transition.mjs",
  "validate-page-route-gate-transition.mjs",
  "validate-club-entry-workflow.mjs",
  "validate-club-refresh-startup.mjs",
  "validate-club-sorting.mjs",
  "validate-club-route-core.mjs",
  "validate-club-cache-ownership.mjs",
  "validate-club-title-loading.mjs",
  "validate-settings-route-core.mjs",
  "validate-player-route-core.mjs",
  "validate-render-reuse-contract.mjs",
  "validate-table-route-core.mjs",
  "validate-pager-current-page.mjs",
  "validate-agent-title-loading.mjs",
  "validate-table-column-layout.mjs",
  "validate-table-loading-state.mjs",
  "validate-table-background-loading-stability.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
  "validate-progression-retired-filter.mjs",
  "validate-wallet-core.mjs",
  "validate-watchlist-route-core.mjs",
  "validate-watchlist-progression-access.mjs",
  "validate-watchlist-selector-navigation.mjs",
  "validate-app-core-startup-handshake.mjs",
  "validate-generated-core-bindings.mjs",
];

for (const validator of validators) {
  const result = spawnSync(
    process.execPath,
    ["--import", validationTextPreload, resolve(siteRoot, validator)],
    {
      cwd: siteRoot,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
