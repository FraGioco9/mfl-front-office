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
    run(12, "Mobile first-paint regression"),
    run(13, "preflight", "in_progress", null),
  ),
});
assert.equal(pass.releaseSha, SHA);
assert.equal(pass.checkCount, 3);
assert.equal(pass.qualityCheckId, 10);
assert.match(pass.fingerprint, /^[0-9a-f]{64}$/);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: OTHER_SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(run(10, "quality")),
  }),
  /not the current main SHA/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "NO_DEPLOY",
    checkRuns: payload(run(10, "quality")),
  }),
  /approval must be DEPLOY_PRODUCTION/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(run(10, "quality", "completed", "failure")),
  }),
  /quality check is not green/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(
      run(10, "quality"),
      run(11, "browser", "completed", "failure"),
    ),
  }),
  /blocking conclusions/,
);

assert.throws(
  () => evaluateProductionReleasePreflight({
    releaseSha: SHA,
    mainSha: SHA,
    approval: "DEPLOY_PRODUCTION",
    checkRuns: payload(
      run(10, "quality"),
      run(11, "browser", "in_progress", null),
    ),
  }),
  /still unsettled/,
);

const latestWins = evaluateProductionReleasePreflight({
  releaseSha: SHA,
  mainSha: SHA,
  approval: "DEPLOY_PRODUCTION",
  checkRuns: payload(
    run(10, "quality"),
    run(20, "browser", "completed", "failure"),
    run(21, "browser", "completed", "success"),
  ),
});
assert.equal(latestWins.checkCount, 2);

console.log("OPS-03 production release preflight fixtures passed.");
