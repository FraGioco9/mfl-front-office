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
  `Generated view transitions validated across ${activationOwner.name}, ${incrementalOwner.name}, and ${clubOwner.name}: state, URL, and active button commit before loading.`,
);
