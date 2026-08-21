import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, dataPage] = await Promise.all([
  read("./modules/app-core.js"),
  read("./api/_data-page.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
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

console.log("Club sorting validation passed: fixed Position -> Overall ordering is visible, read-only, and isolated from shared table sort state.");
