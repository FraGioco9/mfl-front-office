const { readdirSync } = require("node:fs");
const { extname, join } = require("node:path");

const PUBLIC_JSON = new Set([
  "release-history-overrides.json",
  "release.json",
  "ui-behavior-foundations.json",
]);

function rootAsset(name) {
  if (name === "index.html" || name === "bootstrap.js" || name === "bootstrap-core.js") return true;
  if (name.endsWith("-runtime.js")) return true;
  if (PUBLIC_JSON.has(name)) return true;
  return [".css", ".svg", ".png", ".webp", ".ico", ".woff", ".woff2"].includes(extname(name).toLowerCase());
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function isLegacyPublicAssetRelativePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || normalized.startsWith("../")) return false;
  if (!normalized.includes("/")) return rootAsset(normalized);
  if (!normalized.startsWith("modules/")) return false;
  const name = normalized.slice("modules/".length);
  return name === "app-entry.js" || /^app-core(?:-[a-z0-9-]+)?-runtime\.js$/i.test(name);
}

function listLegacyPublicAssetPaths(root) {
  const relativePaths = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && rootAsset(entry.name)) relativePaths.push(entry.name);
  }

  const modulesRoot = join(root, "modules");
  for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relativePath = join("modules", entry.name);
    if (isLegacyPublicAssetRelativePath(relativePath)) relativePaths.push(relativePath);
  }

  return relativePaths.sort();
}

module.exports = {
  isLegacyPublicAssetRelativePath,
  listLegacyPublicAssetPaths,
  rootAsset,
};
