import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { projectLegacyPublicAssets } from "./prepare-next-runtime.mjs";

const root = await mkdtemp(join(tmpdir(), "mfl-public-projection-"));
const sourceRoot = join(root, "source");
const destinationRoot = join(root, "public");

try {
  await mkdir(join(sourceRoot, "modules"), { recursive: true });
  await mkdir(join(destinationRoot, "modules"), { recursive: true });
  await writeFile(join(sourceRoot, "index.html"), "<main>Current shell</main>");
  await writeFile(join(sourceRoot, "modules", "app-entry.js"), "export default 'current';");
  await writeFile(join(destinationRoot, "keep-existing.txt"), "keep");
  await writeFile(join(destinationRoot, "modules", "stale.js"), "keep until explicitly cleaned");

  const args = {
    assets: ["index.html", "modules/app-entry.js"],
    sourceRoot,
    destinationRoot,
  };
  await Promise.all(Array.from({ length: 3 }, () => projectLegacyPublicAssets(args)));
  assert.equal(await readFile(join(destinationRoot, "index.html"), "utf8"), "<main>Current shell</main>");
  assert.equal(await readFile(join(destinationRoot, "modules", "app-entry.js"), "utf8"), "export default 'current';");
  assert.equal(await readFile(join(destinationRoot, "keep-existing.txt"), "utf8"), "keep");
  assert.equal(await readFile(join(destinationRoot, "modules", "stale.js"), "utf8"), "keep until explicitly cleaned");

  await writeFile(join(sourceRoot, "index.html"), "<main>Updated shell</main>");
  await projectLegacyPublicAssets(args);
  assert.equal(await readFile(join(destinationRoot, "index.html"), "utf8"), "<main>Updated shell</main>");
  assert.equal(await readFile(join(destinationRoot, "modules", "app-entry.js"), "utf8"), "export default 'current';");
  console.log("Next live-public projection regression passed: concurrent copies preserved existing files and updated the shell.");
} finally {
  await rm(root, { recursive: true, force: true });
}
