// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const MFL_STATS_DISTRIBUTION_ANIMATION_RUNTIME = `const MFL_STATS_DISTRIBUTION_ANIMATION_CLASS = "mflStatsDistributionAnimating";

function resetMflStatsDistributionAnimation() {
  if (mflStatsAgeDistribution instanceof HTMLElement) {
    mflStatsAgeDistribution.classList.remove(MFL_STATS_DISTRIBUTION_ANIMATION_CLASS);
  }
}

function animateMflStatsDistribution(restart = false) {
  if (!(mflStatsAgeDistribution instanceof HTMLElement)) return;
  if (restart) {
    mflStatsAgeDistribution.classList.remove(MFL_STATS_DISTRIBUTION_ANIMATION_CLASS);
    void mflStatsAgeDistribution.offsetWidth;
  }
  mflStatsAgeDistribution.classList.add(MFL_STATS_DISTRIBUTION_ANIMATION_CLASS);
}

function syncMflStatsDistributionAnimationRoute() {
  if (document.body?.dataset.page !== "mflstats") resetMflStatsDistributionAnimation();
}

const mflStatsDistributionAnimationObserver = new MutationObserver(syncMflStatsDistributionAnimationRoute);
if (document.body) {
  mflStatsDistributionAnimationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-page"],
  });
}`;

/**
 * Move MFL Stats column animation ownership from replaceable histogram nodes to
 * the persistent distribution container. New bars created during hydration
 * inherit the current animation progress instead of starting a new animation.
 * @param {string} source
 */
export function normalizeMflStatsHistogramAnimation(source) {
  const runtime = String(source || "");
  if (!runtime) throw new Error("Cannot normalize an empty MFL Stats runtime.");

  let normalized = replaceRequired(
    runtime,
    "const mflStatsOverallFilterOptions = [",
    `${MFL_STATS_DISTRIBUTION_ANIMATION_RUNTIME}\n\nconst mflStatsOverallFilterOptions = [`,
    "MFL Stats persistent distribution animation owner",
  );

  normalized = replaceRequired(
    normalized,
    `      button.addEventListener("click", () => {
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage();
      });`,
    `      button.addEventListener("click", () => {
        if (state.mflStatsOverallFilter === filter.id) return;
        state.mflStatsOverallFilter = filter.id;
        renderMflStatsPage({ restartDistributionAnimation: true });
      });`,
    "MFL Stats filter interaction animation",
  );

  normalized = replaceRequired(
    normalized,
    "function renderMflStatsDistribution(packableRows) {",
    "function renderMflStatsDistribution(packableRows, options = {}) {",
    "MFL Stats distribution animation options",
  );

  normalized = replaceRequired(
    normalized,
    '  histogram.className = "mflStatsHistogram";',
    '  histogram.className = "mflStatsHistogramPersistent";',
    "MFL Stats histogram leaves the replaceable animated class",
  );

  normalized = replaceRequired(
    normalized,
    'class="mflStatsHistogramFill"',
    'class="mflStatsHistogramFillPersistent"',
    "MFL Stats fills leave the replaceable animated class",
  );

  normalized = replaceRequired(
    normalized,
    "  mflStatsAgeDistribution.replaceChildren(fragment);",
    `  mflStatsAgeDistribution.replaceChildren(fragment);
  animateMflStatsDistribution(options.restartDistributionAnimation === true);`,
    "MFL Stats persistent distribution animation start",
  );

  normalized = replaceRequired(
    normalized,
    "function renderMflStatsPage() {",
    "function renderMflStatsPage(options = {}) {",
    "MFL Stats page animation options",
  );

  normalized = replaceRequired(
    normalized,
    "  renderMflStatsDistribution(packableRows);",
    "  renderMflStatsDistribution(packableRows, options);",
    "MFL Stats page passes distribution animation options",
  );

  normalized = replaceRequired(
    normalized,
    `  state.mflStatsDistributionMode = button.dataset.distribution === "age" ? "age" : "overall";
  renderMflStatsPage();`,
    `  const nextMode = button.dataset.distribution === "age" ? "age" : "overall";
  if (nextMode === state.mflStatsDistributionMode) return;
  state.mflStatsDistributionMode = nextMode;
  renderMflStatsPage({ restartDistributionAnimation: true });`,
    "MFL Stats distribution mode interaction animation",
  );

  return normalized;
}
