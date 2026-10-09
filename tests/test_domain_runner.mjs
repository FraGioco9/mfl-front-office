import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
};

const allSource = await readFile(new URL("../validate-all.mjs", import.meta.url), "utf8");
for (const [domain, expected] of Object.entries(expectedValidators)) {
  const source = await readFile(new URL("../validate-domain-" + domain + ".mjs", import.meta.url), "utf8");
  const match = source.match(/const validators = \[([\s\S]*?)\];/);
  assert.ok(match, domain + " must declare an ordered validator array");
  const listed = Array.from(match[1].matchAll(/"([^"]+\.mjs)"/g), (entry) => entry[1]);
  assert.deepEqual(listed, expected, domain + " must retain the original validator list and order");
  assert.match(source, /runDomainValidators\(/, domain + " must use the shared executor");
  assert.match(source, /baseUrl:\s*import\.meta\.url/, domain + " must preserve relative imports");
  if (["evaluation", "responsive-ui", "route-features", "routing-loading"].includes(domain)) {
    const contract = {
      evaluation: ["evaluation", "Evaluation"],
      "responsive-ui": ["responsive-ui", "Responsive UI"],
      "route-features": ["route-features", "Route-features"],
      "routing-loading": ["routing/loading", "Routing/loading"],
    }[domain];
    assert.ok(source.includes('domain: "' + contract[0] + '"'), domain + " must retain the original log prefix");
    assert.ok(source.includes('title: "' + contract[1] + '"'), domain + " must retain the original success summary");
  }
  assert.match(allSource, new RegExp('"validate-domain-' + domain + '\\.mjs"'), domain + " must stay in validate-all");
}
assert.equal(Object.values(expectedValidators).flat().length, 125);

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

console.log("SIM-08: eight domains (125 validators), nested imports, shared-process ordering, logs, fail-fast and exit contract passed.");
