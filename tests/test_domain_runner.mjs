import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
};

const allSource = await readFile(new URL("../validate-all.mjs", import.meta.url), "utf8");
for (const [domain, expected] of Object.entries(expectedValidators)) {
  const source = await readFile(new URL("../validate-domain-" + domain + ".mjs", import.meta.url), "utf8");
  const listed = Array.from(source.matchAll(/"(validate-[^"]+\.mjs)"/g), (match) => match[1]);
  assert.deepEqual(listed, expected, domain + " must retain the original validator list and order");
  assert.match(source, /runDomainValidators\(/, domain + " must use the shared executor");
  assert.match(allSource, new RegExp('"validate-domain-' + domain + '\\.mjs"'), domain + " must stay in validate-all");
}
assert.equal(Object.values(expectedValidators).flat().length, 11);

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

  const passing = runCase(["first.mjs", "second.mjs"]);
  assert.equal(passing.error, undefined, "success fixture process must start");
  assert.equal(passing.status, 0, passing.stderr);
  assert.equal(
    passing.stdout,
    "[fixture] first.mjs\nfixture-first\n" +
      "[fixture] second.mjs\nfixture-second\n" +
      "Fixture validator domain passed: 2 validators in one process.\n",
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

console.log("SIM-08 pilot: Club/Stats 11-validator inventory, shared-process ordering, logs and fail-fast/exit contract passed.");
