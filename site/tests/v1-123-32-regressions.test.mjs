import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("entry asset cache keys stay aligned with the current release", async () => {
  const release = JSON.parse(await read("release.json"));
  const index = await read("index.html");
  const app = await read("app.js");

  assert.equal(release.version, "1.124.0");
  assert.match(index, new RegExp(`/styles\\.css\\?v=${release.version.replaceAll(".", "\\.")}`));
  assert.match(index, new RegExp(`/app\\.js\\?v=${release.version.replaceAll(".", "\\.")}`));
  assert.match(index, new RegExp(`MFL Front Office v${release.version.replaceAll(".", "\\.")}`));
  assert.match(app, /const STATIC_RELEASE_VERSION = "1\.123\.37"/);
  assert.doesNotMatch(index, /(?:app\.js|styles\.css)\?v=1\.123\.22/);
});

test("v1.123.32 owns Evaluation first paint before asynchronous startup", async () => {
  const index = await read("index.html");
  const app = await read("app.js");
  const chrome = await read("evaluation-static-chrome-runtime.js");

  assert.match(index, /root\.dataset\.initialEvaluationSelection/);
  assert.match(index, /data-initial-page="evaluation"\] #evaluationPage \.evaluationTitleRow \{\s*align-items: flex-start !important;/);
  assert.match(index, /data-initial-evaluation-selection="false"\][\s\S]*#evaluationLoadButton/);
  assert.match(app, /const showInitialLoad = storedOptIn && !selectedEvaluation/);
  assert.match(app, /evaluationLoadButton\.hidden = !showInitialLoad/);
  assert.match(chrome, /function normalizeWalletAddress\(value\)/);
  assert.match(chrome, /document\.documentElement\.dataset\.storedWalletOptIn === "true"/);
});

test("stale wait state cannot swallow navigation or result controls", async () => {
  const app = await read("app.js");
  assert.match(app, /function interactionShouldBeBlocked\(\)/);
  assert.match(app, /return activeTokens\.size > 0;/);
  assert.doesNotMatch(app, /function elementHasWaitCursor/);
});
