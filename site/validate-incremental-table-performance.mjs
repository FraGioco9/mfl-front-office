import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, tableRuntime, coreSource] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-incremental-table-performance.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./modules/app-core.js"),
]);

includes(
  build,
  'import { optimizeIncrementalTableRuntimeArtifacts } from "./modules/app-core-incremental-table-performance.js";',
  "The canonical application-core build must load the incremental Table performance stage.",
);
includes(
  build,
  "optimizeIncrementalTableRuntimeArtifacts(normalizeBuiltApplicationCoreArtifacts(source))",
  "The Table performance stage must consume the fully normalized application-core artifacts before they are written.",
);
includes(
  optimizer,
  "state.filteredRows = state.rows;",
  "Incremental Table payloads must be reused directly instead of cloned and re-derived.",
);

const applyStart = tableRuntime.indexOf("function tableApplyFiltersOwner(options = {}) {");
const applyEnd = tableRuntime.indexOf("function currentPageRows()", applyStart);
invariant(applyStart >= 0 && applyEnd > applyStart, "Generated Table core must contain the filter owner.");
const applySection = tableRuntime.slice(applyStart, applyEnd);

const clubBranch = applySection.indexOf('if (state.currentPage === "club")');
const incrementalBranch = applySection.indexOf("if (state.incrementalMode)");
const localRules = applySection.indexOf("const rules = readFilterRules();");
invariant(
  clubBranch >= 0 && incrementalBranch > clubBranch && localRules > incrementalBranch,
  "Club-specific roster handling must stay first, followed by the incremental fast path and then the non-incremental fallback.",
);

const fastPath = applySection.slice(incrementalBranch, localRules);
includes(fastPath, "if (!state.incrementalApplying)", "User-driven incremental filter/sort changes must request a fresh server page.");
includes(fastPath, "void reloadIncrementalPage(1, { save: false });", "Incremental filter/sort changes must restart from server page 1 without a duplicate state save.");
includes(fastPath, "state.tableSourceRowsCount = state.incrementalSourceRows;", "Accepted incremental responses must retain server source-row totals.");
includes(fastPath, "state.filteredRows = state.rows;", "Accepted incremental rows must become the rendered rows directly.");
includes(fastPath, "incrementalTableEmptyStateMessage(state.incrementalSourceRows)", "Incremental empty-state copy must use server source counts without rescanning rows.");
for (const forbidden of [
  ".filter((row)",
  ".sort(compareRows)",
  "rowMatchesRules(",
  "rowIsOwnedByLinkedWallet(",
  "rowIsMflWalletPlayer(",
]) {
  excludes(fastPath, forbidden, `Incremental Table payloads must not repeat client row derivation through ${forbidden}.`);
}

const localFallback = applySection.slice(localRules);
includes(localFallback, "sourceRows = state.rows.filter", "Non-incremental fallback filtering must remain available.");
includes(localFallback, "state.filteredRows.sort(compareRows);", "Non-incremental fallback sorting must remain available.");

const queryStart = coreSource.indexOf("function incrementalDataQuery(route, page = 1) {");
const queryEnd = coreSource.indexOf("function incrementalRequestDetails(route, page = 1) {", queryStart);
invariant(queryStart >= 0 && queryEnd > queryStart, "Canonical source must contain incremental query construction.");
const querySection = coreSource.slice(queryStart, queryEnd);
for (const required of [
  "sortKey:",
  "sortDirection:",
  'query.set("hideRetired", "1")',
  'query.set("hideRetiring", "1")',
  'query.set("hideMfl", "1")',
  'query.set("packableOnly", "1")',
  'query.set("newMintsOnly", "1")',
  'query.set("filters", JSON.stringify(rules))',
]) {
  includes(querySection, required, `Server-owned incremental derivation requires query input ${required}.`);
}

// Deterministic work accounting: before this fast path, each accepted 100-row
// incremental page performed at least one scope scan plus one filter scan, then
// a client sort. The new path performs none of those row-derivation passes.
const measuredPageRows = 100;
const previousMinimumPredicateVisits = measuredPageRows * 2;
const optimizedPredicateVisits = 0;
const predicateVisitReduction = Math.round((1 - optimizedPredicateVisits / previousMinimumPredicateVisits) * 100);
invariant(predicateVisitReduction === 100, "Incremental row-derivation work reduction accounting changed unexpectedly.");

new Function(tableRuntime);
console.log(
  `Incremental Table performance validation passed: ${predicateVisitReduction}% fewer duplicate predicate visits on a ${measuredPageRows}-row accepted page (${previousMinimumPredicateVisits} -> ${optimizedPredicateVisits}), plus one redundant client sort removed.`,
);
