// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const MFL_STATS_ANIMATION_RUNTIME = `let mflStatsDistributionAnimationRevision = 0;
let mflStatsDistributionAnimationFrame = 0;
let mflStatsDistributionAnimationUnsubscribe = null;
let mflStatsRouteActive = false;
let mflStatsLoadAnimationAvailable = true;
let mflStatsInteractionAnimationRequested = false;

function cancelMflStatsDistributionAnimationSchedule() {
  mflStatsDistributionAnimationRevision += 1;
  if (mflStatsDistributionAnimationFrame) cancelAnimationFrame(mflStatsDistributionAnimationFrame);
  mflStatsDistributionAnimationFrame = 0;
  mflStatsDistributionAnimationUnsubscribe?.();
  mflStatsDistributionAnimationUnsubscribe = null;
}

function resetMflStatsDistributionAnimationSession() {
  cancelMflStatsDistributionAnimationSchedule();
  mflStatsLoadAnimationAvailable = true;
  mflStatsInteractionAnimationRequested = false;
  if (mflStatsAgeDistribution instanceof HTMLElement) {
    delete mflStatsAgeDistribution.dataset.mflStatsRenderSignature;
  }
}

function syncMflStatsAnimationRouteSession() {
  const active = document.body?.dataset.page === "mflstats";
  if (active && !mflStatsRouteActive) {
    mflStatsRouteActive = true;
    resetMflStatsDistributionAnimationSession();
  } else if (!active && mflStatsRouteActive) {
    mflStatsRouteActive = false;
    cancelMflStatsDistributionAnimationSchedule();
    mflStatsInteractionAnimationRequested = false;
  }
  return active;
}

function requestMflStatsInteractionAnimation() {
  mflStatsInteractionAnimationRequested = true;
}

function mflStatsDistributionAnimationIntent() {
  if (!syncMflStatsAnimationRouteSession()) return "";
  if (mflStatsInteractionAnimationRequested) return "interaction";
  if (mflStatsLoadAnimationAvailable) return "load";
  return "";
}

function playMflStatsDistributionAnimation(container, revision, intent) {
  mflStatsDistributionAnimationFrame = 0;
  if (revision !== mflStatsDistributionAnimationRevision
      || document.body?.dataset.page !== "mflstats"
      || !container.isConnected) return;
  if (intent === "interaction") mflStatsInteractionAnimationRequested = false;
  if (intent === "load") mflStatsLoadAnimationAvailable = false;
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

function scheduleMflStatsDistributionAnimation(container, intent) {
  cancelMflStatsDistributionAnimationSchedule();
  const revision = mflStatsDistributionAnimationRevision;
  const scheduleAfterPaint = () => {
    if (revision !== mflStatsDistributionAnimationRevision) return;
    mflStatsDistributionAnimationFrame = requestAnimationFrame(() => {
      if (revision !== mflStatsDistributionAnimationRevision) return;
      mflStatsDistributionAnimationFrame = requestAnimationFrame(() => playMflStatsDistributionAnimation(container, revision, intent));
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

const mflStatsAnimationRouteObserver = new MutationObserver(syncMflStatsAnimationRouteSession);
if (document.body) {
  mflStatsAnimationRouteObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-page"],
  });
}
syncMflStatsAnimationRouteSession();
`;

/**
 * Keep the MFL Stats histogram DOM stable while route/data hydration can commit
 * more than one state. One page entry owns one load-animation token; newer
 * renders may replace a pending animation, but once the rise begins that token
 * is consumed and later hydration renders cannot start another one.
 * @param {string} source
 */
export function normalizeMflStatsHistogramLifecycle(source) {
  const runtime = String(source || "");
  if (!runtime) throw new Error("Cannot normalize an empty MFL Stats runtime.");

  let normalizedRuntime = replaceRequired(
    runtime,
    "const mflStatsOverallFilterOptions = [",
    `${MFL_STATS_ANIMATION_RUNTIME}\nconst mflStatsOverallFilterOptions = [`,
    "MFL Stats owns a route-scoped one-shot histogram animation session",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
    `      button.addEventListener("click", () => {
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage();
      });`,
    `      button.addEventListener("click", () => {
        if (state.mflStatsOverallFilter === filter.id) return;
        state.mflStatsOverallFilter = filter.id;
        requestMflStatsInteractionAnimation();
        renderMflStatsPage();
      });`,
    "MFL Stats Overall filters request one interaction animation",
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
    mflStatsInteractionAnimationRequested = false;
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const animationIntent = mflStatsDistributionAnimationIntent();
  const maxCount = Math.max(...counts.values());`,
    "MFL Stats histogram preserves identical rendered distributions and resolves one animation intent",
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
    "MFL Stats fill waits for its one-shot animation intent",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
    "  mflStatsAgeDistribution.replaceChildren(fragment);",
    `  mflStatsAgeDistribution.replaceChildren(fragment);
  if (animationIntent) scheduleMflStatsDistributionAnimation(mflStatsAgeDistribution, animationIntent);
  else cancelMflStatsDistributionAnimationSchedule();`,
    "MFL Stats starts at most one load animation per page entry",
  );

  normalizedRuntime = replaceRequired(
    normalizedRuntime,
    `mflStatsDistributionModeButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-distribution]");
  if (!button) {
    return;
  }

  state.mflStatsDistributionMode = button.dataset.distribution === "age" ? "age" : "overall";
  renderMflStatsPage();
});`,
    `mflStatsDistributionModeButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-distribution]");
  if (!button) {
    return;
  }

  const nextMode = button.dataset.distribution === "age" ? "age" : "overall";
  if (nextMode === state.mflStatsDistributionMode) return;
  state.mflStatsDistributionMode = nextMode;
  requestMflStatsInteractionAnimation();
  renderMflStatsPage();
});`,
    "MFL Stats distribution mode requests one interaction animation",
  );

  return normalizedRuntime;
}
