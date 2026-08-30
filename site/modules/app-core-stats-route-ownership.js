// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const STATIC_HISTOGRAM_LAYOUT = `  histogram.className = "mflStatsHistogramLayout";
  histogram.style.display = "grid";
  histogram.style.gridTemplateColumns = "repeat(var(--mfl-stats-bars, 1), minmax(0, 1fr))";
  histogram.style.alignItems = "end";
  histogram.style.gap = "clamp(3px, 0.45vw, 7px)";
  histogram.style.width = "100%";
  histogram.style.height = "100%";
  histogram.style.paddingTop = "34px";
  histogram.style.minWidth = "620px";`;

/**
 * Keep one visual animation owner for Stats histograms, only allow MFL Stats
 * to render after its incremental payload is active, and prepare expensive
 * row facts once per payload so filter changes stay synchronous and cheap.
 * @param {string} source
 */
export function normalizeMflStatsRouteOwnership(source) {
  let normalized = String(source || "");
  if (!normalized) throw new Error("Cannot normalize an empty MFL Stats runtime.");

  normalized = replaceRequired(
    normalized,
    `      button.addEventListener("click", () => {
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage();
      });`,
    `      button.addEventListener("click", () => {
        if (state.mflStatsOverallFilter === filter.id) return;
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage();
      });`,
    "MFL Stats active Overall filter does not rerender",
  );

  normalized = replaceRequired(
    normalized,
    `function rowMatchesMflStatsOverallFilter(row, filter = mflStatsFilterById()) {
  const overall = Number(statDisplayValue(row, "overall"));
  if (!Number.isFinite(overall)) {
    return false;
  }

  return (filter.min === null || overall >= filter.min) && (filter.max === null || overall <= filter.max);
}

function mflStatsCategory(row) {`,
    `function rowMatchesMflStatsOverallFilter(overall, filter = mflStatsFilterById()) {
  return Number.isFinite(overall)
    && (filter.min === null || overall >= filter.min)
    && (filter.max === null || overall <= filter.max);
}

function mflStatsCategory(row) {`,
    "MFL Stats Overall matching consumes prepared values",
  );

  normalized = replaceRequired(
    normalized,
    `function mflStatsRows() {
  const filter = mflStatsFilterById();
  return state.rows
    .filter((row) => rowIsMflWalletPlayer(row))
    .filter((row) => rowMatchesMflStatsOverallFilter(row, filter));
}`,
    `let mflStatsPreparedSourceRows = null;
let mflStatsPreparedSourceColumns = null;
let mflStatsPreparedRows = [];

function mflStatsPreparedRowsForCurrentRoute() {
  if (mflStatsPreparedSourceRows === state.rows && mflStatsPreparedSourceColumns === state.columns) {
    return mflStatsPreparedRows;
  }

  mflStatsPreparedSourceRows = state.rows;
  mflStatsPreparedSourceColumns = state.columns;
  mflStatsPreparedRows = [];

  if (!Array.isArray(state.rows)) return mflStatsPreparedRows;

  state.rows.forEach((row) => {
    const overall = Number(statDisplayValue(row, "overall"));
    if (!Number.isFinite(overall)) return;
    const age = Number(getValue(row, "age"));
    mflStatsPreparedRows.push({
      overall,
      age: Number.isFinite(age) ? age : null,
      category: mflStatsCategory(row),
    });
  });

  return mflStatsPreparedRows;
}

function mflStatsRows() {
  const preparedRows = mflStatsPreparedRowsForCurrentRoute();
  const filter = mflStatsFilterById();
  if (filter.min === null && filter.max === null) return preparedRows;
  return preparedRows.filter((entry) => rowMatchesMflStatsOverallFilter(entry.overall, filter));
}`,
    "MFL Stats filter changes reuse prepared route rows",
  );

  normalized = replaceRequired(
    normalized,
    `function mflStatsDistributionValue(row) {
  if (state.mflStatsDistributionMode === "age") {
    const age = Number(getValue(row, "age"));
    return Number.isFinite(age) ? age : null;
  }

  const overall = Number(statDisplayValue(row, "overall"));
  return Number.isFinite(overall) ? Math.trunc(overall) : null;
}`,
    `function mflStatsDistributionValue(entry) {
  if (state.mflStatsDistributionMode === "age") return entry.age;
  return Number.isFinite(entry.overall) ? Math.trunc(entry.overall) : null;
}`,
    "MFL Stats distribution consumes prepared route values",
  );

  normalized = replaceRequired(
    normalized,
    `  const rows = mflStatsRows();
  const packableRows = rows.filter((row) => mflStatsCategory(row) === "packable");
  const agedRows = rows.filter((row) => mflStatsCategory(row) === "aged");
  const otherRows = rows.filter((row) => mflStatsCategory(row) === "other");`,
    `  const rows = mflStatsRows();
  const packableRows = [];
  let agedCount = 0;
  let otherCount = 0;
  rows.forEach((entry) => {
    if (entry.category === "packable") packableRows.push(entry);
    else if (entry.category === "aged") agedCount += 1;
    else otherCount += 1;
  });`,
    "MFL Stats categories aggregate in one pass",
  );

  normalized = replaceRequired(
    normalized,
    `    mflStatsAgedPlayers.textContent = formatCount(agedRows.length);`,
    `    mflStatsAgedPlayers.textContent = formatCount(agedCount);`,
    "MFL Stats aged card consumes aggregate count",
  );

  normalized = replaceRequired(
    normalized,
    `    mflStatsOtherPlayers.textContent = formatCount(otherRows.length);`,
    `    mflStatsOtherPlayers.textContent = formatCount(otherCount);`,
    "MFL Stats other card consumes aggregate count",
  );

  normalized = replaceRequired(
    normalized,
    `  if (!counts.size) {
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const maxCount = Math.max(...counts.values());
  const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  const totalPackable = packableRows.length;`,
    `  const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  const totalPackable = packableRows.length;
  const distributionSignature = JSON.stringify([
    state.mflStatsOverallFilter,
    state.mflStatsDistributionMode,
    totalPackable,
    rows,
  ]);
  if (mflStatsAgeDistribution.dataset.mflStatsDistributionSignature === distributionSignature
      && mflStatsAgeDistribution.firstElementChild) {
    return;
  }
  mflStatsAgeDistribution.dataset.mflStatsDistributionSignature = distributionSignature;

  if (!counts.size) {
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
    return;
  }

  const maxCount = Math.max(...counts.values());`,
    "MFL Stats identical distribution keeps existing animated fills",
  );

  normalized = replaceRequired(
    normalized,
    `  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogram";`,
    `  const histogram = document.createElement("div");
${STATIC_HISTOGRAM_LAYOUT}`,
    "MFL Stats histogram wrapper is structural and non-animated",
  );

  normalized = replaceRequired(
    normalized,
    `function renderMflStatsPage() {
  renderMflStatsFilterButtons();
  const rows = mflStatsRows();`,
    `function renderMflStatsPage() {
  renderMflStatsFilterButtons();
  if (state.incrementalRoute?.scope !== "mflstats") return;
  const rows = mflStatsRows();`,
    "MFL Stats waits for its own incremental data before rendering",
  );

  normalized = replaceRequired(
    normalized,
    `  mflStatsAgeDistribution.replaceChildren(fragment);`,
    `  mflStatsAgeDistribution.replaceChildren(fragment);
  window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();`,
    "MFL Stats histogram render resyncs horizontal cues",
  );

  normalized = replaceRequired(
    normalized,
    `  state.mflStatsDistributionMode = button.dataset.distribution === "age" ? "age" : "overall";
  renderMflStatsPage();`,
    `  const nextMode = button.dataset.distribution === "age" ? "age" : "overall";
  if (nextMode === state.mflStatsDistributionMode) return;
  state.mflStatsDistributionMode = nextMode;
  renderMflStatsPage();`,
    "MFL Stats active distribution mode does not rerender",
  );

  return normalized;
}
