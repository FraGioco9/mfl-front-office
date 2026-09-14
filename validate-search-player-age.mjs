import { readCanonicalCoreSource } from "./validate-core-sources.mjs";
import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [database, dataViews, appCore] = await Promise.all([
  read("./api/_database.js"),
  read("./api/_data-views.js"),
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
]);

invariant(
  database.includes(`const SEARCH_PLAYER_COLUMNS = Object.freeze([\n  "player_id",\n  "name",\n  "overall",\n  "age",`)
    && dataViews.includes("const columns = SEARCH_PLAYER_COLUMNS;")
    && dataViews.includes("const playerColumns = SEARCH_PLAYER_COLUMNS;"),
  "Typed and recent Player search payloads must include age through the canonical SEARCH_PLAYER_COLUMNS contract.",
);

invariant(
  appCore.includes("function playerSearchAgeDisplay(value) {")
    && appCore.includes(`ageDisplay: playerSearchAgeDisplay(getValue(row, "age")),`)
    && appCore.includes(`ageDisplay: playerSearchAgeDisplay(compactSearchValue(row, columns, "age")),`)
    && appCore.includes("function playerSearchMetadataHtml(entry, playerId) {")
    && appCore.includes("entry.ageDisplay ?")
    && appCore.includes(" yo"),
  "Full-row and compact Player search entries must normalize age once and expose it through the shared metadata renderer.",
);

invariant(
  appCore.includes("playerSearchMetadataHtml(entry, playerId)")
    && appCore.includes("playerSearchMetadataHtml(entry, id)"),
  "Evaluation Search and Global Search must render Player age through the same canonical metadata formatter.",
);

const metadataStart = appCore.indexOf("function playerSearchMetadataHtml(entry, playerId)");
const metadataEnd = appCore.indexOf("function buildAgentSearchEntry", metadataStart);
const metadataSource = metadataStart >= 0 && metadataEnd > metadataStart ? appCore.slice(metadataStart, metadataEnd) : "";
invariant(
  metadataSource && !metadataSource.includes("fetch("),
  "Player age search rendering must reuse the existing search payload and must not introduce a per-result age request.",
);

console.log("Player search age validation passed: typed and recent payloads include age, and Global/Evaluation Player results share one age metadata renderer without extra requests.");
