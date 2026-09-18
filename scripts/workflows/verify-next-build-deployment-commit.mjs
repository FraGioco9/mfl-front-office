import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeDeploymentCommit } from "../../deployment-commit.mjs";

export async function verifyNextBuildDeploymentCommit({
  expected,
  manifestPath = resolve(process.cwd(), ".next/required-server-files.json"),
} = {}) {
  const normalizedExpected = normalizeDeploymentCommit(expected, { allowEmpty: false });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const builtCommit = normalizeDeploymentCommit(manifest?.config?.env?.MFL_DEPLOY_COMMIT || "");
  if (builtCommit !== normalizedExpected) {
    throw new Error(`Next build manifest deployment commit mismatch: expected ${normalizedExpected}, received ${builtCommit || "empty"}.`);
  }
  return builtCommit;
}

const expected = process.argv[2];
if (expected) {
  const commit = await verifyNextBuildDeploymentCommit({ expected });
  console.log(`Verified Next build manifest contains deployment commit ${commit}.`);
}
