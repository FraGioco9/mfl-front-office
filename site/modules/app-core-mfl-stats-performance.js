// @ts-check

import { replaceRequiredFunction } from "./app-core-splitter-utils.js";

const SINGLE_PASS_SUMMARY = `function mflStatsSummary() {
  const filter = mflStatsFilterById();
  const distributionCounts = new Map();
  let totalPlayers = 0;
  let packablePlayers = 0;
  let agedPlayers = 0;
  let otherPlayers = 0;

  for (const row of state.rows) {
    if (!rowIsMflWalletPlayer(row) || !rowMatchesMflStatsOverallFilter(row, filter)) {
      continue;
    }

    totalPlayers += 1;
    const category = mflStatsCategory(row);
    if (category === "packable") {
      packablePlayers += 1;
      const distributionValue = mflStatsDistributionValue(row);
      if (distributionValue !== null) {
        distributionCounts.set(distributionValue, (distributionCounts.get(distributionValue) || 0) + 1);
      }
    } else if (category === "aged") {
      agedPlayers += 1;
    } else {
      otherPlayers += 1;
    }
  }

  return {
    totalPlayers,
    packablePlayers,
    agedPlayers,
    otherPlayers,
    distributionCounts,
  };
}`;

const SINGLE_PASS_DISTRIBUTION = `function renderMflStatsDistribution(counts, totalPackable) {
  if (!mflStatsAgeDistribution) {
    return;
  }

  renderMflStatsDistributionModeButtons();
  if (mflStatsDistributionTitle) {
    mflStatsDistributionTitle.textContent = state.mflStatsDistributionMode === "age"
      ? "Packable Age Distribution"
      : "Packable Overall Distribution";
  }

  if (!counts.size) {
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const maxCount = Math.max(...counts.values());
  const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  const fragment = document.createDocumentFragment();
  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogram";
  histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
  const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
  histogram.style.setProperty("--mfl-stats-bar-width", \`${"${barWidth}"}px\`);

  rows.forEach(([value, count]) => {
    const barHeight = maxCount > 0 ? Math.max(6, (count / maxCount) * 100) : 0;
    const totalPercent = totalPackable > 0 ? ((count / totalPackable) * 100).toFixed(1) : "0.0";
    const item = document.createElement("div");
    item.className = "mflStatsHistogramItem";
    item.innerHTML = \`<div class="mflStatsHistogramBar"><div class="mflStatsHistogramFill" data-tooltip="${"${escapeHtml(formatCount(count))}"} (${"${escapeHtml(totalPercent)}"}%)" style="--bar-height:${"${barHeight}"}%"></div></div><span class="mflStatsHistogramLabel">${"${escapeHtml(value)}"}</span>\`;
    histogram.appendChild(item);
  });

  fragment.appendChild(histogram);
  mflStatsAgeDistribution.replaceChildren(fragment);
}`;

const SINGLE_PASS_RENDER = `function renderMflStatsPage() {
  renderMflStatsFilterButtons();
  const summary = mflStatsSummary();

  if (mflStatsTotalPlayers) {
    mflStatsTotalPlayers.textContent = formatCount(summary.totalPlayers);
  }
  if (mflStatsPackablePlayers) {
    mflStatsPackablePlayers.textContent = formatCount(summary.packablePlayers);
  }
  if (mflStatsAgedPlayers) {
    mflStatsAgedPlayers.textContent = formatCount(summary.agedPlayers);
  }
  if (mflStatsOtherPlayers) {
    mflStatsOtherPlayers.textContent = formatCount(summary.otherPlayers);
  }

  renderMflStatsDistribution(summary.distributionCounts, summary.packablePlayers);
}`;

export function optimizeMflStatsRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = { ...(input.routeChunks || {}) };
  let mflStats = String(routeChunks.mflstats || "");
  if (!mflStats) throw new Error("Cannot optimize MFL Stats runtime without the MFL Stats route chunk.");

  mflStats = replaceRequiredFunction(
    mflStats,
    "mflStatsRows",
    SINGLE_PASS_SUMMARY,
    "single-pass MFL Stats summary",
  );
  mflStats = replaceRequiredFunction(
    mflStats,
    "renderMflStatsDistribution",
    SINGLE_PASS_DISTRIBUTION,
    "pre-aggregated MFL Stats distribution",
  );
  mflStats = replaceRequiredFunction(
    mflStats,
    "renderMflStatsPage",
    SINGLE_PASS_RENDER,
    "single-pass MFL Stats page render",
  );

  routeChunks.mflstats = mflStats;
  return Object.freeze({
    ...input,
    routeChunks: Object.freeze(routeChunks),
  });
}
