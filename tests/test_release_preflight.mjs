import assert from "node:assert/strict";
import { evaluateProductionReleasePreflight } from "../scripts/workflows/production-release-preflight.mjs";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function payload(...runs) {
  return { check_runs: runs };
}

function run(id, name, status = "completed", conclusion = "success") {
  return { id, name, status, conclusion };
}

const pass = evaluateProductionReleasePreflight({
  releaseSha: SHA,
  mainSha: SHA,
  approval: "DEPLOY_PRODUCTION",
  checkRuns: payload(
    run(10, "quality"),
    run(11, "windows-next-dev-smoke"),
    run(12, "snapshot", "in_progress", null),
    run(13, "validate", "completed", "skipped"),
    run(14, "preflight", "in_progress", null),
  ),
});
assert.equal(pass.releaseSha, SHA);
assert.equal(pass.checkCount, 2);
assert.equal(pass.qualityCheckId, 10);
assert.match(pass.fingerprint, /^[0-9a-f]{64}$/);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: OTHER_SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(run(10, "quality"), run(11, "windows-next-dev-smoke")),
  }),
  /not the current main SHA/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "NO_DEPLOY",
    checkRuns: payload(run(10, "quality"), run(11, "windows-next-dev-smoke")),
  }),
  /approval must be DEPLOY_PRODUCTION/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(
      run(10, "quality", "completed", "failure"),
      run(11, "windows-next-dev-smoke"),
    ),
  }),
  /Required release check quality is not green/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(run(10, "quality")),
  }),
  /Required release check windows-next-dev-smoke is missing/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(
      run(10, "quality"),
      run(11, "windows-next-dev-smoke", "in_progress", null),
    ),
  }),
  /Required release check windows-next-dev-smoke is not green/,
);

const operationalChecksDoNotBlock = evaluateProductionReleasePreflight({
  releaseSha: SHA,
  mainSha: SHA,
  approval: "DEPLOY_PRODUCTION",
  checkRuns: payload(
    run(10, "quality"),
    run(11, "windows-next-dev-smoke"),
    run(20, "snapshot", "in_progress", null),
    run(21, "marketplace-health", "completed", "failure"),
    run(22, "database-refresh", "queued", null),
  ),
});
assert.equal(operationalChecksDoNotBlock.checkCount, 2);

const latestRequiredWins = evaluateProductionReleasePreflight({
  releaseSha: SHA,
  mainSha: SHA,
  approval: "DEPLOY_PRODUCTION",
  checkRuns: payload(
    run(10, "quality", "completed", "failure"),
    run(11, "windows-next-dev-smoke", "completed", "failure"),
    run(20, "quality", "completed", "success"),
    run(21, "windows-next-dev-smoke", "completed", "success"),
  ),
});
assert.equal(latestRequiredWins.checkCount, 2);
assert.equal(latestRequiredWins.qualityCheckId, 20);

console.log("OPS-03 deterministic production release preflight fixtures passed.");
