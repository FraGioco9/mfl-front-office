import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { verifyPrebuiltNextRouting } from "../scripts/workflows/verify-prebuilt-next-routing.mjs";

const valid = verifyPrebuiltNextRouting({
  vercelConfig: { framework: "nextjs" },
  builds: { detectedFramework: { status: "detected" } },
  functionDirs: ["api/data.func", "__next.func"],
});
assert.equal(valid.detectedStatus, "detected");
assert.deepEqual([...valid.frontendFunctions], ["__next.func"]);

assert.throws(() => verifyPrebuiltNextRouting({
  vercelConfig: { framework: null },
  builds: { detectedFramework: { status: "skipped" } },
  functionDirs: ["api/data.func"],
}), /framework=nextjs/);

const explicitPreset = verifyPrebuiltNextRouting({
  vercelConfig: { framework: "nextjs" },
  builds: { detectedFramework: { status: "skipped" } },
  functionDirs: ["api/data.func", "__next.func"],
});
assert.equal(explicitPreset.detectedStatus, "skipped");
assert.deepEqual([...explicitPreset.frontendFunctions], ["__next.func"]);

assert.throws(() => verifyPrebuiltNextRouting({
  vercelConfig: { framework: "nextjs" },
  builds: { detectedFramework: { status: "skipped" } },
  functionDirs: ["api/data.func"],
}), /no non-API Vercel Function/);

const workflow = readFileSync(new URL("../.github/workflows/vercel-site-update.yml", import.meta.url), "utf8");
const stagedVerifier = readFileSync(new URL("../scripts/workflows/verify-staged-vercel-deployment.sh", import.meta.url), "utf8");
const stagedIndex = workflow.indexOf("vercel deploy --prebuilt --prod --skip-domain");
const verifyIndex = workflow.indexOf("verify-staged-vercel-deployment.sh");
const promoteIndex = workflow.indexOf("vercel promote");
assert.ok(stagedIndex >= 0, "Release workflow must stage with --skip-domain.");
assert.ok(verifyIndex > stagedIndex, "Staged deployment must be verified after creation.");
assert.ok(promoteIndex > verifyIndex, "Production promotion must occur only after staged verification.");
assert.ok(workflow.includes("verify-prebuilt-next-routing.mjs"),
  "Release workflow must validate actual prebuilt Next packaging.");
assert.ok(!workflow.includes("npm install --global vercel@latest"),
  "Release workflow must pin the Vercel CLI version.");
assert.ok(stagedVerifier.includes('vercel curl "${STAGED_DEPLOYMENT_URL}${path}"'),
  "Staged verification must address the exact staged deployment URL.");
assert.ok(!stagedVerifier.includes("--deployment"),
  "Staged verification must not use the obsolete vercel curl --deployment form.");
assert.ok(!stagedVerifier.includes('--token "$VERCEL_TOKEN"'),
  "Staged verification must authenticate through the VERCEL_TOKEN environment instead of forwarding --token to curl.");

const topLevelApiEntrypoints = readdirSync(new URL("../api/", import.meta.url), { withFileTypes: true })
  .filter(entry => entry.isFile() && /\\.(?:[cm]?js|ts)$/.test(entry.name) && !entry.name.startsWith("_"))
  .map(entry => entry.name)
  .sort();
assert.deepEqual(topLevelApiEntrypoints, [],
  "Next owns all public API routes; top-level api/ must contain only internal underscore-prefixed JavaScript helpers.");

console.log("OPS-03 Vercel Next packaging and stage/verify/promote release contract passed.");
