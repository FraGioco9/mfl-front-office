import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");
const retainedCoreSourcePath = resolve(root, "modules/legacy-core.js");
const corePreparationModulePath = resolve(root, "modules/core-runtime.js");

async function runtimeSourceFiles(directory = root) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".vercel" || entry.name === "tests") continue;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await runtimeSourceFiles(absolutePath));
      continue;
    }
    if (absolutePath === retainedCoreSourcePath || absolutePath === corePreparationModulePath) continue;
    if ([".js", ".mjs"].includes(extname(entry.name))) files.push(absolutePath);
  }

  return files;
}

test("release metadata is the current Semantic Version source", async () => {
  const release = JSON.parse(await read("release.json"));
  assert.match(release.version, /^\d+\.\d+\.\d+$/);
  assert.equal(release.version, "1.123.0");
  assert.ok(release.description.length > 20);
});

test("retired bootstrap architecture is absent from the active entry", async () => {
  const entry = await read("modules/app-entry.js");
  const bridge = await read("app.js");
  assert.doesNotMatch(entry, /document\.(open|write|close)\s*\(/);
  assert.doesNotMatch(bridge, /document\.(open|write|close)\s*\(/);
  assert.doesNotMatch(entry, /index-shell\.html|bootstrap\.js/);
});

test("classic application core keeps whole-script startup semantics after preparation", async () => {
  const [{ prepareCoreRuntimeSource }, loader] = await Promise.all([
    import(pathToFileURL(corePreparationModulePath)),
    import(pathToFileURL(resolve(root, "modules/runtime-loader.js"))),
  ]);
  const source = await read("modules/legacy-core.js");
  const preparedSource = prepareCoreRuntimeSource(source);

  assert.ok(preparedSource.length > 0);
  assert.doesNotMatch(preparedSource, /withInteractionBusy/);
  assert.equal(typeof loader.loadPreparedClassicScript, "function");

  const entry = await read("modules/app-entry.js");
  assert.match(entry, /loadPreparedClassicScript\(/);
  assert.match(entry, /prepareCoreRuntimeSource/);
  assert.doesNotMatch(entry, /loadPartitionedClassicScript\(/);
  assert.doesNotMatch(entry, /loadClassicScript\("\/modules\/legacy-core\.js"/);
});

test("season-ratio endpoint preserves the completed-row query", async () => {
  const source = await read("api/mfl-season-ratios-v2.js");
  assert.match(source, /require\("\.\.\/release\.json"\)/);
  assert.match(source, /mfl_season_ratios\?select=season,ratio&order=season\.desc&limit=\$\{REQUIRED_RATIO_ROWS\}/);
  assert.doesNotMatch(source, /completed|status=|season\.lte/);
});

test("the retired interaction-busy facade is absent from active runtime sources", async () => {
  const retiredFacade = ["with", "Interaction", "Busy"].join("");
  for (const path of await runtimeSourceFiles()) {
    assert.doesNotMatch(await readFile(path, "utf8"), new RegExp(retiredFacade), path);
  }
});
