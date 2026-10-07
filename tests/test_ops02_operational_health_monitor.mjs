import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [workflow, docs] = await Promise.all([
  read("../.github/workflows/operational-health-monitor.yml"),
  read("../docs/operational-health-969.md"),
]);

assert.match(workflow, /cron: "7,37 \* \* \* \*"/);
assert.match(workflow, /if \[\[ "\$status" == "healthy" \]\]; then[\s\S]*state=closed/);
assert.match(workflow, /if \[\[ "\$status" == "warning" \]\]; then[\s\S]*existing incident stays open/);

assert.ok(
  workflow.includes("printf '%s\\n'"),
  "OPS-02 incident bodies must be assembled with printf instead of an unquoted heredoc.",
);
assert.ok(
  workflow.includes("'Source: `GET /api/operational-health`.'"),
  "OPS-02 alert source must remain literal Markdown and must not execute as shell command substitution.",
);
assert.ok(
  !workflow.includes("cat <<EOF"),
  "OPS-02 incident body must not use an unquoted heredoc that can execute Markdown backticks.",
);

assert.match(
  docs,
  /If the overall status improves only\s+to `warning`, the existing incident stays open because recovery is not complete\./,
);
assert.match(
  docs,
  /Only a later\s+`healthy` check posts one recovery comment and closes the incident automatically\./,
);

console.log("OPS-02 operational health monitor alert and recovery contracts verified.");
