import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./modules/app-core-route-chunks.js", import.meta.url);
const source = await readFile(path, "utf8");
const from = '    "const mflStatsOverallFilterOptions = [",';
const to = '    "const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];",';
const first = source.indexOf(from);
if (first < 0) {
  if (source.includes(to)) {
    console.log("MFL Stats splitter boundary is already canonical.");
    process.exit(0);
  }
  throw new Error("Could not find the legacy MFL Stats splitter boundary.");
}
if (source.indexOf(from, first + from.length) >= 0) {
  throw new Error("Found duplicate legacy MFL Stats splitter boundaries.");
}
await writeFile(path, source.slice(0, first) + to + source.slice(first + from.length), "utf8");
console.log("Migrated MFL Stats splitter boundary to canonical UI metadata.");
