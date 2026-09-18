import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { materializeDeploymentCommit } from "./deployment-commit.mjs";

const require = createRequire(import.meta.url);
const { listLegacyPublicAssetPaths } = require("./legacy-public-assets.cjs");

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, "public");

export async function prepareNextRuntime() {
  materializeDeploymentCommit({ root });

  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(publicRoot, { recursive: true });

  for (const relativePath of listLegacyPublicAssetPaths(root)) {
    const source = resolve(root, relativePath);
    const destination = resolve(publicRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }

  if (process.env.MFL_BUILD_VERBOSE === "1") {
    console.log("Prepared Next.js public compatibility assets.");
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) await prepareNextRuntime();
