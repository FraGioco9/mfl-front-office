import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("table view buttons stay clickable unless a real busy token is active", async () => {
  const bridge = await read("app.js");
  const blocker = bridge.slice(bridge.indexOf("function interactionShouldBeBlocked"), bridge.indexOf("function blockInteraction"));

  assert.ok(blocker.includes("return activeTokens.size > 0;"));
  assert.doesNotMatch(blocker, /elementHasWaitCursor/);
  assert.match(bridge, /if \(!interactionShouldBeBlocked\(\)\) return;/);
});
