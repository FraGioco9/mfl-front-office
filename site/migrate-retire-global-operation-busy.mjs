import { readFile, writeFile } from "node:fs/promises";

const paths = {
  bootstrapCore: new URL("./bootstrap-core.js", import.meta.url),
  loadingCss: new URL("./loading.css", import.meta.url),
  controlsCss: new URL("./controls.css", import.meta.url),
  discountTooltip: new URL("./evaluation-discount-rate-ui-runtime.js", import.meta.url),
  loadingValidator: new URL("./validate-loading-ownership.mjs", import.meta.url),
  bootstrapValidator: new URL("./validate-bootstrap-ownership.mjs", import.meta.url),
  controlValidator: new URL("./validate-control-style-ownership.mjs", import.meta.url),
  statsValidator: new URL("./validate-stats-animation-owner.mjs", import.meta.url),
  modalValidator: new URL("./validate-modal-entrance-lifecycle.mjs", import.meta.url),
  loadingContract: new URL("./LOADING_CONTRACT.md", import.meta.url),
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

let bootstrapCore = await readFile(paths.bootstrapCore, "utf8");
bootstrapCore = replaceOnce(bootstrapCore, '    const BUSY_CLASS = "mflInteractionBusy";\n', "", "global busy class declaration");
bootstrapCore = removeRange(
  bootstrapCore,
  "    const OPERATION_BUSY_REASONS = new Set([",
  "    const activeTokens = new Map();",
  "operation busy and gesture declaration block",
);
bootstrapCore = replaceOnce(bootstrapCore, '      "interaction-loading",\n', "", "interaction-loading data reason");
bootstrapCore = removeRange(
  bootstrapCore,
  "    const deferredEndTokens = new Set();",
  "    let sequence = 0;",
  "gesture state declarations",
);
bootstrapCore = replaceOnce(bootstrapCore, "    let interactionListenersBound = false;\n", "", "interaction listener state");
bootstrapCore = replaceOnce(
  bootstrapCore,
  "        busy: reasons.some((reason) => OPERATION_BUSY_REASONS.has(reason)),",
  "        busy: false,",
  "snapshot busy classification",
);
bootstrapCore = replaceOnce(
  bootstrapCore,
  `    function applyState() {
      currentSnapshot = makeSnapshot();
      if (currentSnapshot.busy) bindInteractionBlockers();
      else unbindInteractionBlockers();
      document.documentElement.classList.toggle(BUSY_CLASS, currentSnapshot.busy);
      document.documentElement.classList.toggle(DATA_LOADING_CLASS, currentSnapshot.dataLoading);
      document.documentElement.dataset.interactionBusy = currentSnapshot.busy ? "true" : "false";
      if (document.body) document.body.setAttribute("aria-busy", currentSnapshot.busy ? "true" : "false");
      notifySubscribers(currentSnapshot);
    }
`,
  `    function applyState() {
      currentSnapshot = makeSnapshot();
      document.documentElement.classList.toggle(DATA_LOADING_CLASS, currentSnapshot.dataLoading);
      notifySubscribers(currentSnapshot);
    }
`,
  "global busy state application",
);
bootstrapCore = replaceOnce(
  bootstrapCore,
  `    function end(token) {
      if (!token || !activeTokens.has(token)) return;
      if (blockedInteractionGestureActive()) {
        deferredEndTokens.add(token);
        return;
      }
      if (activeTokens.delete(token)) applyState();
    }
`,
  `    function end(token) {
      if (token && activeTokens.delete(token)) applyState();
    }
`,
  "gesture-aware loading token release",
);
bootstrapCore = removeRange(
  bootstrapCore,
  "    function pointerEventsSupported() {",
  "    function globalFunction(name) {",
  "global interaction blocker functions",
);
bootstrapCore = replaceOnce(
  bootstrapCore,
  '      window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");\n',
  "",
  "explicit global operation busy helper",
);
bootstrapCore = bootstrapCore.replaceAll("wrapBusyGlobal", "wrapLoadingGlobal");
bootstrapCore = replaceOnce(
  bootstrapCore,
  `      [
        "loadSharedEvaluation",
        "loadSavedEvaluation",
        "openSavedEvaluationsModal",
        "createSharedEvaluationFromPayload",
        "createSharedEvaluation",
        "createSavedEvaluation",
        "linkWallet",
      ].forEach((name) => wrapLoadingGlobal(name));`,
  `      [
        "loadSharedEvaluation",
        "loadSavedEvaluation",
        "openSavedEvaluationsModal",
      ].forEach((name) => wrapLoadingGlobal(name));`,
  "loading wrapper owner list",
);
await writeFile(paths.bootstrapCore, bootstrapCore);

let loadingCss = await readFile(paths.loadingCss, "utf8");
loadingCss = removeRange(
  loadingCss,
  "html.mflInteractionBusy,\nhtml.mflInteractionBusy body {",
  "html.mflInitialChromePreparing body:has(> #appShell),",
  "global busy cursor/interaction CSS",
);
loadingCss = removeRange(
  loadingCss,
  "html.mflInteractionBusy body main,",
  'html:not(.mflInitialRouteResolved)[data-initial-table-page="club"]',
  "global busy scroll/shield CSS",
);
await writeFile(paths.loadingCss, loadingCss);

let controlsCss = await readFile(paths.controlsCss, "utf8");
controlsCss = replaceOnce(
  controlsCss,
  `html.mflInteractionBusy #pagerCurrentPageInput,
html.mflDataLoading #pagerCurrentPageInput,
body[aria-busy="true"] #pagerCurrentPageInput {`,
  `html.mflDataLoading #pagerCurrentPageInput {`,
  "pager global busy selector",
);
controlsCss = replaceOnce(
  controlsCss,
  `html.mflInteractionBusy #pageSizeSelect,
html.mflDataLoading #pageSizeSelect,
body[aria-busy="true"] #pageSizeSelect {`,
  `html.mflDataLoading #pageSizeSelect {`,
  "page-size global busy selector",
);
await writeFile(paths.controlsCss, controlsCss);

let discountTooltip = await readFile(paths.discountTooltip, "utf8");
discountTooltip = replaceOnce(
  discountTooltip,
  '    const interactionBusy = () => document.documentElement.classList.contains("mflInteractionBusy");\n\n',
  "",
  "discount tooltip global busy predicate",
);
discountTooltip = discountTooltip.replaceAll(" || interactionBusy()", "");
discountTooltip = removeRange(
  discountTooltip,
  "    function scheduleIdleSync() {",
  "    function sync() {",
  "discount tooltip busy retry loop",
);
discountTooltip = replaceOnce(
  discountTooltip,
  `      if (interactionBusy()) {
        hide(true);
        scheduleIdleSync();
        return;
      }
`,
  "",
  "discount tooltip busy sync gate",
);
discountTooltip = discountTooltip.replaceAll(
  `      if (interactionBusy()) scheduleIdleSync();
      else sync();`,
  "      sync();",
);
discountTooltip = replaceOnce(discountTooltip, "    let idleFrame = 0;\n", "", "discount tooltip idle frame state");
discountTooltip = replaceOnce(
  discountTooltip,
  `      if (idleFrame) cancelAnimationFrame(idleFrame);
      idleFrame = 0;
`,
  "",
  "discount tooltip idle frame cleanup",
);
await writeFile(paths.discountTooltip, discountTooltip);

let loadingValidator = await readFile(paths.loadingValidator, "utf8");
loadingValidator = replaceOnce(loadingValidator, '  "html.mflInteractionBusy body::after",\n', "", "loading validator busy CSS requirement");
loadingValidator = replaceOnce(
  loadingValidator,
  `  !loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager")
    && !loadingStyles.includes("html.mflInteractionBusy #progressionPage nav.pager"),`,
  `  !loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager"),`,
  "pager blanket loading assertion",
);
loadingValidator = removeRange(
  loadingValidator,
  'const operationBusyStart = bootstrapCore.indexOf("const OPERATION_BUSY_REASONS = new Set([");',
  "for (const alias of [",
  "operation busy validation block",
);
loadingValidator = loadingValidator.replace(
  "for (const alias of [",
  `invariant(
  !bootstrapCore.includes("OPERATION_BUSY_REASONS")
    && !bootstrapCore.includes('const BUSY_CLASS = "mflInteractionBusy";')
    && !bootstrapCore.includes("bindInteractionBlockers")
    && !bootstrapCore.includes("blockInteraction(event)")
    && !bootstrapCore.includes("blockedInteractionGestureActive")
    && bootstrapCore.includes("busy: false,")
    && bootstrapCore.includes("dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),"),
  "The loading controller must publish route/data readiness without a global operation-busy blocker.",
);
invariant(
  !bootstrapCore.includes('"interaction-loading"')
    && !bootstrapCore.includes('"createSharedEvaluationFromPayload"')
    && !bootstrapCore.includes('"createSharedEvaluation"')
    && !bootstrapCore.includes('"createSavedEvaluation"')
    && !bootstrapCore.includes('"linkWallet"'),
  "Persistent mutations must not be wrapped as global loading/busy reasons.",
);

for (const alias of [`,
);
loadingValidator = removeRange(
  loadingValidator,
  `invariant(
  bootstrapCore.includes('"pointerdown", "pointerup", "pointercancel"')`,
  `invariant(
  !bootstrapCore.includes('document.createElement("style")')`,
  "gesture blocker validation assertions",
);
loadingValidator = replaceOnce(
  loadingValidator,
  `invariant(
  bootstrapCore.includes('window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");')
    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")
    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")
    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")
    && bootstrapCore.includes("return run(callback, normalizedReason);"),
  "Legacy uncached route/data loads must default to non-blocking route loading while the explicit operation-busy helper remains exclusive.",
);`,
  `invariant(
  !bootstrapCore.includes("window.__mflWithInteractionBusy")
    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")
    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")
    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")
    && bootstrapCore.includes("return run(callback, normalizedReason);"),
  "Legacy uncached route/data loads must retain non-blocking route/data notification without an explicit global operation-busy helper.",
);
invariant(
  appCoreSource.includes("evaluationSaveButton.disabled = true;")
    && appCoreSource.includes("evaluationSaveButton.disabled = false;")
    && appCoreSource.includes("evaluationShareButton.disabled = true;")
    && appCoreSource.includes("evaluationShareButton.disabled = false;")
    && appCoreSource.includes("state.walletOptInInProgress = true;")
    && appCoreSource.includes("linkWalletButton.disabled = true;")
    && appCoreSource.includes('linkWalletButton.textContent = "Loading...";'),
  "Persistent Evaluation and wallet mutations must retain local duplicate-submit protection and working feedback.",
);`,
  "operation busy helper validation",
);
loadingValidator = replaceOnce(
  loadingValidator,
  'console.log("Non-blocking route/data loading, exclusive operation busy, local table loading, and absence of global Loading-toast/footer-lock ownership validation passed.");',
  'console.log("Non-blocking route/data loading, local mutation feedback, local table loading, and absence of every global Loading-toast/interaction-blocker owner validation passed.");',
  "loading validator completion message",
);
await writeFile(paths.loadingValidator, loadingValidator);

let bootstrapValidator = await readFile(paths.bootstrapValidator, "utf8");
bootstrapValidator = replaceOnce(
  bootstrapValidator,
  `includes(
  bootstrapCore,
  'window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");',
  "The explicit operation-busy helper must retain exclusive interaction-loading ownership.",
);`,
  `excludes(
  bootstrapCore,
  "window.__mflWithInteractionBusy",
  "Persistent operations must not retain a global interaction-busy helper.",
);`,
  "bootstrap operation helper assertion",
);
bootstrapValidator = replaceOnce(
  bootstrapValidator,
  `includes(
  bootstrapCore,
  "return run(callback, normalizedReason);",
  "Non-duplicate explicit loading reasons must still enter the shared busy controller.",
);`,
  `includes(
  bootstrapCore,
  "return run(callback, normalizedReason);",
  "Non-duplicate route/data loading reasons must still enter the shared loading controller.",
);
for (const retiredBusyOwner of [
  "OPERATION_BUSY_REASONS",
  'const BUSY_CLASS = "mflInteractionBusy";',
  "bindInteractionBlockers",
  "blockedInteractionGestureActive",
  '"interaction-loading"',
  '"createSharedEvaluationFromPayload"',
  '"createSharedEvaluation"',
  '"createSavedEvaluation"',
  '"linkWallet"',
]) {
  excludes(bootstrapCore, retiredBusyOwner, `Global operation-busy ownership must stay removed through ${retiredBusyOwner}.`);
}
for (const localMutationOwner of [
  "evaluationSaveButton.disabled = true;",
  "evaluationSaveButton.disabled = false;",
  "evaluationShareButton.disabled = true;",
  "evaluationShareButton.disabled = false;",
  "state.walletOptInInProgress = true;",
  "linkWalletButton.disabled = true;",
  'linkWalletButton.textContent = "Loading...";',
]) {
  includes(appCoreSource, localMutationOwner, `Persistent mutations must retain local working-state ownership through ${localMutationOwner}`);
}`, 
  "bootstrap route/data loading assertion",
);
await writeFile(paths.bootstrapValidator, bootstrapValidator);

let controlValidator = await readFile(paths.controlValidator, "utf8");
controlValidator = controlValidator.replaceAll("html.mflInteractionBusy #pageSizeSelect", "html.mflDataLoading #pageSizeSelect");
controlValidator = replaceOnce(
  controlValidator,
  'invariant(!controls.includes("!important"), "controls.css must not introduce !important overrides.");',
  'invariant(!controls.includes("!important"), "controls.css must not introduce !important overrides.");\ninvariant(!controls.includes("mflInteractionBusy") && !controls.includes("aria-busy"), "Shared controls must not retain global operation-busy selectors after local mutation ownership replaces the site-wide blocker.");',
  "control busy selector absence assertion",
);
await writeFile(paths.controlValidator, controlValidator);

let statsValidator = await readFile(paths.statsValidator, "utf8");
statsValidator = removeRange(
  statsValidator,
  'const busyAnimationStart = loadingStyles.indexOf("html.mflInteractionBusy body *,' ,
  'console.log("Database Stats and MFL Stats keep one fill animation owner, stable histogram DOM, loading-safe animation timelines, and prepared local MFL filter derivation without synthetic loading.");',
  "stats global busy animation validation",
);
statsValidator += `invariant(!loadingStyles.includes("mflInteractionBusy"), "Stats animation ownership must not depend on a retired global busy blocker.");
const chromeAnimationStart = loadingStyles.indexOf("html.mflInitialChromePreparing");
const chromeAnimationEnd = loadingStyles.indexOf('html:not(.mflInitialRouteResolved)[data-initial-table-page="club"]', chromeAnimationStart);
const chromeAnimationBlock = loadingStyles.slice(chromeAnimationStart, chromeAnimationEnd);
invariant(chromeAnimationStart >= 0 && chromeAnimationEnd > chromeAnimationStart, "Initial chrome animation ownership must remain explicit.");
includes(chromeAnimationBlock, "animation-play-state: paused;", "Initial chrome preparation must pause animations without recreating them at first route readiness.");
excludes(chromeAnimationBlock, "animation: none;", "Initial chrome preparation must not restart Stats animations when readiness settles.");

console.log("Database Stats and MFL Stats keep one fill animation owner, stable histogram DOM, first-paint-safe animation timelines, and prepared local MFL filter derivation without global busy state.");
`;
await writeFile(paths.statsValidator, statsValidator);

let modalValidator = await readFile(paths.modalValidator, "utf8");
modalValidator = removeRange(
  modalValidator,
  "const busyPointerRule = loadingStyles.match(",
  'console.log("Source-owned modal first-open paint boundary and busy-state transition preservation validation passed.");',
  "modal busy transition validation",
);
modalValidator += `invariant(!loadingStyles.includes("mflInteractionBusy"), "Modal entrance transitions must not depend on a retired global operation-busy CSS owner.");

console.log("Source-owned modal first-open paint boundary remains independent from loading-state transition suppression.");
`;
await writeFile(paths.modalValidator, modalValidator);

let loadingContract = await readFile(paths.loadingContract, "utf8");
loadingContract = replaceOnce(
  loadingContract,
  "- Route/data loading is non-blocking. Exclusive busy state is reserved for persistent operations that cannot safely be duplicated.\n",
  "- Route/data loading is non-blocking. Persistent mutations use only their initiating control or local surface for duplicate-submit protection and working feedback; there is no whole-site busy blocker.\n",
  "loading contract operation-busy rule",
);
await writeFile(paths.loadingContract, loadingContract);

for (const [label, source] of [
  ["bootstrap-core.js", bootstrapCore],
  ["loading.css", loadingCss],
  ["controls.css", controlsCss],
  ["evaluation-discount-rate-ui-runtime.js", discountTooltip],
]) {
  if (source.includes("mflInteractionBusy") || source.includes("OPERATION_BUSY_REASONS") || source.includes("bindInteractionBlockers")) {
    throw new Error(`${label} still contains retired global operation-busy ownership.`);
  }
}

console.log("Retired global operation busy blocking while preserving route/data loading and local mutation feedback.");
