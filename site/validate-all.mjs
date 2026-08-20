import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const validationTextPreload = pathToFileURL(resolve(siteRoot, "validate-text-read-preload.mjs")).href;

const validators = [
  "validate-text-read-normalization.mjs",
  "validate.mjs",
  "validate-release-history.mjs",
  "validate-release-runtime-ownership.mjs",
  "validate-app-config.mjs",
  "validate-css-priority.mjs",
  "validate-runtime-style-ownership.mjs",
  "validate-sidebar-lifecycle-ownership.mjs",
  "validate-dropdown-style-ownership.mjs",
  "validate-control-style-ownership.mjs",
  "validate-loading-ownership.mjs",
  "validate-eval-ownership.mjs",
  "validate-route-runtime.mjs",
  "validate-app-core-splitter-architecture.mjs",
  "validate-shared-core-route-ownership.mjs",
  "validate-evaluation-route-ownership.mjs",
  "validate-nationality-flag-tooltips.mjs",
  "validate-bootstrap-ownership.mjs",
  "validate-prebuilt-core-loading.mjs",
  "validate-asset-cache-policy.mjs",
  "validate-production-core-sources.mjs",
  "validate-route-core-startup-routing.mjs",
  "validate-route-page-normalization.mjs",
  "validate-database-stats-lazy-runtime.mjs",
  "validate-static-route-ui.mjs",
  "validate-mfl-stats-first-paint.mjs",
  "validate-mfl-stats-data-scope.mjs",
  "validate-generated-view-transition.mjs",
  "validate-page-route-gate-transition.mjs",
  "validate-club-route-core.mjs",
  "validate-settings-route-core.mjs",
  "validate-player-route-core.mjs",
  "validate-table-route-core.mjs",
  "validate-table-column-layout.mjs",
  "validate-wallet-core.mjs",
  "validate-watchlist-route-core.mjs",
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
