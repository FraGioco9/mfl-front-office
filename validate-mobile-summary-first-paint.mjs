import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [chromeSource, indexHtml] = await Promise.all([
  read("./html-sources/chrome.html"),
  read("./index.html"),
]);

for (const [name, source] of [["chrome source", chromeSource], ["generated index", indexHtml]]) {
  assert.ok(!source.includes('<span id="totalPlayers">-</span>'), `${name} must not expose a literal '-' in Players before bootstrap.`);
  assert.ok(!source.includes('<span id="totalWallets">-</span>'), `${name} must not expose a literal '-' in Wallets before bootstrap.`);
  assert.match(
    source,
    /<span id="totalPlayers"><span class="mflSkeletonText" aria-hidden="true"><span class="mflSkeletonTextSample">1,500<\/span><span class="mflDataPlaceholder mflSkeletonTextFill" aria-hidden="true"><\/span><\/span><\/span>/,
    `${name} must ship the Players loading skeleton in static first paint.`,
  );
  assert.match(
    source,
    /<span id="totalWallets"><span class="mflSkeletonText" aria-hidden="true"><span class="mflSkeletonTextSample">500<\/span><span class="mflDataPlaceholder mflSkeletonTextFill" aria-hidden="true"><\/span><\/span><\/span>/,
    `${name} must ship the Wallets loading skeleton in static first paint.`,
  );
}

console.log("Mobile Players/Wallets static first-paint skeleton validation passed.");
