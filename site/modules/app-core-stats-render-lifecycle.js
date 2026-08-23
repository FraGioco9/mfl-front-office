// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

/**
 * Keep the MFL Stats histogram DOM stable when route/data hydration asks for the
 * same distribution more than once. Replacing identical bars restarts their CSS
 * rise animation, so only a genuinely different distribution should rebuild it.
 * @param {string} source
 */
export function normalizeMflStatsHistogramLifecycle(source) {
  const runtime = String(source || "");
  if (!runtime) throw new Error("Cannot normalize an empty MFL Stats runtime.");

  return replaceRequired(
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
}
