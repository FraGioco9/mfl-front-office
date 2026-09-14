import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const coreSource = readCanonicalCoreSource("shared");
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

if (!flagRenderer.includes("function countryFlagElement(nationality, extraClass = \"\") {")) {
  throw new Error("Shared Club/location surfaces must reuse the canonical nationality flag renderer through countryFlagElement().");
}
if (!flagRenderer.includes("countryCodeForNationality(nationality)")) {
  throw new Error("The shared country flag element helper must suppress non-flag fallback text when a mapped flag is unavailable.");
}

console.log("Nationality flag tooltips use canonical formatted nationality labels.");
