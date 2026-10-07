import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [contributing, prTemplate, maintenance, runbook, ownership, workflowInventory, workflowFiles] = await Promise.all([
  read("../CONTRIBUTING.md"),
  read("../.github/PULL_REQUEST_TEMPLATE.md"),
  read("../.github/ISSUE_TEMPLATE/maintenance.yml"),
  read("../docs/pr-stack-runbook.md"),
  read("../docs/ownership.md"),
  read("../docs/github-actions-workflows.md"),
  readdir(new URL("../.github/workflows/", import.meta.url)),
]);

for (const source of [contributing, prTemplate, runbook]) {
  assert.match(source, /exact[- ]head|exact current PR head|exact PR head/i);
  assert.match(source, /squash merge/i);
  assert.match(source, /generated/i);
  assert.match(source, /rollback/i);
}

assert.match(contributing, /Use `Refs #<issue>` for intermediate PRs/);
assert.match(contributing, /Use `Closes #<issue>` only on the PR that is intended to complete/);
assert.match(contributing, /one writer: \*\*Site quality\*\*/i);
assert.match(contributing, /git push --force-with-lease/);
assert.match(contributing, /Merging a PR does not implicitly authorize a Vercel deployment/);

assert.match(prTemplate, /Refs #/);
assert.match(prTemplate, /Closes #/);
assert.match(prTemplate, /Exact head SHA checked/);
assert.match(prTemplate, /PASS, WAIVED, DEFERRED, or NOT APPLICABLE/);
assert.match(prTemplate, /Squash merge has explicit maintainer approval/);

for (const id of ["stack", "release", "rollback"]) {
  assert.match(maintenance, new RegExp("id: " + id));
}
assert.match(maintenance, /milestone/i);
assert.match(maintenance, /live operation/i);

assert.match(runbook, /Refs #1034/);
assert.match(runbook, /Closes #1034/);
assert.match(runbook, /Worked example: three-PR issue/);
assert.match(runbook, /behind = 0/);
assert.match(runbook, /release.json/);
assert.match(runbook, /do not mark a waived\/deferred test as PASS/i);

assert.match(ownership, /Generated tracked artifacts still have one writer: Site Quality/);

const trackedWorkflows = workflowFiles.filter((name) => name.endsWith(".yml")).sort();
const declaredCount = workflowInventory.match(/There are \*\*(\d+) workflows\*\*/);
assert.ok(declaredCount, "Workflow inventory must declare the tracked workflow count.");
assert.equal(Number(declaredCount[1]), trackedWorkflows.length, "Workflow inventory count must match .github/workflows.");
const documentedWorkflows = [...workflowInventory.matchAll(/\| `([^`]+\.yml)` \|/g)]
  .map((match) => match[1])
  .sort();
assert.deepEqual(documentedWorkflows, trackedWorkflows, "Workflow inventory must list every workflow exactly once.");

console.log("DOC-03 repository workflow documentation contracts verified.");
