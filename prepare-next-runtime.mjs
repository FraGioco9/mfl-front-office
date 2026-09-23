import { access, cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assembleFragments, writeGeneratedFragmentFile } from "./build-fragments.mjs";
import { materializeDeploymentCommit } from "./deployment-commit.mjs";

const require = createRequire(import.meta.url);
const { listLegacyPublicAssetPaths } = require("./legacy-public-assets.cjs");

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, "public");
const indexPath = resolve(root, "index.html");
const indexFragments = new URL("./html-sources/", import.meta.url);
let preparation = null;

async function restoreMissingIndex() {
  try {
    await access(indexPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // The generated shell is tracked, but local branch switching can remove it
    // while the Next Webpack legacy-asset watcher is running.
    await writeGeneratedFragmentFile(indexPath, await assembleFragments(indexFragments, ".html"));
  }
}

async function prepareAssets() {
  materializeDeploymentCommit({ root });
  await restoreMissingIndex();

  // Never discard the working public projection before checking its sources.
  const assets = listLegacyPublicAssetPaths(root);
  await Promise.all(assets.map((relativePath) => access(resolve(root, relativePath))));
  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(publicRoot, { recursive: true });

  for (const relativePath of assets) {
    const source = resolve(root, relativePath);
    const destination = resolve(publicRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }

  if (process.env.MFL_BUILD_VERBOSE === "1") {
    console.log("Prepared Next.js public compatibility assets.");
  }
}

export async function prepareNextRuntime() {
  // predev and the Webpack watch bridge can request a sync simultaneously.
  if (!preparation) {
    preparation = prepareAssets().finally(() => {
      preparation = null;
    });
  }
  return preparation;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) await prepareNextRuntime();
