import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeDeploymentCommit } from "../../deployment-commit.mjs";

async function findIdentityFunctions(root) {
  const matches = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === "identity.func") {
      matches.push(fullPath);
      continue;
    }
    matches.push(...await findIdentityFunctions(fullPath));
  }
  return matches;
}

async function directoryContainsCommit(root, expected) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (await directoryContainsCommit(fullPath, expected)) return true;
      continue;
    }
    const content = await readFile(fullPath);
    if (content.includes(Buffer.from(expected))) return true;
  }
  return false;
}

export async function verifyPrebuiltDeploymentCommit({
  expected,
  functionsRoot = resolve(process.cwd(), ".vercel/output/functions"),
} = {}) {
  const normalizedExpected = normalizeDeploymentCommit(expected, { allowEmpty: false });
  const identityFunctions = await findIdentityFunctions(functionsRoot);
  if (identityFunctions.length === 0) {
    throw new Error(`Prebuilt Vercel output does not contain an identity function under ${functionsRoot}.`);
  }

  for (const identityFunction of identityFunctions) {
    if (await directoryContainsCommit(identityFunction, normalizedExpected)) {
      return identityFunction;
    }
  }

  throw new Error(`Prebuilt identity function does not contain deployment commit ${normalizedExpected}.`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const expected = normalizeDeploymentCommit(process.argv[2], { allowEmpty: false });
  await verifyPrebuiltDeploymentCommit({ expected });
  console.log(`Verified prebuilt identity function contains deployment commit ${expected}.`);
}
