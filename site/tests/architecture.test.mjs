import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("release metadata is the current Semantic Version source", async () => {
  const release = JSON.parse(await read("release.json"));
  assert.match(release.version, /^\d+\.\d+\.\d+$/);
  assert.equal(release.version, "1.123.1");
  assert.ok(release.description.length > 20);
});

test("retired bootstrap architecture is absent from the active entry", async () => {
  const entry = await read("modules/app-entry.js");
  const bridge = await read("app.js");
  assert.doesNotMatch(entry, /document\.(open|write|close)\s*\(/);
  assert.doesNotMatch(bridge, /document\.(open|write|close)\s*\(/);
  assert.doesNotMatch(entry, /index-shell\.html|bootstrap\.js/);
});

test("application core uses the known-good direct classic-script startup path", async () => {
  const entry = await read("modules/app-entry.js");
  assert.match(entry, /loadClassicScript\("\/modules\/legacy-core\.js", release\.version\)/);
  assert.doesNotMatch(entry, /prepareCoreRuntimeSource|loadPreparedClassicScript|loadPartitionedClassicScript/);
});

test("season-ratio endpoint preserves the completed-row query", async () => {
  const source = await read("api/mfl-season-ratios-v2.js");
  assert.match(source, /require\("\.\.\/release\.json"\)/);
  assert.match(source, /mfl_season_ratios\?select=season,ratio&order=season\.desc&limit=\$\{REQUIRED_RATIO_ROWS\}/);
  assert.doesNotMatch(source, /completed|status=|season\.lte/);
});
