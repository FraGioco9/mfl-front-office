import { createRequire } from "node:module";
import { relative, resolve } from "node:path";

import { prepareNextRuntime } from "./prepare-next-runtime.mjs";

const require = createRequire(import.meta.url);
const { isLegacyPublicAssetRelativePath } = require("./legacy-public-assets.cjs");

export class MflLegacyDevBridgePlugin {
  constructor({ root = process.cwd() } = {}) {
    this.root = resolve(root);
  }

  apply(compiler) {
    compiler.hooks.watchRun.tapPromise("MflLegacyDevBridgePlugin", async (watchingCompiler) => {
      const modifiedFiles = watchingCompiler.modifiedFiles;
      if (!modifiedFiles?.size) return;

      const projectionChanged = Array.from(modifiedFiles).some((file) => {
        const relativePath = relative(this.root, resolve(file));
        return isLegacyPublicAssetRelativePath(relativePath);
      });
      if (!projectionChanged) return;

      await prepareNextRuntime();
    });
  }
}
