const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { listLegacyPublicAssetPaths } = require("./legacy-public-assets.cjs");

module.exports = function mflLegacyDevWatchLoader() {
  if (typeof this.cacheable === "function") this.cacheable(false);

  const root = this.rootContext || process.cwd();
  const hash = createHash("sha256");

  for (const relativePath of listLegacyPublicAssetPaths(root)) {
    const absolutePath = resolve(root, relativePath);
    this.addDependency(absolutePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }

  return `export default ${JSON.stringify(hash.digest("hex"))};\n`;
};
