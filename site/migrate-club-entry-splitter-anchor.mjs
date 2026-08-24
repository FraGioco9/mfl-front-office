// Temporary one-shot migration; remove before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "modules/app-core-route-chunks.js");
const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = `  clubSearch = extractRequiredSection(\n    club,\n    '  if (typeof renderSearchResultsNow === "function") {',\n    '  if (initialClubRoute && typeof showHomeShell === "function") {',\n    "Club route-local search wrapper",\n  );`;
const after = `  clubSearch = extractRequiredSection(\n    club,\n    '  if (typeof renderSearchResultsNow === "function") {',\n    '  function hideClubPageControls() {',\n    "Club route-local search wrapper",\n  );`;
if (!source.includes(before)) throw new Error("Could not find obsolete Club search-wrapper splitter boundary.");
await writeFile(path, source.replace(before, after));
console.log("Club search-wrapper splitter now anchors on the stable Club controls owner.");
