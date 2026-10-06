import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

console.log("OPS-03 Vercel Next packaging and stage/verify/promote release contract passed.");
