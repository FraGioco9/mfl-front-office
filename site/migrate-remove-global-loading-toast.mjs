import { readFile, writeFile, unlink } from "node:fs/promises";

const paths = {
  appEntry: new URL("./modules/app-entry.js", import.meta.url),
  loadingCss: new URL("./loading.css", import.meta.url),
  responsiveCss: new URL("./responsive.css", import.meta.url),
  loadingValidator: new URL("./validate-loading-ownership.mjs", import.meta.url),
  homeValidator: new URL("./validate-home-summary-first-paint.mjs", import.meta.url),
  evaluationValidator: new URL("./validate-evaluation-search-lifecycle.mjs", import.meta.url),
  zIndexValidator: new URL("./validate-z-index-ownership.mjs", import.meta.url),
  toastRuntime: new URL("./loading-toast-runtime.js", import.meta.url),
};

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function removeRange(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Could not find start of ${label}.`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Could not find end of ${label}.`);
  return source.slice(0, start) + source.slice(end);
}

function removeRule(source, selector, label) {
  const marker = `${selector} {`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${label}.`);
  let depth = 0;
  let end = -1;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`Could not find end of ${label}.`);
  while (source[end] === "\n") end += 1;
  return source.slice(0, start) + source.slice(end);
}

let appEntry = await readFile(paths.appEntry, "utf8");
appEntry = replaceOnce(appEntry, '  "/loading-toast-runtime.js",\n', "", "universal loading-toast runtime entry");
await writeFile(paths.appEntry, appEntry);

let loadingCss = await readFile(paths.loadingCss, "utf8");
loadingCss = removeRange(
  loadingCss,
  ".siteFooter.mflLoadingLocked,\n.siteFooter.mflLoadingLocked * {",
  ".toastMessage:not(#mflLoadingToast) {",
  "loading-driven footer lock CSS",
);
loadingCss = replaceOnce(
  loadingCss,
  ".toastMessage:not(#mflLoadingToast) {\n  bottom: var(--mfl-toast-bottom, 88px);\n  z-index: var(--mfl-z-toast);\n}\n\n#mflLoadingToast {\n  z-index: var(--mfl-z-topmost);\n}\n",
  ".toastMessage {\n  bottom: var(--mfl-toast-bottom, 88px);\n  z-index: var(--mfl-z-toast);\n}\n",
  "toast stacking CSS",
);
loadingCss = replaceOnce(
  loadingCss,
  "#mflLoadingToast,\n.toastMessage[data-mfl-retiring-toast=\"true\"] {\n  pointer-events: none;\n  user-select: none;\n}\n",
  "",
  "loading-toast pointer CSS",
);
await writeFile(paths.loadingCss, loadingCss);

let responsiveCss = await readFile(paths.responsiveCss, "utf8");
responsiveCss = removeRule(responsiveCss, "#mflLoadingToast", "responsive loading-toast rule");
await writeFile(paths.responsiveCss, responsiveCss);

let loadingValidator = await readFile(paths.loadingValidator, "utf8");
loadingValidator = replaceOnce(
  loadingValidator,
  "const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, loadingUi, tableLoading, appCoreSource] = await Promise.all([",
  "const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, tableLoading, appCoreSource] = await Promise.all([",
  "loading validator source list",
);
loadingValidator = replaceOnce(loadingValidator, '  read("./loading-toast-runtime.js"),\n', "", "loading-toast validator read");
loadingValidator = replaceOnce(loadingValidator, '  ".siteFooter.mflLoadingLocked",\n  "#mflLoadingToast",\n', "", "loading-toast required CSS markers");
const loadingConsumerStart = 'for (const [name, source] of [\n  ["loading-toast-runtime.js", loadingUi],';
const tableObserverStart = 'invariant(\n  !tableLoading.includes("observer.observe"),';
loadingValidator = removeRange(loadingValidator, loadingConsumerStart, tableObserverStart, "global loading UI validator block");
loadingValidator = replaceOnce(
  loadingValidator,
  tableObserverStart,
  `invariant(\n  !appEntry.includes('/loading-toast-runtime.js')\n    && !loadingStyles.includes('#mflLoadingToast')\n    && !loadingStyles.includes('mflLoadingLocked')\n    && !loadingStyles.includes('data-mfl-retiring-toast'),\n  "Global Loading toast/footer-lock presentation must stay removed from startup and loading CSS.",\n);\ninvariant(\n  tableLoading.includes("controller.subscribe(sync)")\n    && !tableLoading.includes("new MutationObserver")\n    && !tableLoading.includes('document.createElement("style")'),\n  "Table loading must remain the direct local subscriber without runtime style injection or DOM-observer loading inference.",\n);\n${tableObserverStart}`,
  "table loading local-owner assertion",
);
loadingValidator = replaceOnce(
  loadingValidator,
  'console.log("Separated non-blocking route/data loading from exclusive operation busy while preserving controller-owned route identity, route-ready startup, local loading subscribers, and mutation interaction protection.");',
  'console.log("Non-blocking route/data loading, exclusive operation busy, local table loading, and absence of global Loading-toast/footer-lock ownership validation passed.");',
  "loading validator completion message",
);
await writeFile(paths.loadingValidator, loadingValidator);

let homeValidator = await readFile(paths.homeValidator, "utf8");
homeValidator = replaceOnce(
  homeValidator,
  "const [indexHtml, stylesBase, bootstrapRuntime, staticUiRuntime, loadingToastRuntime, coreSource, buildNormalizer, releaseJson] = await Promise.all([",
  "const [indexHtml, stylesBase, bootstrapRuntime, staticUiRuntime, coreSource, buildNormalizer, releaseJson] = await Promise.all([",
  "Home validator source list",
);
homeValidator = replaceOnce(homeValidator, '  read("./loading-toast-runtime.js"),\n', "", "Home loading-toast read");
homeValidator = removeRange(
  homeValidator,
  "includes(\n  loadingToastRuntime,",
  "const loaderStart = eagerCore.indexOf(\"let summaryLoadPromise = null;\");",
  "Home loading-toast cache suppression assertions",
);
homeValidator = replaceOnce(
  homeValidator,
  'console.log("Home and deep-link first-paint validation passed: non-Home routes never expose Home boxes, entity shells wait for verification, cached Home counts repaint without refetching, and any fully cached route suppresses the Loading toast.");',
  'console.log("Home and deep-link first-paint validation passed: non-Home routes never expose Home boxes, entity shells wait for verification, and cached Home counts repaint without refetching.");',
  "Home validator completion message",
);
await writeFile(paths.homeValidator, homeValidator);

let evaluationValidator = await readFile(paths.evaluationValidator, "utf8");
evaluationValidator = replaceOnce(
  evaluationValidator,
  "const [searchRuntime, controlInteractions, loadingToastRuntime, discountRateRuntime, appEntry, walletPreferences, appCoreSource] = await Promise.all([",
  "const [searchRuntime, controlInteractions, discountRateRuntime, appEntry, walletPreferences, appCoreSource] = await Promise.all([",
  "Evaluation validator source list",
);
evaluationValidator = replaceOnce(evaluationValidator, '  read("./loading-toast-runtime.js"),\n', "", "Evaluation loading-toast read");
evaluationValidator = removeRange(
  evaluationValidator,
  "const toastReasonsStart = loadingToastRuntime.indexOf(\"const TOAST_COORDINATION_REASONS = new Set([\");",
  "invariant(\n  discountRateRuntime.includes(\"let rateTextObserver = null;\")",
  "Evaluation loading-toast suppression assertions",
);
await writeFile(paths.evaluationValidator, evaluationValidator);

let zIndexValidator = await readFile(paths.zIndexValidator, "utf8");
zIndexValidator = replaceOnce(
  zIndexValidator,
  'invariant(loading.includes("z-index: var(--mfl-z-topmost);"), "Loading toast must consume the highest non-popup level.");\n',
  "",
  "loading-toast z-index assertion",
);
await writeFile(paths.zIndexValidator, zIndexValidator);

await unlink(paths.toastRuntime);

for (const [label, source] of [
  ["app-entry.js", appEntry],
  ["loading.css", loadingCss],
  ["responsive.css", responsiveCss],
  ["validate-loading-ownership.mjs", loadingValidator],
  ["validate-home-summary-first-paint.mjs", homeValidator],
  ["validate-evaluation-search-lifecycle.mjs", evaluationValidator],
  ["validate-z-index-ownership.mjs", zIndexValidator],
]) {
  if (source.includes("mflLoadingToast") || source.includes("loading-toast-runtime.js") || source.includes("mflLoadingLocked")) {
    throw new Error(`${label} still contains global loading-toast ownership.`);
  }
}

console.log("Removed the global Loading toast runtime and coordination owners.");
