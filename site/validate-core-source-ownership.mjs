import { invariant } from "./validation/assertions.mjs";
import { access } from "node:fs/promises";

import { coreSourceManifest } from "./modules/core-source-manifest.js";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const build = await read("./build-app-core.mjs");
invariant(build.includes('import { coreSourceManifest } from "./modules/core-source-manifest.js";'), "Application-core build must consume the canonical core source manifest.");
invariant(build.includes("for (const entry of coreSourceManifest)"), "Application-core build must generate every canonical split source from the manifest.");
invariant(build.includes('resolve(siteRoot, "modules", "core-sources", entry.source)'), "Application-core build must resolve canonical split source files from manifest entries.");
invariant(!build.includes("app-core-build-normalizer"), "Application-core build must not depend on behavior-changing normalizers.");
invariant(!build.includes("replaceRequired"), "Application-core build must not perform source-string behavior rewrites.");
invariant(!build.includes("modules/app-core.js"), "Application-core build must not depend on the retired monolith.");

const domains = new Set();
for (const entry of coreSourceManifest) {
  invariant(!domains.has(entry.domain), `Core source manifest domain must be unique: ${entry.domain}.`);
  domains.add(entry.domain);
  invariant(Number.isInteger(entry.maxSourceBytes) && entry.maxSourceBytes > 0, `Core source ${entry.domain} must have a positive ownership budget.`);
  invariant(String(entry.banner || "").includes("Do not edit directly"), `Core source ${entry.domain} must define a generated ownership banner.`);

  const [source, runtime] = await Promise.all([
    read(`./modules/core-sources/${entry.source}`),
    read(`./modules/${entry.runtime}`),
  ]);
  invariant(runtime.startsWith(entry.banner), `Generated ${entry.runtime} must carry the manifest-owned banner.`);
  invariant(
    runtime.slice(entry.banner.length).replace(/\s*$/, "") === source.replace(/\s*$/, ""),
    `Generated ${entry.runtime} must exactly match canonical ${entry.source}.`,
  );
  invariant(Buffer.byteLength(source.replace(/\s*$/, ""), "utf8") <= entry.maxSourceBytes, `Canonical ${entry.domain} source exceeded its manifest ownership budget.`);
}

const sharedEntry = coreSourceManifest.find(({ domain }) => domain === "shared");
invariant(sharedEntry?.source === "shared.js" && sharedEntry.maxSourceBytes <= 355000, "Shared core must keep an explicit no-growth budget so new route/domain behavior cannot silently return to the monolith.");

const retiredFiles = [
  "app-core-build-normalizer.js",
  "app-core-splitter-utils.js",
  "app-core-route-chunks.js",
  "app-core-sidebar-lifecycle.js",
  "app-core-evaluation-chunk.js",
  "app-core-evaluation-snapshot-edit-route.js",
  "app-core-settings-chunk.js",
  "app-core-settings-email-reset.js",
  "app-core-player-chunk.js",
  "app-core-filter-control-state.js",
  "app-core-table-chunk.js",
  "app-core-mobile-table.js",
  "app-core-table-row-centering.js",
  "app-core-wallet-chunk.js",
  "app-core-watchlist-route-chunk.js",
  "app-core-stats-route-ownership.js",
];
for (const file of retiredFiles) {
  try {
    await access(new URL(`./modules/${file}`, import.meta.url));
    throw new Error(`Retired application-core implementation must stay deleted: modules/${file}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("Canonical application-core manifest, generated equivalence, no-growth budgets, and retired implementation cleanup validation passed.");
