// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

/**
 * Keep the MFL Stats histogram DOM stable when route/data hydration asks for the
 * same distribution more than once, and give the visible column rise a single
 * animation owner. Replacing identical bars restarts their CSS rise animation,
 * while animating the histogram wrapper as well makes one render look like two
 * column animations.
 * @param {string} source
 */
export function normalizeMflStatsHistogramLifecycle(source) {
  const runtime = String(source || "");
  if (!runtime) throw new Error("Cannot normalize an empty MFL Stats runtime.");

  let normalizedRuntime = replaceRequired(
    runtime,
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
  if (mflStatsAgeDistribution.dataset.mflStatsRenderSignature === distributionSignature
      && mflStatsAgeDistribution.firstElementChild) {
    return;
  }
  mflStatsAgeDistribution.dataset.mflStatsRenderSignature = distributionSignature;

  if (!counts.size) {
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const maxCount = Math.max(...counts.values());`,
    "MFL Stats histogram renders once for each distinct distribution",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
    `  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogram";
  histogram.style.setProperty("--mfl-stats-bars", String(rows.length));`,
    `  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogram";
  histogram.style.animation = "none";
  histogram.style.setProperty("--mfl-stats-bars", String(rows.length));`,
    "MFL Stats columns use the fill rise as their single animation owner",
  );

  return normalizedRuntime;
}
