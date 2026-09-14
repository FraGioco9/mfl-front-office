import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shared = await readFile(new URL("./modules/core-sources/shared-data-search.js", import.meta.url), "utf8");
const player = await readFile(new URL("./modules/core-sources/player.js", import.meta.url), "utf8");
const firstPaint = await readFile(new URL("./html-sources/player.html", import.meta.url), "utf8");

for (const source of [shared, player, firstPaint]) {
  assert.ok(
    source.includes("active_contract_revenue_share_penalty"),
    "Revenue-share penalty must be wired through every revenue-share display path.",
  );
}

assert.ok(
  shared.includes("return penalty ? `${base} + ${penalty}` : base;"),
  "Canonical formatter must preserve base and penalty as separate percentages.",
);
assert.ok(
  shared.includes('getValue(row, "active_contract_revenue_share_penalty")'),
  "Table formatting must read the clause penalty from the current row.",
);
assert.ok(
  player.includes('knownRawValue(context, "active_contract_revenue_share_penalty")'),
  "Player cached context must retain the clause penalty.",
);
assert.ok(
  firstPaint.includes('knownRaw("active_contract_revenue_share_penalty")'),
  "Player first paint must use a cached clause penalty when available.",
);

console.log("Contract clause display validation passed.");
