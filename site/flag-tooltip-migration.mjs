import { readFile, writeFile } from "node:fs/promises";

const corePath = new URL("./modules/app-core.js", import.meta.url);
const source = await readFile(corePath, "utf8");
const before = '  const label = escapeHtml(String(nationality || "Unknown nationality"));';
const after = "  const label = escapeHtml(formatNationality(nationality));";
const occurrences = source.split(before).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected one raw nationality flag label owner, found ${occurrences}.`);
}
await writeFile(corePath, source.replace(before, after), "utf8");
console.log("Canonical flag tooltip nationality formatting applied.");
