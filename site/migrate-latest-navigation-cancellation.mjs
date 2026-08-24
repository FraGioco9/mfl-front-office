import { readFile, writeFile } from "node:fs/promises";

const corePath = new URL("./modules/app-core.js", import.meta.url);
const viewValidatorPath = new URL("./validate-generated-view-transition.mjs", import.meta.url);
const routeValidatorPath = new URL("./validate-page-route-gate-transition.mjs", import.meta.url);
const runtimeValidatorPath = new URL("./validate-route-runtime.mjs", import.meta.url);

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let core = await readFile(corePath, "utf8");
if (!core.includes("window.__mflCancelIncrementalRouteRequest?.();\n    const transition = commitPageTransition")) {
  core = replaceOnce(
    core,
    "    const sequence = ++navigationTransitionSequence;\n    const transition = commitPageTransition(pageName, updateHash, options);",
    "    const sequence = ++navigationTransitionSequence;\n    window.__mflCancelIncrementalRouteRequest?.();\n    const transition = commitPageTransition(pageName, updateHash, options);",
    "page transition cancellation boundary",
  );
}
if (!core.includes("window.__mflCancelIncrementalRouteRequest?.();\n    const transition = stageViewTransition")) {
  core = replaceOnce(
    core,
    "    const transition = stageViewTransition(pageName, viewName, options);",
    "    window.__mflCancelIncrementalRouteRequest?.();\n    const transition = stageViewTransition(pageName, viewName, options);",
    "view transition cancellation boundary",
  );
}
const gateCancellation = "          window.__mflCancelIncrementalRouteRequest?.();\n";
if (core.includes(gateCancellation)) {
  core = replaceOnce(core, gateCancellation, "", "lazy route-gate cancellation");
}
await writeFile(corePath, core);

let viewValidator = await readFile(viewValidatorPath, "utf8");
if (!viewValidator.includes("pageRunnerCancel")) {
  viewValidator = replaceOnce(
    viewValidator,
    'const pageRunnerNavigation = pageRunner.indexOf(\'navigation.begin("page-transition")\');\nconst pageRunnerCommit = pageRunner.indexOf("commitPageTransition(pageName, updateHash, options)");',
    'const pageRunnerNavigation = pageRunner.indexOf(\'navigation.begin("page-transition")\');\nconst pageRunnerCancel = pageRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();", pageRunnerNavigation);\nconst pageRunnerCommit = pageRunner.indexOf("commitPageTransition(pageName, updateHash, options)");',
    "page runner cancellation index",
  );
  viewValidator = replaceOnce(
    viewValidator,
    "  pageRunnerNavigation >= 0\n    && pageRunnerCommit > pageRunnerNavigation",
    "  pageRunnerNavigation >= 0\n    && pageRunnerCancel > pageRunnerNavigation\n    && pageRunnerCommit > pageRunnerCancel",
    "page runner cancellation ordering",
  );
  viewValidator = replaceOnce(
    viewValidator,
    'const viewRunnerNavigation = viewRunner.indexOf(\'navigation.begin("view-transition")\');\nconst viewRunnerStage = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");',
    'const viewRunnerNavigation = viewRunner.indexOf(\'navigation.begin("view-transition")\');\nconst viewRunnerCancel = viewRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();", viewRunnerNavigation);\nconst viewRunnerStage = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");',
    "view runner cancellation index",
  );
  viewValidator = replaceOnce(
    viewValidator,
    "  viewRunnerNavigation >= 0\n    && viewRunnerStage > viewRunnerNavigation",
    "  viewRunnerNavigation >= 0\n    && viewRunnerCancel > viewRunnerNavigation\n    && viewRunnerStage > viewRunnerCancel",
    "view runner cancellation ordering",
  );
  viewValidator = replaceOnce(
    viewValidator,
    '"The global page transition runner must own navigation state through commit, paint, and its loader callback.",',
    '"The global page transition runner must abort obsolete route data before commit, then own navigation state through commit, paint, and its loader callback.",',
    "page runner validation message",
  );
  viewValidator = replaceOnce(
    viewValidator,
    '"The global view transition runner must own navigation state through commit, paint, and its loader callback.",',
    '"The global view transition runner must abort obsolete route data before staging the new view, then own navigation state through paint and its loader callback.",',
    "view runner validation message",
  );
}
await writeFile(viewValidatorPath, viewValidator);

let routeValidator = await readFile(routeValidatorPath, "utf8");
if (!routeValidator.includes("Lazy route loading must not retain a second incremental-request cancellation owner.")) {
  routeValidator = replaceOnce(
    routeValidator,
    'const cancelRequest = gate.indexOf("window.__mflCancelIncrementalRouteRequest?.();", loaderOwner);\n',
    "",
    "route-gate cancellation index",
  );
  routeValidator = replaceOnce(
    routeValidator,
    "    && loadingPaint > loadingPaintCondition\n    && cancelRequest > loadingPaint\n    && routeCoreLoad > loadingPaint",
    "    && loadingPaint > loadingPaintCondition\n    && routeCoreLoad > loadingPaint",
    "route-gate ordering without cancellation",
  );
  routeValidator = replaceOnce(
    routeValidator,
    '  gate.slice(loadingPaintCondition, cancelRequest).includes("busyToken || routeLoadingActive"),',
    '  gate.slice(loadingPaintCondition, routeCoreLoad).includes("busyToken || routeLoadingActive"),',
    "route-gate paint slice",
  );
  routeValidator = replaceOnce(
    routeValidator,
    '  "Only an active route-loading lifecycle may delay lazy work for the loading paint boundary.",\n);',
    '  "Only an active route-loading lifecycle may delay lazy work for the loading paint boundary.",\n);\ninvariant(\n  !gate.includes("window.__mflCancelIncrementalRouteRequest?.();"),\n  "Lazy route loading must not retain a second incremental-request cancellation owner.",\n);',
    "route-gate cancellation absence assertion",
  );
  routeValidator = replaceOnce(
    routeValidator,
    '"The committed route must decide full readiness first, paint only when route loading is active, then continue cancellation, lazy dependency loading, and final rendering.",',
    '"The committed route must decide full readiness first, paint only when route loading is active, then continue lazy dependency loading and final rendering after transition-owned cancellation.",',
    "route-gate validation message",
  );
}
await writeFile(routeValidatorPath, routeValidator);

let runtimeValidator = await readFile(runtimeValidatorPath, "utf8");
if (!runtimeValidator.includes("Global page/view transitions must own obsolete incremental-request cancellation before destination commit.")) {
  runtimeValidator = replaceOnce(
    runtimeValidator,
    'includes(coreSource, "window.__mflCancelIncrementalRouteRequest?.();", "Canonical app-core must cancel obsolete route data before lazy runtime loading.");',
    'includes(coreSource, "window.__mflCancelIncrementalRouteRequest?.();", "Canonical app-core must cancel obsolete route data through the global navigation transition owner.");\ninvariant(\n  coreSource.split("window.__mflCancelIncrementalRouteRequest?.();").length - 1 === 2,\n  "Global page/view transitions must own obsolete incremental-request cancellation before destination commit.",\n);',
    "route runtime cancellation ownership assertion",
  );
}
await writeFile(runtimeValidatorPath, runtimeValidator);

console.log("Moved obsolete route cancellation to the latest-navigation commit boundary.");
