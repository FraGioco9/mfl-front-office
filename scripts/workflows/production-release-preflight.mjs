import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const SELF_CHECK_NAMES = new Set(["preflight", "deploy-site"]);
const BLOCKING_CONCLUSIONS = new Set([
  "action_required",
  "cancelled",
  "failure",
  "startup_failure",
  "stale",
  "timed_out",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeSha(value, label) {
  const sha = String(value || "").trim().toLowerCase();
  invariant(SHA_PATTERN.test(sha), `${label} must be an exact 40-character Git commit SHA.`);
  return sha;
}

function latestChecksByName(checkRuns) {
  const runs = Array.isArray(checkRuns) ? checkRuns : checkRuns?.check_runs;
  invariant(Array.isArray(runs), "GitHub check-runs payload must contain check_runs.");

  const latest = new Map();
  for (const run of runs) {
    const name = String(run?.name || "").trim();
    if (!name) continue;
    const id = Number(run?.id || 0);
    const current = latest.get(name);
    if (!current || id > Number(current?.id || 0)) latest.set(name, run);
  }
  return latest;
}

export function evaluateProductionReleasePreflight({
  releaseSha,
  mainSha,
  approval,
  checkRuns,
}) {
  const release = normalizeSha(releaseSha, "release SHA");
  const main = normalizeSha(mainSha, "main SHA");
  invariant(release === main, `Release SHA ${release} is not the current main SHA ${main}.`);
  invariant(
    String(approval || "").trim() === "DEPLOY_PRODUCTION",
    "Production release approval must be DEPLOY_PRODUCTION.",
  );

  const latest = latestChecksByName(checkRuns);
  const quality = latest.get("quality");
  invariant(quality, "Required quality check is missing for the release SHA.");
  invariant(
    quality.status === "completed" && quality.conclusion === "success",
    `Required quality check is not green (status=${quality.status || "unknown"}, conclusion=${quality.conclusion || "none"}).`,
  );

  const unsettled = [];
  const blocking = [];
  for (const [name, run] of latest) {
    if (SELF_CHECK_NAMES.has(name)) continue;
    if (run.status !== "completed") {
      unsettled.push(name);
      continue;
    }
    if (BLOCKING_CONCLUSIONS.has(String(run.conclusion || ""))) {
      blocking.push(`${name}:${run.conclusion}`);
    }
  }
  invariant(unsettled.length === 0, `Release checks are still unsettled: ${unsettled.sort().join(", ")}.`);
  invariant(blocking.length === 0, `Release checks contain blocking conclusions: ${blocking.sort().join(", ")}.`);

  const fingerprintPayload = {
    releaseSha: release,
    qualityCheckId: Number(quality.id || 0),
    checks: [...latest.entries()]
      .filter(([name]) => !SELF_CHECK_NAMES.has(name))
      .map(([name, run]) => ({
        name,
        id: Number(run.id || 0),
        status: String(run.status || ""),
        conclusion: String(run.conclusion || ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(fingerprintPayload))
    .digest("hex");

  return {
    releaseSha: release,
    fingerprint,
    checkCount: fingerprintPayload.checks.length,
    qualityCheckId: fingerprintPayload.qualityCheckId,
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    invariant(value !== undefined && !value.startsWith("--"), `Missing value for --${key}.`);
    values[key] = value;
    index += 1;
  }
  return values;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  invariant(args["checks-file"], "--checks-file is required.");
  const checkRuns = JSON.parse(await readFile(args["checks-file"], "utf8"));
  const result = evaluateProductionReleasePreflight({
    releaseSha: args["release-sha"],
    mainSha: args["main-sha"],
    approval: args.approval,
    checkRuns,
  });

  if (args["github-output"]) {
    await appendFile(
      args["github-output"],
      [
        `release_sha=${result.releaseSha}`,
        `fingerprint=${result.fingerprint}`,
        `check_count=${result.checkCount}`,
        `quality_check_id=${result.qualityCheckId}`,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  console.log(
    `OPS03_RELEASE_PREFLIGHT_PASS sha=${result.releaseSha} checks=${result.checkCount} quality=${result.qualityCheckId} fingerprint=${result.fingerprint}`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}
