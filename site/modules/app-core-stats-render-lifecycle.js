// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const MFL_STATS_ANIMATION_RUNTIME = `let mflStatsDistributionAnimationRevision = 0;
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
`;

/**
 * Keep the MFL Stats histogram DOM stable while route/data hydration can commit
 * more than one state. CSS must not auto-start a column animation for every DOM
 * creation; instead the final rendered histogram animates once after the shared
 * loading controller reports that the route is idle.
 * @param {string} source
 */
export function normalizeMflStatsHistogramLifecycle(source) {
  const runtime = String(source || "");
  if (!runtime) throw new Error("Cannot normalize an empty MFL Stats runtime.");

  let normalizedRuntime = replaceRequired(
    runtime,
    "const mflStatsOverallFilterOptions = [",
    `${MFL_STATS_ANIMATION_RUNTIME}\nconst mflStatsOverallFilterOptions = [`,
    "MFL Stats owns a single post-loading histogram animation scheduler",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
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
    cancelMflStatsDistributionAnimationSchedule();
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const maxCount = Math.max(...counts.values());`,
    "MFL Stats histogram preserves identical rendered distributions",
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
    "MFL Stats histogram wrapper stays static",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
    '    item.innerHTML = `<div class="mflStatsHistogramBar"><div class="mflStatsHistogramFill" data-tooltip="${escapeHtml(formatCount(count))} (${escapeHtml(totalPercent)}%)" style="--bar-height:${barHeight}%"></div></div><span class="mflStatsHistogramLabel">${escapeHtml(value)}</span>`;',
    '    item.innerHTML = `<div class="mflStatsHistogramBar"><div class="mflStatsHistogramFill" data-tooltip="${escapeHtml(formatCount(count))} (${escapeHtml(totalPercent)}%)" style="animation:none;--bar-height:${barHeight}%"></div></div><span class="mflStatsHistogramLabel">${escapeHtml(value)}</span>`;',
    "MFL Stats fill waits for the final post-loading animation",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
    "  mflStatsAgeDistribution.replaceChildren(fragment);",
    "  mflStatsAgeDistribution.replaceChildren(fragment);\n  scheduleMflStatsDistributionAnimation(mflStatsAgeDistribution);",
    "MFL Stats starts one animation after its final histogram render",
  );

  return normalizedRuntime;
}
