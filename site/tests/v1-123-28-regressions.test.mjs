import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("wait cursor uses a viewport shield so underlying elements cannot enter hover state", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");

  for (const source of [bridge, runtime]) {
    assert.match(source, /body::after \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*z-index: 2147483647;/);
    assert.match(source, /body::after \{[\s\S]*pointer-events: auto !important;[\s\S]*cursor: wait !important;/);
  }

  assert.match(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \* \{\s*pointer-events: none !important;/);
  const waitDetector = runtime.slice(runtime.indexOf("function waitCursorActive"), runtime.indexOf("function syncWaitHover"));
  assert.match(waitDetector, /elementHasWaitCursor\(document\.body, "::before"\)/);
  assert.doesNotMatch(waitDetector, /elementHasWaitCursor\(document\.body, "::after"\)/);
});
