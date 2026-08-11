import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("v1.123.37 keeps the Evaluation discount fallback visible from static HTML", async () => {
  const index = await read("index.html");
  const chrome = await read("evaluation-static-chrome-runtime.js");

  assert.match(index, /<strong id="evaluationDiscountRate" style="visibility: visible !important;">-<\/strong>/);
  assert.match(chrome, /if \(!String\(discountRate\.textContent \|\| ""\)\.trim\(\)\) discountRate\.textContent = "-";/);
  assert.match(chrome, /setImportant\(discountRate, "visibility", "visible"\)/);
});

test("v1.123.37 lets recent result buttons use their original trusted click handlers", async () => {
  const search = await read("global-search-runtime.js");

  assert.doesNotMatch(search, /onResultClick|forwardingResultClick/);
  assert.doesNotMatch(search, /target\.click\(\)|dispatchEvent\(new MouseEvent\("click"/);
  assert.doesNotMatch(search, /window\.addEventListener\("click"/);
  assert.match(search, /document\.addEventListener\("input", onInput, true\)/);
});

test("v1.123.37 keeps global search focused without reselecting typed text", async () => {
  const search = await read("global-search-runtime.js");

  assert.match(search, /function focusSearchInput\(selectText = false\)/);
  assert.match(search, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(search, /if \(selectText\) input\.select\(\)/);
  assert.match(search, /function restoreSearchFocusIfNeeded\(\)/);
  assert.match(search, /focusSearchInput\(true\)/);
  assert.match(search, /focusSearchInput\(false\)/);
  assert.match(search, /attributeFilter: \["hidden"\]/);
  assert.doesNotMatch(search, /attributeFilter: \["hidden", "class", "style"\]/);
});

test("Evaluation recent results preserve their native click between mouse down and release", async () => {
  const chrome = await read("evaluation-static-chrome-runtime.js");

  assert.match(chrome, /function preserveEvaluationResultClick\(event\)/);
  assert.match(chrome, /closest\("#evaluationSearchResults \.evaluationSearchResult"\)/);
  assert.match(chrome, /event\.preventDefault\(\)/);
  assert.match(chrome, /document\.addEventListener\("mousedown", preserveEvaluationResultClick, true\)/);
  assert.match(chrome, /document\.removeEventListener\("mousedown", preserveEvaluationResultClick, true\)/);
  assert.doesNotMatch(chrome, /\.click\(\)|dispatchEvent\(new MouseEvent\("click"/);
});

test("typed global search stays fresh independently of visited page data", async () => {
  const search = await read("global-search-runtime.js");
  const entry = await read("modules/app-entry.js");
  const vercel = await read("vercel.json");

  assert.match(search, /renderCurrentResults\(\);\s*void searchDatabase\(query\)/);
  assert.match(search, /mode: "search"/);
  assert.match(search, /type: "all"/);
  assert.match(search, /cache: "no-store"/);
  assert.match(entry, /"\/global-search-runtime\.js\?rev=full-database-search"/);
  assert.match(vercel, /"source": "\/global-search-runtime\.js"[^\n]+"Cache-Control", "value": "no-store, max-age=0"/);
});

test("v1.123.37 aligns release metadata and static cache keys", async () => {
  const release = JSON.parse(await read("release.json"));
  const index = await read("index.html");
  const app = await read("app.js");

  assert.equal(release.version, "1.123.37");
  assert.match(app, /const STATIC_RELEASE_VERSION = "1\.123\.37"/);
  assert.match(index, /href="\/styles\.css\?v=1\.123\.37"/);
  assert.match(index, /src="\/app\.js\?v=1\.123\.37"/);
});
