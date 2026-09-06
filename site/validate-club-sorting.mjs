import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const occurrences = (source, value) => source.split(value).length - 1;

const [coreSource, dataPage] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./api/_data-page.js"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
const tableCore = String(artifacts.routeChunks?.table || "");

includes(
  dataPage,
  "END ASC, overall DESC, player_id DESC",
  "Club API ordering must remain Position ASC, then Overall DESC.",
);
includes(
  clubCore,
  "if (aRank !== bRank) return aRank - bRank;",
  "Club client ordering must compare primary position first.",
);
includes(
  clubCore,
  "if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) return bOverall - aOverall;",
  "Club client ordering must compare Overall descending after position.",
);

includes(
  tableCore,
  'const clubPositionSort = state.currentPage === "club" && column === "positions";',
  "Club headers must expose Positions as the fixed primary sort.",
);
includes(
  tableCore,
  'arrow.className = "sortArrow asc";',
  "Club Positions header must display ascending position order.",
);
includes(
  tableCore,
  'if (state.currentPage !== "club" && sortableColumns.has(column)) {',
  "Club headers must not expose generic sort interactions.",
);

for (const [label, source] of [["shared", eagerCore], ["Club", clubCore], ["Table", tableCore]]) {
  excludes(
    source,
    'state.sortKey = "positions";',
    `${label} runtime must not store Club's fixed sort in shared table sort state.`,
  );
}

includes(
  eagerCore,
  'const previousTablePage = typeof tablePageKey === "function" ? tablePageKey() : null;',
  "Page transitions must capture the source table before the destination page is committed.",
);
includes(
  eagerCore,
  "state.tablePageStates[previousTablePage] = currentTablePageState();",
  "The source page sort/filter state must be persisted before navigation commits the destination.",
);
includes(
  eagerCore,
  "previousTableStateSaved = true;",
  "The committed route must record that source table state was already handled.",
);
includes(
  eagerCore,
  "__mflPreviousTableStateSaved: true",
  "The route gate must pass pre-save ownership into committed setPage work.",
);

const guardedSave = 'if (options.__mflPreviousTableStateSaved !== true) {';
invariant(
  occurrences(eagerCore, guardedSave) >= 2,
  "Both canonical and incremental setPage paths must skip destination-state saves after the source state was pre-saved.",
);
excludes(
  eagerCore,
  `${guardedSave}\n    ${guardedSave}`,
  "The generated runtime must not contain a redundant nested pre-save guard.",
);
includes(
  eagerCore,
  `    const previousPage = state.currentPage;\n    ${guardedSave}\n      const previousTablePage = tablePageKey();`,
  "The actual incremental setPage path must guard its previous-page save after navigation commits the destination.",
);
includes(
  eagerCore,
  `        saveTableState();\n      }\n    }\n\n    const route = prepareIncrementalRoute(pageName, {`,
  "Incremental route preparation must happen only after the guarded previous-page save block.",
);

const preSave = eagerCore.indexOf('const previousTablePage = typeof tablePageKey === "function" ? tablePageKey() : null;');
const transition = eagerCore.indexOf('const runTransition = Reflect.get(window, "__mflRunPageTransition");', preSave);
invariant(preSave >= 0 && transition > preSave, "Source table state must be saved before the page transition commits the destination.");

console.log("Club sorting validation passed: fixed Position -> Overall ordering is source-owned and every committed page path preserves destination sort state after Club navigation.");
