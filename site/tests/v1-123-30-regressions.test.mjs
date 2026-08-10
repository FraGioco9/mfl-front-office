import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("table view buttons bypass stale wait-cursor blocking but not real busy state", async () => {
  const bridge = await read("app.js");
  const blocker = bridge.slice(bridge.indexOf("function interactionShouldBeBlocked"), bridge.indexOf("function blockInteraction"));

  assert.ok(blocker.includes("if (activeTokens.size) return true;"));
  assert.ok(blocker.includes("#progressionPage .viewButton[data-view]"));
  assert.ok(blocker.includes("#databaseStatsPage .viewButton[data-view]"));
  assert.ok(blocker.includes("#mflStatsPage .viewButton[data-view]"));
  assert.ok(blocker.includes("return false;"));
  assert.ok(blocker.includes("elementHasWaitCursor(target)"));
});
