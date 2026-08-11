import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function widthMap(source) {
  const match = source.match(/const WIDTHS = (?:Object\.freeze\()?\{([\s\S]*?)\n\s*\}\)?;/);
  assert.ok(match, "WIDTHS map should exist");
  return Object.fromEntries(
    [...match[1].matchAll(/"([^"]+)":\s*([0-9.]+)/g)]
      .map((entry) => [entry[1], Number(entry[2])]),
  );
}

test("static table chrome uses the same width owner as the settled player table", async () => {
  const entry = await read("modules/app-entry.js");
  const prime = await read("table-width-prime-runtime.js");
  const legacy = await read("modules/legacy-core.js");

  assert.ok(
    entry.indexOf('"/table-width-prime-runtime.js"') < entry.indexOf('"/table-loading-runtime.js"'),
    "width priming must load before the static loading header",
  );
  assert.deepEqual(widthMap(prime), widthMap(legacy));
  assert.match(prime, /MutationObserver/);
  assert.match(prime, /applyExactPlayerTableWidths/);
  assert.match(prime, /classList\.add\("tableWidthsReady"\)/);
});
