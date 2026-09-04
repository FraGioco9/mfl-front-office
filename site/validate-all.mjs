import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));

const validators = [
  "validate-domain-build-generated.mjs",
  "validate-domain-route-features.mjs",
  "validate-domain-release-deployment.mjs",
  "validate-domain-api-persistence.mjs",
  "validate-domain-shared-ui.mjs",
  "validate-domain-responsive-ui.mjs",
  "validate-domain-routing-loading.mjs",
  "validate-domain-evaluation.mjs",
  "validate-domain-stats.mjs",
  "validate-domain-club.mjs",
  "validate-domain-table.mjs",
  "validate-site-date-picker.mjs",
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
