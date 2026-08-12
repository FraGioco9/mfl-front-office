import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("table loading runtime owns pager visibility for view changes", async () => {
  const source = await readFile(resolve(siteRoot, "table-loading-runtime.js"), "utf8");

  assert.match(source, /const PAGER_SELECTOR = "#progressionPage nav\.pager";/);
  assert.match(source, /function hidePagerForLoading\(\)[\s\S]*pager\.hidden = true;/);
  assert.match(source, /function hidePagerForLoading\(\)[\s\S]*pager\.style\.setProperty\("display", "none", "important"\)/);
  assert.match(source, /function releasePagerWhenReady\(\)[\s\S]*pager\.hidden = previouslyHidden;/);
  assert.match(source, /function releasePagerWhenReady\(\)[\s\S]*pager\.style\.removeProperty\("display"\)/);
  assert.match(source, /function show\(\)[\s\S]*hidePagerForLoading\(\);/);
  assert.match(source, /function sync\(\)[\s\S]*releasePagerWhenReady\(\);/);
  assert.match(source, /function onNavigationIntent\(event\)[\s\S]*primeRoute\(route\)/);
});
