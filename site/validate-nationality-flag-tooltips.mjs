import { readFile } from "node:fs/promises";

const coreSource = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const start = coreSource.indexOf("function countryFlagHtml(nationality) {");
const end = coreSource.indexOf("function rarityColorForOverall(overall) {", start);
if (start < 0 || end <= start) {
  throw new Error("Could not locate the canonical nationality flag renderer.");
}

const flagRenderer = coreSource.slice(start, end);
if (!flagRenderer.includes("const label = escapeHtml(formatNationality(nationality));")) {
  throw new Error("Nationality flag tooltips must use the canonical formatted nationality label.");
}
if (flagRenderer.includes('String(nationality || "Unknown nationality")')) {
  throw new Error("Nationality flag tooltips must not restore raw nationality labels.");
}
const formattedLabelBinding = 'data-tooltip="${label}" aria-label="${label}"';
if (flagRenderer.split(formattedLabelBinding).length - 1 !== 2) {
  throw new Error("Both text and image flag renderers must expose the formatted nationality tooltip and accessible label.");
}

console.log("Nationality flag tooltips use canonical formatted nationality labels.");
