import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const generatedSources = new Map([
  ["core", String(artifacts.core || "")],
  ...Object.entries(artifacts.routeChunks || {}).map(([name, value]) => [name, String(value || "")]),
]);

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourceContaining = (marker, label) => {
  const match = Array.from(generatedSources.entries()).find(([, text]) => text.includes(marker));
  invariant(match, `Could not locate generated ${label}.`);
  return { name: match[0], text: match[1] };
};

const section = (text, startMarker, endMarker, label) => {
  const start = text.indexOf(startMarker);
  const end = start >= 0 ? text.indexOf(endMarker, start + startMarker.length) : -1;
  invariant(start >= 0 && end > start, `Could not locate generated ${label}.`);
  return text.slice(start, end);
};

const pageTransitionOwner = sourceContaining("function commitPageTransition(pageName, updateHash = true, options = {}) {", "page transition owner");
const pageTransition = section(
  pageTransitionOwner.text,
  "function commitPageTransition(pageName, updateHash = true, options = {}) {",
  "function stageViewTransition",
  "page transition owner",
);
const pageState = pageTransition.indexOf("state.currentPage = requestedPageName;");
const pageUrl = pageTransition.indexOf("window.history.pushState");
const pageChrome = pageTransition.indexOf("window.__mflStaticUiRuntime?.sync?.();");
invariant(
  pageState >= 0 && pageUrl > pageState && pageChrome > pageUrl,
  "Generated page navigation must commit application state, URL, and route chrome in that order.",
);

const pageLoaderOwner = sourceContaining("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {", "incremental page loader");
const pageLoaderStart = pageLoaderOwner.text.indexOf("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const pageLoader = pageLoaderOwner.text.slice(pageLoaderStart);
const pageCommit = pageLoader.indexOf("commitPageTransition(pageName, navigationUpdatesHistory, options);");
const pagePaint = pageLoader.indexOf("await waitForViewTransitionPaint();", pageCommit);
const pageRoutePrepare = pageLoader.indexOf("prepareIncrementalRoute(pageName", pagePaint);
const pageRequest = pageLoader.indexOf("requestIncrementalRoute(route, 1)", pagePaint);
const firstPageLoad = [pageRoutePrepare, pageRequest].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
invariant(
  pageCommit >= 0 && pagePaint > pageCommit && firstPageLoad > pagePaint,
  "Generated page loading must begin only after state, URL, sidebar/view chrome, and a browser paint have committed.",
);
invariant(
  pageLoader.indexOf("updateHash = false;", pagePaint) > pagePaint,
  "Generated page loader must suppress downstream duplicate history ownership after the canonical transition.",
);

const activationOwner = sourceContaining("function activateViewButton(button) {", "view-button activation owner");
const activation = section(
  activationOwner.text,
  "function activateViewButton(button) {",
  "function clearPointerCommittedViewButton() {",
  "view-button activation owner",
);
const activationStage = activation.indexOf("const transition = stageViewTransition(pageName, viewName, {");
const activationPaint = activation.indexOf("await waitForViewTransitionPaint();", activationStage);
const activationLoad = activation.indexOf("await setView(viewName);", activationPaint);
invariant(
  activationStage >= 0 && activationPaint > activationStage && activationLoad > activationPaint,
  "Generated shared view activation must commit URL/button intent and paint before calling the view loader.",
);

const incrementalOwner = sourceContaining("setView = async function setIncrementalView(viewName) {", "incremental view loader");
const incrementalView = section(
  incrementalOwner.text,
  "setView = async function setIncrementalView(viewName) {",
  "setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {",
  "incremental view loader",
);
const stagedTake = incrementalView.indexOf("const stagedTransition = takeStagedViewTransition(pageName, nextView);");
const stagedBranch = incrementalView.indexOf("if (stagedTransition) {", stagedTake);
const request = incrementalView.indexOf("requestIncrementalRoute(route, 1)", stagedBranch);
invariant(
  stagedTake >= 0 && stagedBranch > stagedTake && request > stagedBranch,
  "Generated incremental view loader must consume the already-painted interaction transition before requesting data.",
);

const fallbackCommit = incrementalView.indexOf("commitViewTransition(pageName, nextView, {", stagedBranch);
const fallbackPaint = incrementalView.indexOf("await waitForViewTransitionPaint();", fallbackCommit);
invariant(
  fallbackCommit >= 0 && fallbackPaint > fallbackCommit && request > fallbackPaint,
  "Programmatic generated view switches must commit and paint before requesting data.",
);

const clubOwner = sourceContaining("commitViewTransition(CLUB_PAGE, nextView, {", "Club view owner");
const clubCommit = clubOwner.text.indexOf("commitViewTransition(CLUB_PAGE, nextView, {");
const clubPaint = clubOwner.text.indexOf("await waitForViewTransitionPaint();", clubCommit);
const clubLoading = clubOwner.text.indexOf("setClubSwitching(true);", clubPaint);
invariant(
  clubCommit >= 0 && clubPaint > clubCommit && clubLoading > clubPaint,
  "Generated Club view switching must commit URL/button state and paint before loading starts.",
);

invariant(
  !activation.includes("window.__mflTableLoadingRuntime?.show"),
  "The generated view-button owner must not contain a competing loading-shell trigger.",
);

console.log(
  `Generated page/view transitions validated across ${pageTransitionOwner.name}, ${pageLoaderOwner.name}, ${activationOwner.name}, ${incrementalOwner.name}, and ${clubOwner.name}: state and URL chrome paint before loading.`,
);
