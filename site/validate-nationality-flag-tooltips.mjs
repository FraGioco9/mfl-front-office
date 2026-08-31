import { readFile } from "node:fs/promises";

const coreSource = await Promise.all([
    readFile(new URL("./modules/core-sources/shared.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/evaluation.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/mfl-stats.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/club.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/settings.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/player.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/table.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/wallet.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/watchlist.js", import.meta.url), "utf8"),
  ]).then((parts) => parts.join("\n"));
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
