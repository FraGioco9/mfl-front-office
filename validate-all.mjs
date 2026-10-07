import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));

const validators = [
  "validate-domain-build-generated.mjs",
  "validate-domain-route-features.mjs",
  "validate-domain-release-deployment.mjs",
  "tests/test_cleanup_unused_branches.mjs",
  "tests/test_ci_quality_scope.mjs",
  "tests/test_planner_concurrency_edges.mjs",
  "tests/test_edge04_offline_retry.mjs",
  "tests/test_wallet_preferences_multidevice.mjs",
  "tests/test_data04_missing_value_semantics.mjs",
  "tests/test_db02_retention_policy.mjs",
  "tests/test_db03_schema_drift_inventory.mjs",
  "tests/test_db05_planner_capacity.mjs",
  "tests/test_api02_error_retry.mjs",
  "tests/test_api03_cache_privacy.mjs",
  "tests/test_unicode_search_edges.mjs",
  "tests/test_repository_workflow_docs.mjs",
  "tests/test_request_observability.mjs",
  "tests/test_ops02_operational_health_monitor.mjs",
  "tests/test_ops03_release_preflight.mjs",
  "tests/test_ops03_vercel_next_routing.mjs",
  "validate-domain-api-persistence.mjs",
  "validate-domain-shared-ui.mjs",
  "validate-domain-responsive-ui.mjs",
  "validate-domain-routing-loading.mjs",
  "validate-domain-evaluation.mjs",
  "validate-domain-stats.mjs",
  "validate-domain-club.mjs",
  "validate-domain-table.mjs",
  "validate-marketplace-overlay.mjs",
  "validation/data01-listing-cache-freshness.mjs",
  "validation/data01c-generation-regression.mjs",
  "validation/data01c3-resume-identity.mjs",
  "validate-table-payload-projection.mjs",
  "validate-contract-clauses.mjs",
  "validate-data-client-runtime-ownership.mjs",
  "validate-site-date-picker.mjs",
  "validate-local-development.mjs",
  "validate-public-projection.mjs",
  "validate-user-help-guide.mjs",
  "validate-pitch-background.mjs",
  "validate-planner-depth.mjs",
  "validate-ux05-planner-plan-state.mjs",
  "validate-ux06-microcopy.mjs",
  "validate-ui01-typography.mjs",
  "validate-ui02-overlay-scroll.mjs",
  "validate-ui03-icon-color-states.mjs",
  "validate-nav01-entity-http.mjs",
  "validate-nav02-history-scroll.mjs",
  "validate-nav03-navigation-state.mjs",
  "validate-nav04-shareable-urls.mjs",
  "validate-performance-foundations.mjs",
  "validate-perf01-capture-evidence.mjs",
  "validate-perf03b-search-boundary.mjs",
  "validate-perf05d2-name-equality.mjs",
  "validate-perf05d2-filtered-price.mjs",
  "validate-core-type-diagnostic-baseline.mjs",
  "validate-arch02-typing-boundaries.mjs",
  "validate-arch04-runtime-dependency-map.mjs",
  "validate-arch05-shared-formatters.mjs",
  "validate-arch06-generated-ownership.mjs",
  "validate-arch07-api-wrapper-contract.mjs",
  "validate-dep01-lock-contract.mjs",
  "validate-accessibility-navigation-lifecycle.mjs",
];

const requestedConcurrency = Number.parseInt(process.env.MFL_VALIDATION_CONCURRENCY || "4", 10);
const concurrency = Math.max(
  1,
  Math.min(Number.isFinite(requestedConcurrency) ? requestedConcurrency : 4, validators.length),
);
const results = new Array(validators.length);
let nextValidatorIndex = 0;

function runValidator(validator) {
  return new Promise((resolveResult) => {
    const child = spawn(
      process.execPath,
      [resolve(siteRoot, validator)],
      {
        cwd: siteRoot,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolveResult({ error, status: null, stdout, stderr }));
    child.on("close", (status) => resolveResult({ error: null, status, stdout, stderr }));
  });
}

async function worker() {
  while (true) {
    const index = nextValidatorIndex;
    nextValidatorIndex += 1;
    if (index >= validators.length) return;
    results[index] = await runValidator(validators[index]);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

let failureStatus = 0;
for (let index = 0; index < validators.length; index += 1) {
  const validator = validators[index];
  const result = results[index];
  process.stdout.write(`\n=== ${validator} ===\n`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    process.stderr.write(`${result.error.stack || result.error.message || String(result.error)}\n`);
    failureStatus ||= 1;
  } else if (result.status !== 0) {
    failureStatus ||= result.status || 1;
  }
}

if (failureStatus !== 0) {
  process.exit(failureStatus);
}
