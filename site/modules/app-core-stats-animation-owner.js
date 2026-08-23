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
 * Keep the histogram wrapper structural only. The existing fill animation is
 * the sole Stats column animation owner, while identical renders preserve the
 * current histogram DOM instead of recreating animated fills.
 * @param {string} source
 */
export function normalizeMflStatsAnimationOwner(source) {
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
