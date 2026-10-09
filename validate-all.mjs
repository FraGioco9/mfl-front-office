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
  "tests/test_domain_runner.mjs",
  "tests/test_planner_concurrency_edges.mjs",
  "tests/test_offline_retry.mjs",
  "tests/test_wallet_preferences_multidevice.mjs",
  "tests/test_missing_value_semantics.mjs",
  "tests/test_private_data_retention.mjs",
  "tests/test_schema_drift_inventory.mjs",
  "tests/test_planner_capacity.mjs",
  "tests/test_api_error_retry.mjs",
  "tests/test_api_cache_privacy.mjs",
  "tests/test_unicode_search_edges.mjs",
  "tests/test_repository_workflow_docs.mjs",
  "tests/test_request_observability.mjs",
  "tests/test_operational_health_monitor.mjs",
  "tests/test_release_preflight.mjs",
  "tests/test_vercel_next_routing.mjs",
  "validate-domain-api-persistence.mjs",
  "validate-domain-shared-ui.mjs",
  "validate-domain-responsive-ui.mjs",
  "validate-domain-routing-loading.mjs",
  "validate-domain-evaluation.mjs",
  "validate-domain-stats.mjs",
  "validate-domain-club.mjs",
  "validate-domain-table.mjs",
  "validate-marketplace-overlay.mjs",
  "validation/listing-cache-freshness.mjs",
  "validation/database-generation-regression.mjs",
  "validation/database-resume-identity.mjs",
  "validate-table-payload-projection.mjs",
  "validate-contract-clauses.mjs",
  "validate-data-client-runtime-ownership.mjs",
  "validate-site-date-picker.mjs",
  "validate-local-development.mjs",
  "validate-public-projection.mjs",
  "validate-user-help-guide.mjs",
  "validate-pitch-background.mjs",
  "validate-planner-depth.mjs",
  "validate-planner-plan-state.mjs",
  "validate-microcopy.mjs",
  "validate-typography.mjs",
  "validate-overlay-scroll.mjs",
  "validate-icon-color-states.mjs",
  "validate-entity-http.mjs",
  "validate-history-scroll.mjs",
  "validate-navigation-state.mjs",
  "validate-shareable-urls.mjs",
  "validate-performance-foundations.mjs",
  "validate-global-search-boundary.mjs",
  "validate-exact-name-lookup.mjs",
  "validate-filtered-listing-price.mjs",
  "validate-core-type-diagnostic-baseline.mjs",
  "validate-typing-boundaries.mjs",
  "validate-runtime-dependency-map.mjs",
  "validate-shared-formatters.mjs",
  "validate-generated-ownership.mjs",
  "validate-api-wrapper-contract.mjs",
  "validate-dependency-lock.mjs",
  "validate-accessibility-navigation-lifecycle.mjs",
];

// CUT-02: keep legacy slot labels/order; only Club and Stats use the new CLI.
const cutoverDomains = Object.freeze({
  "validate-domain-stats.mjs": "stats",
  "validate-domain-club.mjs": "club",
});

const validatorCommand = (validator) => (
  Object.hasOwn(cutoverDomains, validator)
    ? [resolve(siteRoot, "validation/run-domain.mjs"), cutoverDomains[validator]]
    : [resolve(siteRoot, validator)]
);

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
      validatorCommand(validator),
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
