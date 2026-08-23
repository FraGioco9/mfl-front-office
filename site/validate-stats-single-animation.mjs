import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [databaseStats, mflStats, buildCore, lifecycle, bootstrapCore, indexHtml] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core-stats-render-lifecycle.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
]);

includes(
  databaseStats,
  "container.dataset.mflStatsRenderSignature === distributionSignature",
  "Database Stats must preserve an identical histogram DOM during repeated hydration renders.",
);
includes(
  mflStats,
  "mflStatsAgeDistribution.dataset.mflStatsRenderSignature === distributionSignature",
  "MFL Stats must preserve an identical histogram DOM during repeated hydration renders.",
);
includes(
  bootstrapCore,
  "snapshot: () => currentSnapshot",
  "The shared loading controller must expose its settled-state snapshot.",
);
includes(
  bootstrapCore,
  "subscribe,",
  "The shared loading controller must expose loading-state subscriptions.",
);

for (const [name, source] of [["Database Stats", databaseStats], ["MFL Stats", mflStats]]) {
  includes(
    source,
    "controller?.isBusy?.()",
    `${name} must defer a pending histogram animation while route/data loading is active.`,
  );
  includes(
    source,
    "subscribe?.((snapshot)",
    `${name} must preserve a pending animation across loading-state changes.`,
  );
  includes(
    source,
    "fill.animate([",
    `${name} must start its column rise explicitly.`,
  );
  includes(
    source,
    '{ transform: "scaleY(0.18)" },',
    `${name} must preserve the intended column-rise start state.`,
  );
  includes(
    source,
    '{ transform: "scaleY(1)" },',
    `${name} must preserve the intended column-rise end state.`,
  );
}

includes(
  databaseStats,
  "let loadAnimationAvailable = true;",
  "Database Stats must own one load-animation token per Stats page entry.",
);
includes(
  databaseStats,
  'if (intent === "load") loadAnimationAvailable = false;',
  "Database Stats must consume the load-animation token only when animation begins.",
);
includes(
  databaseStats,
  "let interactionAnimationRequested = false;",
  "Database Stats must keep user-triggered animation intent separate from page loading.",
);
includes(
  databaseStats,
  "requestDistributionInteractionAnimation();",
  "Database Stats filters and distribution changes must explicitly request one interaction animation.",
);
includes(
  databaseStats,
  'fill.style.animation = "none";',
  "Database Stats must prevent intermediate DOM creation from auto-starting the CSS animation.",
);

includes(
  mflStats,
  "let mflStatsLoadAnimationAvailable = true;",
  "MFL Stats must own one load-animation token per Stats page entry.",
);
includes(
  mflStats,
  'if (intent === "load") mflStatsLoadAnimationAvailable = false;',
  "MFL Stats must consume the load-animation token only when animation begins.",
);
includes(
  mflStats,
  "let mflStatsInteractionAnimationRequested = false;",
  "MFL Stats must keep user-triggered animation intent separate from page loading.",
);
includes(
  mflStats,
  "requestMflStatsInteractionAnimation();",
  "MFL Stats filters and distribution changes must explicitly request one interaction animation.",
);
includes(
  mflStats,
  'style="animation:none;--bar-height:${barHeight}%"',
  "MFL Stats must prevent intermediate DOM creation from auto-starting the CSS animation.",
);

includes(
  buildCore,
  "normalizeMflStatsHistogramLifecycle",
  "The generated MFL Stats runtime must receive the one-shot animation lifecycle during the canonical core build.",
);
includes(
  lifecycle,
  "MFL Stats owns a route-scoped one-shot histogram animation session",
  "The MFL Stats build normalizer must own the route-scoped animation token.",
);
includes(
  lifecycle,
  "scheduleMflStatsDistributionAnimation(mflStatsAgeDistribution, animationIntent)",
  "The generated MFL Stats runtime must schedule only the currently-owned animation intent.",
);
includes(
  lifecycle,
  "new MutationObserver(syncMflStatsAnimationRouteSession)",
  "MFL Stats must reset its load-animation token when leaving and re-entering the Stats route.",
);
excludes(
  indexHtml,
  "#databaseStatsPage .mflStatsHistogram {\n        animation: none !important;",
  "Database Stats must not suppress animation with the legacy !important workaround.",
);

console.log("Database Stats and MFL Stats allow at most one load animation per Stats page entry.");
