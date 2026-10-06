import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeDeploymentCommit } from "../../deployment-commit.mjs";
import { verifyNextBuildDeploymentCommit } from "./verify-next-build-deployment-commit.mjs";

async function findFunctionDirectories(root) {
  const matches = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith(".func")) {
      matches.push(fullPath);
      continue;
    }
    matches.push(...await findFunctionDirectories(fullPath));
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
  manifestPath = resolve(process.cwd(), ".next/required-server-files.json"),
} = {}) {
  const normalizedExpected = normalizeDeploymentCommit(expected, { allowEmpty: false });

  await verifyNextBuildDeploymentCommit({
    expected: normalizedExpected,
    manifestPath,
  });

  const functionDirectories = await findFunctionDirectories(functionsRoot);
  if (functionDirectories.length === 0) {
    throw new Error(`Prebuilt Vercel output does not contain any .func directories under ${functionsRoot}.`);
  }

  for (const functionDirectory of functionDirectories) {
    if (await directoryContainsCommit(functionDirectory, normalizedExpected)) {
      return functionDirectory;
    }
  }

  throw new Error(
    `Prebuilt Vercel functions do not contain deployment commit ${normalizedExpected}.`,
  );
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const expected = normalizeDeploymentCommit(process.argv[2], { allowEmpty: false });
  const matchedFunction = await verifyPrebuiltDeploymentCommit({ expected });
  console.log(
    `Verified Next build manifest and prebuilt Vercel function contain deployment commit ${expected}: ${matchedFunction}.`,
  );
}
