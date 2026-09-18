import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeDeploymentCommit } from "../../deployment-commit.mjs";

const expected = normalizeDeploymentCommit(process.argv[2], { allowEmpty: false });
const functionsRoot = resolve(process.cwd(), process.argv[3] || ".vercel/output/functions");

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

async function directoryContainsCommit(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (await directoryContainsCommit(fullPath)) return true;
      continue;
    }
    const content = await readFile(fullPath);
    if (content.includes(Buffer.from(expected))) return true;
  }
  return false;
}

const identityFunctions = await findIdentityFunctions(functionsRoot);
if (identityFunctions.length === 0) {
  throw new Error(`Prebuilt Vercel output does not contain an identity function under ${functionsRoot}.`);
}

for (const identityFunction of identityFunctions) {
  if (await directoryContainsCommit(identityFunction)) {
    console.log(`Verified prebuilt identity function contains deployment commit ${expected}.`);
    process.exit(0);
  }
}

throw new Error(`Prebuilt identity function does not contain deployment commit ${expected}.`);
