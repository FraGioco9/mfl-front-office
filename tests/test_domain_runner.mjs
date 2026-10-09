import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { domainSuites } from "../validation/domain-suites.mjs";

const expectedValidators = {
  "club": [
    "validate-club-entry-workflow.mjs",
    "validate-club-refresh-startup.mjs",
    "validate-club-sorting.mjs",
    "validate-club-route-core.mjs",
    "validate-club-cache-ownership.mjs",
    "validate-club-title-loading.mjs",
  ],
  "stats": [
    "validate-database-stats-lazy-runtime.mjs",
    "validate-stats-animation-owner.mjs",
    "validate-stats-navigation-lifecycle.mjs",
    "validate-mfl-stats-first-paint.mjs",
    "validate-mfl-stats-data-scope.mjs",
  ],
  "build-generated": [
    "validate-fragment-ownership.mjs",
    "validate-text-reader.mjs",
    "validate-ci-quality-scope.mjs",
    "validate.mjs",
    "validate-app-config.mjs",
    "validate-core-source-ownership.mjs",
    "validate-shared-core-route-ownership.mjs",
    "validate-asset-cache-policy.mjs",
    "validate-cache-policy.mjs",
    "validate-prebuilt-cache-model.mjs",
    "validate-tail-pagination.mjs",
    "validate-production-core-sources.mjs",
    "validate-generated-core-bindings.mjs",
  ],
  "release-deployment": [
    "validate-release-history.mjs",
    "validate-release-version-source.mjs",
    "validate-release-runtime-ownership.mjs",
    "validate-runtime-data-identity.mjs",
    "validate-generated-styles.mjs",
    "validate-next-deployment-ownership.mjs",
    "validation/cross-release-cache-regression.mjs",
    "validate-database-refresh-deployment.mjs",
    "validate-security-boundaries.mjs",
    "validate-operational-health.mjs",
  ],
  "evaluation": [
    "validate-eval-ownership.mjs",
    "validate-evaluation-search-lifecycle.mjs",
    "validation/evaluation-safari-result-tap.mjs",
    "validate-evaluation-search-fast-select.mjs",
    "validate-evaluation-search-clear-selection.mjs",
    "validate-evaluation-search-stacking.mjs",
    "validate-evaluation-load-cache.mjs",
    "validate-evaluation-route-ownership.mjs",
    "validate-evaluation-refresh-hydration.mjs",
    "validate-evaluation-overall-hover.mjs",
    "validate-evaluation-mfl-usd-edit-cancel.mjs",
    "validate-evaluation-mfl-usd-loading-race.mjs",
    "validate-evaluation-discount-derived-loading.mjs",
    "validate-evaluation-snapshot-edit-route.mjs",
    "validate-evaluation-saved-share-icon.mjs",
    "validate-progression-email-portrait.mjs",
  ],
  "responsive-ui": [
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
  ],
  "route-features": [
    "validate-global-search-results.mjs",
    "validate-global-search-agent-activation.mjs",
    "validate-global-search-open-lifecycle.mjs",
    "validate-global-search-keyboard.mjs",
    "validate-document-title-runtime.mjs",
    "validate-first-html-metadata.mjs",
    "validate-empty-states.mjs",
    "validate-entity-request-errors.mjs",
    "validate-home-search-recovery.mjs",
    "validate-evaluation-refresh-hydration.mjs",
    "validate-evaluation-stale-wallet-preferences-ui.mjs",
    "validate-settings-route-core.mjs",
    "validate-planner-route-core.mjs",
    "validate-planner-toolbar-actions.mjs",
    "validate-planner-saved-plan-actions.mjs",
    "validate-cross-domain-actions.mjs",
    "validate-planner-roster.mjs",
    "validate-settings-email-privacy.mjs",
    "validate-player-route-core.mjs",
    "validate-player-overall-loading-color.mjs",
    "validate-player-loading-plain-attributes.mjs",
    "validate-player-loading-unknown-position.mjs",
    "validate-render-reuse-contract.mjs",
    "validate-agent-title-loading.mjs",
    "validate-progression-retired-filter.mjs",
    "validate-watchlist-route-core.mjs",
    "validate-watchlist-progression-access.mjs",
    "validate-watchlist-selector-navigation.mjs",
  ],
  "routing-loading": [
    "validate-loading-ownership.mjs",
    "validate-data-shaped-loading-foundation.mjs",
    "validate-home-summary-first-paint.mjs",
    "validate-player-hero-club-branding.mjs",
    "validate-route-runtime.mjs",
    "validate-bootstrap-ownership.mjs",
    "validate-prebuilt-core-loading.mjs",
    "validate-route-core-startup-routing.mjs",
    "validate-route-page-normalization.mjs",
    "validate-route-shell-ownership.mjs",
    "validate-static-route-ui.mjs",
    "validate-wallet-opt-in-transition.mjs",
    "validate-protected-opted-out-routes.mjs",
    "validate-page-scroll-reset.mjs",
    "validate-view-button-refresh-handoff.mjs",
    "validate-generated-view-transition.mjs",
    "validate-page-route-gate-transition.mjs",
    "validate-table-loading-state.mjs",
    "validate-filter-loading-blank-rows.mjs",
    "validate-table-background-loading-stability.mjs",
    "validate-app-core-startup-handshake.mjs",
    "validate-data-client-foundation.mjs",
    "validate-client-performance-timing.mjs",
    "validate-performance-capture.mjs",
  ],
  "shared-ui": [
    "validate-css-priority.mjs",
    "validate-runtime-style-ownership.mjs",
    "validate-sidebar-lifecycle-ownership.mjs",
    "validate-dropdown-style-ownership.mjs",
    "validate-dropdown-foundations.mjs",
    "validate-dropdown-trigger-open-highlight.mjs",
    "validate-filter-popup-interactions.mjs",
    "validate-active-filter-control.mjs",
    "validate-table-hover-scroll.mjs",
    "validate-control-style-ownership.mjs",
    "validate-toast-positioning.mjs",
    "validate-ui-foundations.mjs",
    "validate-behavior-foundations.mjs",
    "validate-shadow-foundations.mjs",
    "validate-ui-foundations-ownership.mjs",
    "validate-evaluation-mfl-usd-focus.mjs",
    "validate-css-ownership-consolidation.mjs",
    "validate-global-escape-ownership.mjs",
    "validate-motion-ownership.mjs",
    "validate-modal-entrance-lifecycle.mjs",
    "validate-dialog-foundations.mjs",
    "validate-z-index-ownership.mjs",
    "validate-nationality-flag-tooltips.mjs",
    "validate-checkbox-style.mjs",
    "validate-account-button-icon.mjs",
    "validate-theme-icons.mjs",
    "validate-footer-redesign.mjs",
    "validate-footer-creator-alignment.mjs",
    "validate-footer-loading-stability.mjs",
    "validate-privacy-page.mjs",
  ],
  "table": [
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
  ],
  "api-persistence": [
    "validate-shared-api-logic.mjs",
    "validate-request-body-limits.mjs",
    "validate-wallet-proof.mjs",
    "validate-wallet-challenge.mjs",
    "validate-wallet-session.mjs",
    "validate-wallet-session-integration.mjs",
    "validate-wallet-auth-rate-limit.mjs",
    "validate-wallet-mutation-origin.mjs",
    "validate-csp-report-only.mjs",
    "validate-vercel-security-headers.mjs",
    "validate-csp-legacy-script-hashes.mjs",
    "validate-csp-next-nonce.mjs",
    "validate-csp-legacy-eval-elimination.mjs",
    "validate-wallet-permission-cache.mjs",
    "validate-data-read-cache-policy.mjs",
    "validate-public-page-cache-policy.mjs",
    "validate-database-stats-ownership.mjs",
    "validate-my-clubs-data.mjs",
    "validate-supabase-persistence.mjs",
    "validate-supabase-private-grants.mjs",
    "validate-wallet-core.mjs",
    "validate-wallet-preferences-lifecycle.mjs",
    "validate-wallet-preference-write-scoping.mjs",
    "validate-evaluation-share-expiry.mjs",
    "validate-evaluation-share-preview.mjs",
    "validate-planner-persistence.mjs",
    "validate-shared-link-boundaries.mjs",
    "validate-share-api-fixtures.mjs",
    "validate-auth-boundary.mjs",
    "validate-evaluation-preview-portrait.mjs",
    "validate-evaluation-preview-rarity-accent.mjs",
    "validate-evaluation-preview-shell-path.mjs",
    "validate-bug-report.mjs",
  ],
};

// Independent, reviewed golden metadata from the legacy domain contracts.
// Do not compute expected prefixes/titles from domainSuites or wrapper text.
const expectedDomainOutput = Object.freeze({
  "build-generated": Object.freeze({ prefix: "build/generated", title: "Build/generated" }),
  "route-features": Object.freeze({ prefix: "route-features", title: "Route-features" }),
  "release-deployment": Object.freeze({ prefix: "release/deployment", title: "Release/deployment" }),
  "api-persistence": Object.freeze({ prefix: "api/persistence", title: "API/persistence" }),
  "shared-ui": Object.freeze({ prefix: "shared-ui", title: "Shared UI" }),
  "responsive-ui": Object.freeze({ prefix: "responsive-ui", title: "Responsive UI" }),
  "routing-loading": Object.freeze({ prefix: "routing/loading", title: "Routing/loading" }),
  "evaluation": Object.freeze({ prefix: "evaluation", title: "Evaluation" }),
  "stats": Object.freeze({ prefix: "stats", title: "Stats" }),
  "club": Object.freeze({ prefix: "club", title: "Club" }),
  "table": Object.freeze({ prefix: "table", title: "Table" }),
});

// Preserve all 63 original scheduler positions (11 domains, 52 standalone).
// An explicit golden list detects accidental reordering, not just count drift.
const expectedSlotOrder = Object.freeze([
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
]);

const allSource = await readFile(new URL("../validate-all.mjs", import.meta.url), "utf8");
assert.deepEqual(Object.keys(domainSuites).sort(), Object.keys(expectedValidators).sort(), "the manifest must cover exactly eleven domains");
// The golden inventory below does not depend on wrapper contents. Later CLI
// parity fixtures inspect entrypoints, but never derive expected metadata from
// them; manifest and legacy regressions retain independent golden contracts.
assert.deepEqual(Object.keys(expectedDomainOutput).sort(), Object.keys(expectedValidators).sort());
for (const [domain, expected] of Object.entries(expectedValidators)) {
  const suite = domainSuites[domain];
  const output = expectedDomainOutput[domain];
  assert.ok(suite && output, domain + " must have a manifest suite and golden output contract");
  assert.equal(Object.isFrozen(suite), true, domain + " manifest suite must be immutable");
  assert.equal(Object.isFrozen(suite.validators), true, domain + " validators must be immutable");
  assert.deepEqual(suite.validators, expected, domain + " manifest must match the independent ordered golden validator list");
  assert.equal(suite.domain, output.prefix, domain + " must preserve the exact log prefix");
  assert.equal(suite.title, output.title, domain + " must preserve the exact success summary");
  assert.match(allSource, new RegExp('"validate-domain-' + domain + '\\.mjs"'), domain + " must retain its legacy scheduler slot label");
}
// The golden inventory must point to real validator modules, including nested paths.
const expectedFiles = [...new Set(Object.values(expectedValidators).flat())];
await Promise.all(expectedFiles.map(async (validator) => {
  assert.match(validator, /^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/i, "unexpected validator path: " + validator);
  await access(new URL("../" + validator, import.meta.url));
}));
assert.equal(Object.values(expectedValidators).flat().length, 214);
assert.equal(Object.values(domainSuites).flatMap((suite) => suite.validators).length, 214);

// CUT-03: all eleven domains route through the dispatcher; the other 52
// standalone slots keep their original scripts, order and log labels.
const slotNames = Array.from(
  allSource.match(/const validators = \[([\s\S]*?)\];/)?.[1]?.matchAll(/"([^"]+\.mjs)"/g) || [],
  (entry) => entry[1],
);
assert.equal(slotNames.length, 63, "validate-all must preserve its 63 ordered slots");
assert.deepEqual(slotNames, expectedSlotOrder, "all 63 scheduler slots must retain exact position and original legacy log heading");
const cutoverBlock = allSource.match(/const cutoverDomains = Object\.freeze\(\{([\s\S]*?)\}\);/);
assert.ok(cutoverBlock, "validate-all must declare the CUT-03 dispatcher mapping");
const cutoverEntries = Array.from(
  cutoverBlock[1].matchAll(/"([^"]+\.mjs)":\s*"([^"]+)"/g),
  (entry) => [entry[1], entry[2]],
);
const expectedDomainEntries = Object.keys(expectedValidators).map((id) => [
  "validate-domain-" + id + ".mjs",
  id,
]);
assert.equal(cutoverEntries.length, 11, "CUT-03 must dispatch eleven domain suites");
assert.deepEqual(
  Object.fromEntries(cutoverEntries),
  Object.fromEntries(expectedDomainEntries),
  "every declared domain must be dispatched exactly once, with the correct ID",
);
assert.deepEqual(
  cutoverEntries.map(([slot]) => slot).sort(),
  expectedDomainEntries.map(([slot]) => slot).sort(),
  "no standalone script may be routed through the domain dispatcher",
);
assert.ok(cutoverEntries.every(([slot, id]) =>
  slotNames.includes(slot) && Object.hasOwn(domainSuites, id)
), "every domain command must resolve to an existing legacy slot and manifest suite");
assert.equal(
  slotNames.filter((slot) => !Object.hasOwn(Object.fromEntries(cutoverEntries), slot)).length,
  52,
  "all 52 standalone scripts must retain their own child processes",
);
assert.match(allSource, /Object\.hasOwn\(cutoverDomains,\s*validator\)/);
assert.match(allSource, /resolve\(siteRoot,\s*"validation\/run-domain\.mjs"\)/);
assert.match(allSource, /spawn\(\s*process\.execPath,\s*validatorCommand\(validator\)/);
assert.match(allSource, /const results = new Array\(validators\.length\)/, "keep ordered results independent from concurrency");
assert.match(allSource, /results\[index\] = await runValidator\(validators\[index\]\)/, "keep result slots indexed");
assert.match(allSource, /for \(let index = 0; index < validators\.length; index \+= 1\)/, "log output must follow original slot order");
assert.match(allSource, /failureStatus \|\|= result\.status \|\| 1/, "nonzero validator exits must propagate");
assert.match(allSource, /if \(failureStatus !== 0\) \{\s*process\.exit\(failureStatus\)/, "scheduler must exit nonzero if any slot fails");

const dispatcherSource = await readFile(new URL("../validation/run-domain.mjs", import.meta.url), "utf8");
assert.match(dispatcherSource, /baseUrl:\s*new URL\("\.\.\/",\s*import\.meta\.url\)/, "dispatcher imports must resolve from the repository root");
assert.match(
  dispatcherSource,
  /process\.argv\.splice\(2\);[\s\S]*await runDomain\(domainId\)/,
  "dispatcher must clear the CLI domain ID before importing validators so scripts inspecting argv[2] behave as in legacy one-file runners",
);
const dispatcherPath = fileURLToPath(new URL("../validation/run-domain.mjs", import.meta.url));
const invalidDomain = spawnSync(process.execPath, [dispatcherPath, "not-a-domain"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  encoding: "utf8",
  timeout: 15_000,
});
assert.equal(invalidDomain.status, 2, "unknown domain must fail without running validators");
assert.equal(invalidDomain.stdout, "");
assert.match(invalidDomain.stderr, /Usage: node validation\/run-domain\.mjs <domain-id>/);
const validDomain = spawnSync(process.execPath, [dispatcherPath, "club"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  encoding: "utf8",
  timeout: 45_000,
});
assert.equal(validDomain.error, undefined, "dispatcher club smoke must start");
assert.equal(validDomain.status, 0, validDomain.stderr);
assert.match(validDomain.stdout, /\[club\] validate-club-entry-workflow\.mjs/);
assert.match(validDomain.stdout, /Club validator domain passed: 6 validators in one process\./);
assert.equal(validDomain.stderr, "");

const helperUrl = new URL("../validation/domain-runner.mjs", import.meta.url).href;
const scratch = await mkdtemp(join(tmpdir(), "mfl-sim08-domain-runner-"));
try {
  await writeFile(join(scratch, "first.mjs"), [
    'if (globalThis.__pilotStep !== undefined) throw new Error("wrong initial context");',
    'globalThis.__pilotStep = 1;',
    'console.log("fixture-first");',
  ].join("\n") + "\n");
  await writeFile(join(scratch, "second.mjs"), [
    'if (globalThis.__pilotStep !== 1) throw new Error("different process or wrong order");',
    'globalThis.__pilotStep = 2;',
    'console.log("fixture-second");',
  ].join("\n"));
  await mkdir(join(scratch, "validation"));
  await writeFile(join(scratch, "validation", "nested.mjs"), [
    'if (globalThis.__pilotStep !== 2) throw new Error("nested resolution must retain one process and ordering");',
    'globalThis.__pilotStep = 3;',
    'console.log("fixture-nested");',
  ].join("\n") + "\n");
  await writeFile(join(scratch, "broken.mjs"), 'throw new Error("expected synthetic failure");\n');
  await writeFile(join(scratch, "never.mjs"), 'console.log("unexpected-after-failure");\n');

  const fixtureEntry = pathToFileURL(join(scratch, "entry.mjs")).href;
  function runCase(validators) {
    const program = [
      'import { runDomainValidators } from ' + JSON.stringify(helperUrl) + ';',
      'await runDomainValidators({ domain: "fixture", title: "Fixture", validators: ' +
        JSON.stringify(validators) + ', baseUrl: ' + JSON.stringify(fixtureEntry) + ' });',
    ].join("\n");
    return spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
      encoding: "utf8",
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      timeout: 15_000,
    });
  }

  const passing = runCase(["first.mjs", "second.mjs", "validation/nested.mjs"]);
  assert.equal(passing.error, undefined, "success fixture process must start");
  assert.equal(passing.status, 0, passing.stderr);
  assert.equal(
    passing.stdout,
    "[fixture] first.mjs\nfixture-first\n" +
      "[fixture] second.mjs\nfixture-second\n" +
      "[fixture] validation/nested.mjs\nfixture-nested\n" +
      "Fixture validator domain passed: 3 validators in one process.\n",
    "the executor must preserve validator ordering and summary logging",
  );
  assert.equal(passing.stderr, "");

  const failing = runCase(["first.mjs", "broken.mjs", "never.mjs"]);
  assert.equal(failing.error, undefined, "failure fixture process must start");
  assert.notEqual(failing.status, 0, "first failure must propagate as a process failure");
  assert.match(failing.stdout, /^\[fixture\] first\.mjs\nfixture-first\n\[fixture\] broken\.mjs\n$/);
  assert.match(failing.stderr, /\[fixture\] FAILED broken\.mjs/);
  assert.match(failing.stderr, /expected synthetic failure/);
  assert.doesNotMatch(failing.stdout + failing.stderr, /unexpected-after-failure|Fixture validator domain passed/);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

// CUT-04.3C: executable parity against an INDEPENDENT golden reconstruction of
// the pre-cutover entrypoint. Neither the golden inventory nor this baseline
// reads the actual Club/Stats wrapper source files.
const cliRoot = fileURLToPath(new URL("../", import.meta.url));
for (const domain of ["club", "stats"]) {
  const wrapperUrl = new URL("../validate-domain-" + domain + ".mjs", import.meta.url);
  const wrapperPath = fileURLToPath(wrapperUrl);
  const expected = expectedDomainOutput[domain];
  const validators = expectedValidators[domain];

  for (const extraArgs of [[], ["--cut04-legacy-extra"]]) {
    const legacyProgram = [
      "import { runDomainValidators } from " + JSON.stringify(helperUrl) + ";",
      // The legacy filename and positional argv remain observable to imports.
      "process.argv = [process.execPath, " + JSON.stringify(wrapperPath) +
        ", ..." + JSON.stringify(extraArgs) + "];",
      "await runDomainValidators({ domain: " + JSON.stringify(expected.prefix) +
        ", title: " + JSON.stringify(expected.title) +
        ", validators: " + JSON.stringify(validators) +
        ", baseUrl: new URL(" + JSON.stringify(wrapperUrl.href) + ") });",
    ].join("\n");
    const options = { cwd: cliRoot, encoding: "utf8", timeout: 90_000, maxBuffer: 16 * 1024 * 1024 };
    const legacy = spawnSync(process.execPath, ["--input-type=module", "--eval", legacyProgram], options);
    const current = spawnSync(process.execPath, [wrapperPath, ...extraArgs], options);
    const label = domain + (extraArgs.length ? " with legacy extra argv" : " with no args");
    assert.equal(legacy.error, undefined, label + ": reference process must start");
    assert.equal(current.error, undefined, label + ": wrapper process must start");
    assert.equal(current.signal, legacy.signal, label + ": same termination signal");
    assert.equal(current.status, legacy.status, label + ": same exit status");
    if (extraArgs.length === 0) assert.equal(current.status, 0, label + ": success required");
    assert.equal(current.stdout, legacy.stdout, label + ": ordered log output must match");
    if (legacy.status === 0) {
      assert.equal(current.stderr, legacy.stderr, label + ": no new warnings/errors");
      // Legacy Node/SQLite warnings are allowed only when byte-identical to the baseline.
      assert.match(current.stdout, new RegExp(expected.title + " validator domain passed: " + validators.length + " validators in one process\\."));
    } else {
      // Node's stack trace contains a different physical entrypoint in the
      // golden --eval child. Preserve the observable failure prefix instead.
      assert.match(current.stderr, /FAILED|Error:/, label + ": failure must remain visible");
      assert.match(legacy.stderr, /FAILED|Error:/, label + ": reference failure must remain visible");
    }
  }
}

// runDomain is the same awaited helper for both thin entrypoints: a rejected
// domain propagates as a nonzero process exit rather than being swallowed.
const invalidProgram = [
  "import { runDomain } from " +
    JSON.stringify(new URL("../validation/run-domain.mjs", import.meta.url).href) + ";",
  'await runDomain("cut04-unknown-domain");',
].join("\n");
const invalidHelper = spawnSync(process.execPath, ["--input-type=module", "--eval", invalidProgram], {
  cwd: cliRoot, encoding: "utf8", timeout: 15_000,
});
assert.equal(invalidHelper.error, undefined);
assert.notEqual(invalidHelper.status, 0);
assert.match(invalidHelper.stderr, /Unknown validation domain: cut04-unknown-domain/);

console.log("SIM-09A CUT-04.3C: legacy Club/Stats CLI, extra argv, golden order/logs, status and failure propagation parity passed.");

// CUT-04.3D: isolated executable parity for the other nine historic CLI paths.
// The 214-validator golden inventory above is independent of these wrapper
// sources: this section reads wrappers only AFTER validating the golden contract.
const remainingDomainIds = Object.keys(expectedValidators).filter((id) => id !== "club" && id !== "stats");
assert.equal(remainingDomainIds.length, 9, "exactly nine CLI wrappers must be piloted");
const cliFixtureRoot = await mkdtemp(join(tmpdir(), "mfl-cut04-cli-parity-"));
try {
  await mkdir(join(cliFixtureRoot, "validation"));
  // Isolate child processes from real validators and production data. The
  // fixture exercises the actual wrapper text, Node argv/cwd and import path.
  const fixtureRunner = [
    "export async function runDomainValidators({ domain, title, validators, baseUrl }) {",
    '  const expected = JSON.parse(process.env.MFL_CUT04_EXPECTED);',
    '  if (domain !== expected.prefix || title !== expected.title || JSON.stringify(validators) !== JSON.stringify(expected.validators)) throw new Error("golden metadata mismatch");',
    '  console.log("CUT04_CONTEXT " + JSON.stringify({ argv: process.argv.slice(1), cwd: process.cwd(), urls: validators.map((v) => new URL("./" + v, baseUrl).href) }));',
    '  for (const validator of validators) {',
    '    console.log("[" + domain + "] " + validator);',
    '    if (validator === process.env.MFL_CUT04_FAIL_AT) {',
    '      console.error("[" + domain + "] FAILED " + validator);',
    '      throw new Error("CUT04 synthetic failure");',
    '    }',
    '  }',
    '  console.log(title + " validator domain passed: " + validators.length + " validators in one process.");',
    '}',
  ].join("\n") + "\n";
  const fixtureDispatcher = [
    'import { runDomainValidators } from "./domain-runner.mjs";',
    "export async function runDomain(id) {",
    '  const expected = JSON.parse(process.env.MFL_CUT04_EXPECTED);',
    '  if (id !== expected.id) throw new Error("Unexpected CLI domain: " + id);',
    "  await runDomainValidators({ domain: expected.prefix, title: expected.title,",
    '    validators: expected.validators, baseUrl: new URL("../", import.meta.url) });',
    "}",
  ].join("\n") + "\n";
  await writeFile(join(cliFixtureRoot, "validation", "domain-runner.mjs"), fixtureRunner);
  await writeFile(join(cliFixtureRoot, "validation", "run-domain.mjs"), fixtureDispatcher);

  for (const id of remainingDomainIds) {
    const filename = "validate-domain-" + id + ".mjs";
    const source = await readFile(new URL("../" + filename, import.meta.url), "utf8");
    const expectedThinSource = [
      'import { runDomain } from "./validation/run-domain.mjs";',
      "",
      "// Keep the legacy CLI path, argv, and process boundary while sharing the manifest.",
      'await runDomain("' + id + '");',
      "",
    ].join("\n");
    assert.equal(source, expectedThinSource, id + ": keep the exact standalone CLI path and same-process delegation");
    const expected = { id, ...expectedDomainOutput[id], validators: expectedValidators[id] };
    const fixturePath = join(cliFixtureRoot, filename);
    // Independent reconstruction of the actual previous wrapper contract.
    const legacySource = [
      'import { runDomainValidators } from "./validation/domain-runner.mjs";',
      "const validators = " + JSON.stringify(expected.validators) + ";",
      "await runDomainValidators({ domain: " + JSON.stringify(expected.prefix) +
        ", title: " + JSON.stringify(expected.title) + ", validators, baseUrl: import.meta.url });",
      "",
    ].join("\n");

    const scenarios = [
      { name: "normal", args: [], failAt: "" },
      { name: "extra argv", args: ["--cut04-legacy-extra", "fixture-value"], failAt: "" },
      { name: "fail-fast", args: ["--cut04-legacy-extra"], failAt: expected.validators[1] },
    ];
    for (const scenario of scenarios) {
      const runOptions = {
        cwd: cliFixtureRoot, encoding: "utf8", timeout: 15_000, maxBuffer: 512 * 1024,
        env: { ...process.env, MFL_CUT04_EXPECTED: JSON.stringify(expected), MFL_CUT04_FAIL_AT: scenario.failAt },
      };
      await writeFile(fixturePath, legacySource);
      const baseline = spawnSync(process.execPath, [fixturePath, ...scenario.args], runOptions);
      await writeFile(fixturePath, source);
      const current = spawnSync(process.execPath, [fixturePath, ...scenario.args], runOptions);
      const label = id + " / " + scenario.name;
      assert.equal(baseline.error, undefined, label + ": legacy subprocess must start");
      assert.equal(current.error, undefined, label + ": delegated subprocess must start");
      assert.equal(current.signal, baseline.signal, label + ": termination signal parity");
      assert.equal(current.status, baseline.status, label + ": exit status parity");
      assert.equal(current.stdout, baseline.stdout, label + ": ordered output, argv, cwd, import URLs and titles");
      if (scenario.failAt) {
        assert.notEqual(current.status, 0, label + ": error must propagate as nonzero exit");
        assert.equal(current.stderr.split("\n")[0], baseline.stderr.split("\n")[0], label + ": same failure marker");
        assert.match(current.stderr, /CUT04 synthetic failure/, label + ": exception propagates");
        assert.doesNotMatch(current.stdout, /validator domain passed/, label + ": no success summary on failure");
        assert.equal(current.stdout.includes("[" + expected.prefix + "] " + expected.validators[2]), false, label + ": no validator after failure");
      } else {
        assert.equal(current.status, 0, label + ": success exit code");
        assert.equal(current.stderr, baseline.stderr, label + ": stderr parity");
        assert.equal(current.stderr, "", label + ": no unexpected stderr");
      }
    }
  }
} finally {
  await rm(cliFixtureRoot, { recursive: true, force: true });
}
console.log("SIM-09A CUT-04.3D: nine preserved legacy CLI paths pass independent golden subprocess parity for argv, ordered logs, import URLs and success/fail-fast.");

console.log("SIM-09A CUT-04.1: independent 214-validator/11-domain golden inventory, exact 63-slot ordering, output and failure contracts passed without deriving golden expectations from wrapper contents.");
