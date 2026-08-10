import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("global busy owns the viewport shield while generic wait suppression never blocks pointer targets", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-static-filter-runtime.js");

  assert.match(bridge, /body::after \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*z-index: 2147483647;/);
  assert.match(bridge, /body::after \{[\s\S]*pointer-events: auto !important;[\s\S]*cursor: wait !important;/);
  assert.doesNotMatch(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body::after/);
  assert.doesNotMatch(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \* \{\s*pointer-events: none !important;/);
  assert.doesNotMatch(runtime, /waitCursorSource|rememberWaitCursorSource|sourceHasWaitCursor/);
  assert.match(runtime, /elementHasWaitCursor\(document\.body, "::before"\)/);
  assert.match(runtime, /html\.\$\{WAIT_HOVER_CLASS\} body \*[\s\S]*transition: none !important;[\s\S]*animation: none !important/);
});
