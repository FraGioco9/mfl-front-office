import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("v1.123.36 commits shared view navigation on pointer release", async () => {
  const source = await read("table-loading-runtime.js");

  assert.match(source, /function sharedViewPath\(route\)/);
  assert.match(source, /function onPointerUp\(event\)/);
  assert.match(source, /window\.history\.pushState\(\{\}, "", targetPath\)/);
  assert.match(source, /window\.dispatchEvent\(new PopStateEvent\("popstate"/);
  assert.match(source, /window\.addEventListener\("pointerup", onPointerUp, true\)/);
  assert.match(source, /window\.addEventListener\("click", onClickCapture, true\)/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
});

test("v1.123.36 keeps keyboard view activation on the legacy click path", async () => {
  const source = await read("table-loading-runtime.js");

  assert.match(source, /pendingViewPointer = sharedViewRoute && event\.isPrimary !== false && event\.button === 0/);
  assert.match(source, /function onClickCapture\(event\) \{\s*if \(!suppressPointerClick\) return;/);
});
