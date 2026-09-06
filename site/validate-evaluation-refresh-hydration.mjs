import { readFile } from "node:fs/promises";
import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const [appCoreSource, bootstrap, searchRuntime, loading, responsive, indexHtml] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"), read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"), read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"), read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"), read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./bootstrap.js"), read("./evaluation-search-state-runtime.js"),
  read("./loading.css"), read("./responsive.css"), read("./index.html"),
]);
const artifacts = readCanonicalCoreArtifacts(appCoreSource);
const shared = String(artifacts.core || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");

const renderStart = shared.indexOf("async function renderEvaluationPage()");
const renderEnd = shared.indexOf("function playerFirstPaintKnownValues", renderStart);
const renderPage = renderEnd > renderStart ? shared.slice(renderStart, renderEnd) : shared.slice(renderStart);
invariant(renderPage.includes("await loadSavedEvaluation(savedId);")
  && renderPage.includes("await loadSharedEvaluation(shareId);")
  && !/state\.evaluationSavedId !== savedId\)[\s\S]{0,180}renderEmptyEvaluationSelection\(true\)/.test(renderPage)
  && !/state\.evaluationShareId !== shareId\)[\s\S]{0,180}renderEmptyEvaluationSelection\(true\)/.test(renderPage),
  "Saved/shared routes must not flash empty/recent results before snapshot hydration.");

invariant(evaluation.includes("let evaluationSnapshotLoadGeneration = 0;")
  && evaluation.includes('let evaluationSnapshotLoadIdentity = "";')
  && evaluation.includes("let evaluationSnapshotLoadPromise = null;")
  && evaluation.includes("function evaluationSnapshotLoadIsCurrent(load)")
  && evaluation.includes("function runEvaluationSnapshotLoad(kind, snapshotId, loadSnapshot)")
  && evaluation.includes("if (evaluationSnapshotLoadPromise && evaluationSnapshotLoadIdentity === identity)")
  && evaluation.includes('return runEvaluationSnapshotLoad("share", shareId')
  && evaluation.includes('return runEvaluationSnapshotLoad("saved", savedId'),
  "Saved/shared snapshots must use one deduplicated generation-aware loader.");
invariant(evaluation.includes("if (!evaluationSnapshotLoadIsCurrent(load)) return false;")
  && evaluation.includes("snapshotLoad: load,")
  && evaluation.includes("if (snapshotLoad && !evaluationSnapshotLoadIsCurrent(snapshotLoad)) return false;"),
  "Snapshot loading and payload application must reject stale route generations.");

const recoveryStart = evaluation.indexOf("async function recoverInvalidEvaluationLink(snapshotLoad = null)");
const recoveryEnd = evaluation.indexOf("const advancedPlayerTableTsv", recoveryStart);
const recovery = evaluation.slice(recoveryStart, recoveryEnd);
invariant(recovery.includes('window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));')
  && recovery.includes('window.history.replaceState({}, "", "/evaluation");')
  && !recovery.includes("renderEmptyEvaluationSelection")
  && !recovery.includes("renderEvaluationPage"),
  "Invalid saved/shared recovery must settle URL/state only; the active loader owns the single final render.");

const sharedLoadStart = evaluation.indexOf("async function loadSharedEvaluation(shareId)");
const sharedLoadEnd = evaluation.indexOf("async function createSharedEvaluationFromPayload", sharedLoadStart);
const sharedLoad = evaluation.slice(sharedLoadStart, sharedLoadEnd);
const savedLoadStart = evaluation.indexOf("async function loadSavedEvaluation(savedId");
const savedLoadEnd = evaluation.indexOf("function evaluationPresentValueTotalFromPayload", savedLoadStart);
const savedLoad = evaluation.slice(savedLoadStart, savedLoadEnd);
invariant(sharedLoad.includes("const recovered = await recoverInvalidEvaluationLink(load);")
  && savedLoad.includes("const recovered = await recoverInvalidEvaluationLink(load);")
  && sharedLoad.includes("await renderEvaluationPage();")
  && savedLoad.includes("await renderEvaluationPage();"),
  "Active invalid snapshot failures must perform one final render after recovery.");
invariant(savedLoad.includes("let data = cachedSavedEvaluationEntry(id);")
  && savedLoad.includes("if (!data) {")
  && savedLoad.includes("data = rememberSavedEvaluationCacheEntry(data) || data;"),
  "Cached Saved Evaluation payloads must bypass the network and keep the same canonical hydration path.");

const primeStart = shared.indexOf("function primeEmptyEvaluationSearch()");
const primeEnd = shared.indexOf("function waitForEvaluationDiscountRate()", primeStart);
const prime = shared.slice(primeStart, primeEnd);
invariant(!prime.includes("focus(") && !prime.includes("select()")
  && prime.includes("void prime(false, true, false);")
  && searchRuntime.includes('hint.textContent = "Loading…";')
  && searchRuntime.includes("ownsEmptyRecentResults"),
  "Plain Evaluation must not auto-focus, while unresolved recent-five rows show one local Loading… surface on refresh and in-site entry.");

const firstPaintLoadingSelector = 'html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"]\n  #evaluationSearchResults[hidden]:empty::before';
const evaluationHandoffMarker = '<!-- Evaluation first paint: expose the route only after top controls are fully parsed. -->';
const evaluationHandoffIndex = indexHtml.indexOf(evaluationHandoffMarker);
const evaluationOptionsIndex = indexHtml.indexOf('id="evaluationOptionFilters"');
const evaluationPanelIndex = indexHtml.indexOf('id="evaluationPanel"');
const evaluationRouteCommitIndex = indexHtml.indexOf('document.body.dataset.page = "evaluation";');
invariant(
  !indexHtml.includes('<body data-page="home" class="pinnedSidebarVisible">\n    <script>')
    && evaluationOptionsIndex >= 0
    && evaluationHandoffIndex > evaluationOptionsIndex
    && evaluationRouteCommitIndex > evaluationHandoffIndex
    && evaluationPanelIndex > evaluationRouteCommitIndex
    && indexHtml.indexOf('page.hidden = false;', evaluationHandoffIndex) > evaluationRouteCommitIndex,
  "Direct Evaluation refresh must not expose the route while the page subtree is parser-incomplete; commit route/action/page visibility atomically only after top controls are parsed.",
);
invariant(
  loading.includes('@media (min-width: 521px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="true"] #evaluationButtons {\n    display: flex;\n  }\n}')
    && loading.includes('@media (max-width: 520px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="true"] #evaluationButtons {\n    display: grid;\n  }\n}'),
  "Selected Evaluation refresh must reserve the final Reset/Player Page action footprint before hydration on desktop, tablet, and mobile.",
);
invariant(
  loading.includes('@media (max-width: 520px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"] #evaluationButtons {\n    display: grid;\n  }\n}')
    && loading.includes('@media (min-width: 521px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"] #evaluationButtons {\n    display: flex;\n  }\n}'),
  "Parser-time plain Evaluation actions must use final mobile grid and desktop/tablet flex display.",
);
invariant(
  loading.includes(`${firstPaintLoadingSelector} {\n  content: "Loading…";\n  color: var(--text-soft);\n  font-size: 12px;\n}`)
    && loading.includes(`@media (max-width: 900px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"]\n    #evaluationSearchResults[hidden]:empty::before {\n    font-size: 10px;\n  }\n}`)
    && loading.includes(`@media (max-width: 520px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"]\n    #evaluationSearchResults[hidden]:empty::before {\n    font-size: 9px;\n  }\n}`)
    && loading.includes(`@media (max-width: 380px) {\n  html:not(.mflInitialRouteResolved)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"]\n    #evaluationSearchResults[hidden]:empty::before {\n    font-size: 8px;\n  }\n}`)
    && responsive.includes(".searchHint {\n    font-size: 10px;\n  }")
    && responsive.includes(".searchHint {\n    font-size: 9px;\n  }")
    && responsive.includes(".searchHint {\n    font-size: 8px;\n  }"),
  "Evaluation parser-time Loading… typography must match the hydrated searchHint contract at desktop, tablet, phone, and tiny-phone breakpoints.",
);

invariant(bootstrap.includes("function syncFirstPaintEvaluationRecentLoadingShell()")
  && bootstrap.includes('const currentHint = results.firstElementChild;')
  && bootstrap.includes('results.dataset.mflEvaluationRecentLoading === "true"')
  && bootstrap.includes('currentHint.textContent === "Loading…"')
  && bootstrap.includes('hint.textContent = "Loading…";')
  && bootstrap.includes('results.dataset.mflEvaluationRecentLoading = "true";')
  && bootstrap.includes('Reflect.set(window, "__mflSyncEvaluationRecentLoadingShell", syncFirstPaintEvaluationRecentLoadingShell);')
  && bootstrap.includes("syncFirstPaintEvaluationRecentLoadingShell();")
  && shared.includes('if (preserveInitialRecentLoading) window.__mflSyncEvaluationRecentLoadingShell?.();')
  && !shared.includes('if (requestedPageName === "evaluation") {\n    window.__mflSyncEvaluationRecentLoadingShell?.();\n  }'),
  "Evaluation recent Loading must be painted before destination visibility, reuse its existing DOM node when already owned, and never be recreated by route commit.");
invariant(bootstrap.includes("function firstPaintEvaluationRouteState(")
  && !bootstrap.includes("requestPlainEvaluationFirstPaintFocus")
  && !bootstrap.includes("searchInput.focus({ preventScroll: true });")
  && !bootstrap.includes("searchInput.select();"),
  "Bootstrap may restore selected names but must never auto-focus plain Evaluation.");
new Function(shared); new Function(evaluation);
console.log("Evaluation refresh/loading validation passed: one snapshot lifecycle, stale-route guards, stable Loading typography, local recent-five Loading feedback, background refresh, cached saved reuse, and no autofocus.");
