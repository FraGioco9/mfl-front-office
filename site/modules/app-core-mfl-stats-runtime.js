// Generated MFL Stats core chunk from modules/app-core.js. Do not edit directly.
let mflStatsDistributionAnimationRevision = 0;
let mflStatsDistributionAnimationFrame = 0;
let mflStatsDistributionAnimationUnsubscribe = null;

function cancelMflStatsDistributionAnimationSchedule() {
  mflStatsDistributionAnimationRevision += 1;
  if (mflStatsDistributionAnimationFrame) cancelAnimationFrame(mflStatsDistributionAnimationFrame);
  mflStatsDistributionAnimationFrame = 0;
  mflStatsDistributionAnimationUnsubscribe?.();
  mflStatsDistributionAnimationUnsubscribe = null;
}

function playMflStatsDistributionAnimation(container, revision) {
  mflStatsDistributionAnimationFrame = 0;
  if (revision !== mflStatsDistributionAnimationRevision
      || document.body?.dataset.page !== "mflstats"
      || !container.isConnected) return;
  container.querySelectorAll(".mflStatsHistogramFill").forEach((fill) => {
    if (!(fill instanceof HTMLElement)) return;
    fill.getAnimations().forEach((animation) => animation.cancel());
    fill.animate([
      { transform: "scaleY(0.18)" },
      { transform: "scaleY(1)" },
    ], {
      duration: 220,
      easing: "ease-out",
    });
  });
}

function scheduleMflStatsDistributionAnimation(container) {
  cancelMflStatsDistributionAnimationSchedule();
  const revision = mflStatsDistributionAnimationRevision;
  const scheduleAfterPaint = () => {
    if (revision !== mflStatsDistributionAnimationRevision) return;
    mflStatsDistributionAnimationFrame = requestAnimationFrame(() => {
      if (revision !== mflStatsDistributionAnimationRevision) return;
      mflStatsDistributionAnimationFrame = requestAnimationFrame(() => playMflStatsDistributionAnimation(container, revision));
    });
  };

  const controller = window.__mflInteractionBusy;
  if (controller?.isBusy?.()) {
    mflStatsDistributionAnimationUnsubscribe = controller.subscribe?.((snapshot) => {
      if (revision !== mflStatsDistributionAnimationRevision || snapshot?.busy) return;
      const unsubscribe = mflStatsDistributionAnimationUnsubscribe;
      mflStatsDistributionAnimationUnsubscribe = null;
      unsubscribe?.();
      scheduleAfterPaint();
    }, { immediate: false }) || null;
    if (!controller.isBusy()) {
      const unsubscribe = mflStatsDistributionAnimationUnsubscribe;
      mflStatsDistributionAnimationUnsubscribe = null;
      unsubscribe?.();
      scheduleAfterPaint();
    }
    return;
  }

  scheduleAfterPaint();
}

const mflStatsOverallFilterOptions = [
  { id: "all", label: "All", min: null, max: null },
  { id: "90-94", label: "90-94", min: 90, max: 94 },
  { id: "legendary", label: "Legendary", min: 85, max: 94 },
  { id: "85-89", label: "85-89", min: 85, max: 89 },
  { id: "80-84", label: "80-84", min: 80, max: 84 },
  { id: "rare", label: "Rare", min: 75, max: 84 },
  { id: "75-79", label: "75-79", min: 75, max: 79 },
  { id: "70-74", label: "70-74", min: 70, max: 74 },
  { id: "uncommon", label: "Uncommon", min: 65, max: 74 },
  { id: "65-69", label: "65-69", min: 65, max: 69 },
  { id: "60-64", label: "60-64", min: 60, max: 64 },
  { id: "limited", label: "Limited", min: 55, max: 64 },
  { id: "55-59", label: "55-59", min: 55, max: 59 },
  { id: "50-54", label: "50-54", min: 50, max: 54 },
  { id: "common", label: "Common", min: null, max: 54 },
];

function mflStatsFilterById(filterId = state.mflStatsOverallFilter) {
  return mflStatsOverallFilterOptions.find((filter) => filter.id === filterId) || mflStatsOverallFilterOptions[0];
}

function rowMatchesMflStatsOverallFilter(row, filter = mflStatsFilterById()) {
  const overall = Number(statDisplayValue(row, "overall"));
  if (!Number.isFinite(overall)) {
    return false;
  }

  return (filter.min === null || overall >= filter.min) && (filter.max === null || overall <= filter.max);
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

function mflStatsRows() {
  const filter = mflStatsFilterById();
  return state.rows
    .filter((row) => rowIsMflWalletPlayer(row))
    .filter((row) => rowMatchesMflStatsOverallFilter(row, filter));
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

function mflStatsDistributionValue(row) {
  if (state.mflStatsDistributionMode === "age") {
    const age = Number(getValue(row, "age"));
    return Number.isFinite(age) ? age : null;
  }

  const overall = Number(statDisplayValue(row, "overall"));
  return Number.isFinite(overall) ? Math.trunc(overall) : null;
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
  if (mflStatsAgeDistribution.dataset.mflStatsRenderSignature === distributionSignature
      && mflStatsAgeDistribution.firstElementChild) {
    return;
  }
  mflStatsAgeDistribution.dataset.mflStatsRenderSignature = distributionSignature;

  if (!counts.size) {
    cancelMflStatsDistributionAnimationSchedule();
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const maxCount = Math.max(...counts.values());
  const fragment = document.createDocumentFragment();
  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogram";
  histogram.style.animation = "none";
  histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
  const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
  histogram.style.setProperty("--mfl-stats-bar-width", `${barWidth}px`);

  rows.forEach(([value, count]) => {
    const barHeight = maxCount > 0 ? Math.max(6, (count / maxCount) * 100) : 0;
    const totalPercent = totalPackable > 0 ? ((count / totalPackable) * 100).toFixed(1) : "0.0";
    const item = document.createElement("div");
    item.className = "mflStatsHistogramItem";
    item.innerHTML = `<div class="mflStatsHistogramBar"><div class="mflStatsHistogramFill" data-tooltip="${escapeHtml(formatCount(count))} (${escapeHtml(totalPercent)}%)" style="animation:none;--bar-height:${barHeight}%"></div></div><span class="mflStatsHistogramLabel">${escapeHtml(value)}</span>`;
    histogram.appendChild(item);
  });

  fragment.appendChild(histogram);
  mflStatsAgeDistribution.replaceChildren(fragment);
  scheduleMflStatsDistributionAnimation(mflStatsAgeDistribution);
}

function renderMflStatsPage() {
  renderMflStatsFilterButtons();
  const rows = mflStatsRows();
  const packableRows = rows.filter((row) => mflStatsCategory(row) === "packable");
  const agedRows = rows.filter((row) => mflStatsCategory(row) === "aged");
  const otherRows = rows.filter((row) => mflStatsCategory(row) === "other");

  if (mflStatsTotalPlayers) {
    mflStatsTotalPlayers.textContent = formatCount(rows.length);
  }
  if (mflStatsPackablePlayers) {
    mflStatsPackablePlayers.textContent = formatCount(packableRows.length);
  }
  if (mflStatsAgedPlayers) {
    mflStatsAgedPlayers.textContent = formatCount(agedRows.length);
  }
  if (mflStatsOtherPlayers) {
    mflStatsOtherPlayers.textContent = formatCount(otherRows.length);
  }

  renderMflStatsDistribution(packableRows);
}

mflStatsDistributionModeButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-distribution]");
  if (!button) {
    return;
  }

  state.mflStatsDistributionMode = button.dataset.distribution === "age" ? "age" : "overall";
  renderMflStatsPage();
});
