import { access, copyFile, mkdir, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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

// Idempotent even across independent Node processes; never removes the live directory.
export async function projectLegacyPublicAssets({ assets, sourceRoot, destinationRoot }) {
  await mkdir(destinationRoot, { recursive: true });
  for (const relativePath of assets) {
    const source = resolve(sourceRoot, relativePath);
    const destination = resolve(destinationRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    // Independent dev/watch and CI projection calls can copy the same asset
    // concurrently. fs.cp(force) may unlink another copy's destination just
    // before its chmod, causing ENOENT. Copy to a unique sibling and rename
    // atomically instead, without ever removing the live public directory.
    const temporary = destination + ".mfl-copy-" + randomUUID();
    try {
      await copyFile(source, temporary);
      try {
        await rename(temporary, destination);
      } catch (error) {
        if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
        // Windows can prevent replacing a file Next already has open.
        await copyFile(temporary, destination);
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

async function prepareAssets() {
  materializeDeploymentCommit({ root });
  await restoreMissingIndex();

  // Keep the live public directory in place: Next may read it while another
  // dev process or Webpack watch run is preparing the same compatibility assets.
  const assets = listLegacyPublicAssetPaths(root);
  await Promise.all(assets.map((relativePath) => access(resolve(root, relativePath))));
  await projectLegacyPublicAssets({ assets, sourceRoot: root, destinationRoot: publicRoot });

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
