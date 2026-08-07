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
  assert.equal(release.version, "1.123.3");
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

test("static shell is resolved before release metadata or runtime loading", async () => {
  const bridge = await read("app.js");
  const release = JSON.parse(await read("release.json"));

  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.3"/);
  assert.match(bridge, /function primeStaticShell\(\)/);
  assert.match(bridge, /menuRail\.hidden = false/);
  assert.match(bridge, /sidebar\.hidden = false/);
  assert.match(bridge, /document\.body\.classList\.add\("pinnedSidebarVisible"\)/);
  assert.match(bridge, /page\.hidden = page\.id !== route\.pageId/);
  assert.match(bridge, /document\.documentElement\.classList\.add\("mflStaticShellReady"\)/);
  assert.ok(bridge.indexOf("const footerVersionLink = primeStaticShell();") < bridge.indexOf("fetch(\"/release.json\""));
  assert.equal(release.version, "1.123.3");
});

test("changelog first paint is cleared before routing and built from canonical releases", async () => {
  const bridge = await read("app.js");
  const entry = await read("modules/app-entry.js");
  const changelog = await read("changelog-history-runtime.js");
  const releasesApi = await read("api/releases.js");
  const testServer = await read("tests/server.mjs");
  const recent = JSON.parse(await read("releases-recent.json"));

  assert.match(bridge, /changelogList\.replaceChildren\(\)/);
  assert.match(bridge, /changelogList\.hidden = true/);
  assert.match(entry, /"\/changelog-history-runtime\.js"/);
  assert.match(entry, /__mflChangelogHistoryReady/);
  assert.match(changelog, /fetch\(RELEASES_URL/);
  assert.match(changelog, /list\.replaceChildren\(fragment\)/);
  assert.match(changelog, /list\.hidden = false/);
  assert.doesNotMatch(changelog, /changelog-history-source-v1\.120\.3|sourceVersion|CURRENT_RELEASES/);
  assert.match(releasesApi, /\.\.\/releases-recent\.json/);
  assert.match(testServer, /releases-recent\.json/);
  assert.deepEqual(recent.map((entry) => entry[0]), ["v1.123.2", "v1.123.1", "v1.123.0"]);
});

test("season-ratio endpoint preserves the completed-row query", async () => {
  const source = await read("api/mfl-season-ratios-v2.js");
  assert.match(source, /require\("\.\.\/release\.json"\)/);
  assert.match(source, /mfl_season_ratios\?select=season,ratio&order=season\.desc&limit=\$\{REQUIRED_RATIO_ROWS\}/);
  assert.doesNotMatch(source, /completed|status=|season\.lte/);
});
