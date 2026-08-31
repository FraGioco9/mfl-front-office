// Generated MFL Stats core from modules/core-sources/mfl-stats.js. Do not edit directly.
const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];

function mflStatsFilterById(filterId = state.mflStatsOverallFilter) {
  return mflStatsOverallFilterOptions.find((filter) => filter.id === filterId) || mflStatsOverallFilterOptions[0];
}

function rowMatchesMflStatsOverallFilter(overall, filter = mflStatsFilterById()) {
  return Number.isFinite(overall)
    && (filter.min === null || overall >= filter.min)
    && (filter.max === null || overall <= filter.max);
}

function mflStatsCategory(row) {
  if (rowHasHiddenMflJoinedAgencyDate(row)) {
    return "other";
  }

  const seasons = Number(getValue(row, "player_seasons"));
  if (seasons === 1) {
    return "packable";
  }

  if (Number.isFinite(seasons) && seasons >= 2) {
    return "aged";
  }

  return "other";
}

let mflStatsPreparedSourceRows = null;
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
}

function renderMflStatsFilterButtons() {
  if (!mflStatsOverallFilters) {
    return;
  }

  const existingButtons = new Map(
    Array.from(mflStatsOverallFilters.querySelectorAll(":scope > .mflStatsFilterButton"))
      .map((button) => [String(button.dataset.staticValue || ""), button]),
  );
  const expectedButtons = new Set();

  mflStatsOverallFilterOptions.forEach((filter, index) => {
    let button = existingButtons.get(filter.id);
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "mflStatsFilterButton";
      button.dataset.staticValue = filter.id;
      button.textContent = filter.label;
    }

    expectedButtons.add(button);
    button.classList.toggle("active", filter.id === state.mflStatsOverallFilter);
    if (button.dataset.mflStatsBound !== "true") {
      button.dataset.mflStatsBound = "true";
      button.addEventListener("click", () => {
        if (state.mflStatsOverallFilter === filter.id) return;
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage();
      });
    }

    const currentButton = mflStatsOverallFilters.children[index];
    if (currentButton !== button) {
      mflStatsOverallFilters.insertBefore(button, currentButton || null);
    }
  });

  Array.from(mflStatsOverallFilters.children).forEach((button) => {
    if (!expectedButtons.has(button)) button.remove();
  });
}

function mflStatsDistributionValue(entry) {
  if (state.mflStatsDistributionMode === "age") return entry.age;
  return Number.isFinite(entry.overall) ? Math.trunc(entry.overall) : null;
}

function renderMflStatsDistributionModeButtons() {
  if (!mflStatsDistributionModeButtons) {
    return;
  }

  mflStatsDistributionModeButtons.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.distribution === state.mflStatsDistributionMode;
    button.classList.toggle("active", active);
  });
}

function renderMflStatsDistribution(packableRows) {
  if (!mflStatsAgeDistribution) {
    return;
  }

  renderMflStatsDistributionModeButtons();
  if (mflStatsDistributionTitle) {
    mflStatsDistributionTitle.textContent = state.mflStatsDistributionMode === "age"
      ? "Packable Age Distribution"
      : "Packable Overall Distribution";
  }

  const counts = new Map();
  packableRows.forEach((row) => {
    const value = mflStatsDistributionValue(row);
    if (value !== null) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });

  const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
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

  const maxCount = Math.max(...counts.values());
  const fragment = document.createDocumentFragment();
  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogramLayout";
  histogram.style.display = "grid";
  histogram.style.gridTemplateColumns = "repeat(var(--mfl-stats-bars, 1), minmax(0, 1fr))";
  histogram.style.alignItems = "end";
  histogram.style.gap = "clamp(3px, 0.45vw, 7px)";
  histogram.style.width = "100%";
  histogram.style.height = "100%";
  histogram.style.paddingTop = "34px";
  histogram.style.minWidth = "620px";
  histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
  const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
  histogram.style.setProperty("--mfl-stats-bar-width", `${barWidth}px`);

  rows.forEach(([value, count]) => {
    const barHeight = maxCount > 0 ? Math.max(6, (count / maxCount) * 100) : 0;
    const totalPercent = totalPackable > 0 ? ((count / totalPackable) * 100).toFixed(1) : "0.0";
    const item = document.createElement("div");
    item.className = "mflStatsHistogramItem";
    item.innerHTML = `<div class="mflStatsHistogramBar"><div class="mflStatsHistogramFill" data-tooltip="${escapeHtml(formatCount(count))} (${escapeHtml(totalPercent)}%)" style="--bar-height:${barHeight}%"></div></div><span class="mflStatsHistogramLabel">${escapeHtml(value)}</span>`;
    histogram.appendChild(item);
  });

  fragment.appendChild(histogram);
  mflStatsAgeDistribution.replaceChildren(fragment);
  window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
}

function renderMflStatsPage() {
  renderMflStatsFilterButtons();
  if (state.incrementalRoute?.scope !== "mflstats") return;
  const rows = mflStatsRows();
  const packableRows = [];
  let agedCount = 0;
  let otherCount = 0;
  rows.forEach((entry) => {
    if (entry.category === "packable") packableRows.push(entry);
    else if (entry.category === "aged") agedCount += 1;
    else otherCount += 1;
  });

  if (mflStatsTotalPlayers) {
    mflStatsTotalPlayers.textContent = formatCount(rows.length);
  }
  if (mflStatsPackablePlayers) {
    mflStatsPackablePlayers.textContent = formatCount(packableRows.length);
  }
  if (mflStatsAgedPlayers) {
    mflStatsAgedPlayers.textContent = formatCount(agedCount);
  }
  if (mflStatsOtherPlayers) {
    mflStatsOtherPlayers.textContent = formatCount(otherCount);
  }

  renderMflStatsDistribution(packableRows);
}

mflStatsDistributionModeButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-distribution]");
  if (!button) {
    return;
  }

  const nextMode = button.dataset.distribution === "age" ? "age" : "overall";
  if (nextMode === state.mflStatsDistributionMode) return;
  state.mflStatsDistributionMode = nextMode;
  renderMflStatsPage();
});
