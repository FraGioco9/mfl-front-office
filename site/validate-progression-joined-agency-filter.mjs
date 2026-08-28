
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");
const api = readFileSync(new URL("./api/_data-page.js", import.meta.url), "utf8");

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

if (!/\["after", "after"\],\s*\["before", "before"\],\s*\["during", "during"\],/.test(app)) {
  throw new Error("Joined Agency must default to After while retaining Before and During.");
}
requireText(app, "return rowDay >= filterDay;", "Client Joined Agency After must include the selected calendar day.");
if (app.includes("return rowDay > filterDay;")) {
  throw new Error("Client Joined Agency After must not retain the strict selected-day exclusion.");
}
requireText(app, "Math.floor(Date.UTC(year, month, day) / 86400000)", "Filter dates must use timezone-stable calendar ordinals.");
requireText(app, "Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())", "Joined Agency row dates must compare by their displayed local calendar day.");
requireText(app, "function filterDateEpochBounds(value)", "Joined Agency requests must derive browser-local day boundaries.");
requireText(app, "valueDayStartEpochSeconds", "Joined Agency requests must carry the selected local day start.");
requireText(app, "valueNextDayStartEpochSeconds", "Joined Agency requests must carry the next local day start for DST-safe ranges.");
requireText(app, "JSON.stringify(serializeFilterRulesForRequest(rules))", "Paged API filters must use the canonical request serializer.");

requireText(api, 'operator === "before" ? "<" : ">="', "API Joined Agency After must include the selected local calendar day.");
requireText(api, "valueDayStartEpochSeconds", "API Joined Agency filtering must consume the browser-local day start.");
requireText(api, "valueNextDayStartEpochSeconds", "API Joined Agency filtering must consume the browser-local next-day boundary.");
requireText(api, "Math.min(fromStart, toStart), Math.max(fromNext, toNext)", "During must remain inclusive across either date order.");
requireText(api, ">= ? AND ${normalizedEpochSeconds(quotedColumn)} < ?", "During must use a DST-safe half-open epoch range.");
requireText(api, 'conditions.push(scope === "mfl" ? "player_seasons >= 2" : "player_seasons = 1");', "Only New Mints behavior must remain unchanged for Progression.");

console.log("Progression Joined Agency filter validation passed.");
