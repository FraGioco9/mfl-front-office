// @ts-check

import {
  extractRequiredFunction,
  extractRequiredSection,
  finalizeSplitArtifacts,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const HOME_SUMMARY_FACADE = `let __mflHomeSummaryCacheReadyOwner = null;
let __mflHomeLoadSummaryOwner = null;

function homeSummaryCacheReady() {
  return typeof __mflHomeSummaryCacheReadyOwner === "function"
    && Boolean(__mflHomeSummaryCacheReadyOwner());
}

async function loadSummary() {
  if (typeof __mflHomeLoadSummaryOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("home");
  }
  if (typeof __mflHomeLoadSummaryOwner !== "function") return false;
  return __mflHomeLoadSummaryOwner.apply(this, arguments);
}

Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({
  isReady: homeSummaryCacheReady,
}));`;

export function splitHomeApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core } = normalizeSplitterInput(
    artifacts,
    "home",
    "Home summary ownership",
  );
  if (alreadySplit) return artifacts;

  const summaryCounts = extractRequiredFunction(core, "updateSummaryCounts", "Home summary count renderer");
  const extracted = extractRequiredSection(
    summaryCounts.core,
    "let summaryLoadPromise = null;",
    "function tablePageKey(",
    "Home summary loader and cache",
  );

  let home = replaceRequired(
    extracted.chunk,
    "function homeSummaryCacheReady() {",
    "function homeSummaryCacheReadyOwner() {",
    "Home summary cache readiness owner",
  );
  home = replaceRequired(
    home,
    "async function loadSummary() {",
    "async function homeLoadSummaryOwner() {",
    "Home summary loader owner",
  );
  home = replaceRequired(
    home,
    `Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({
  isReady: homeSummaryCacheReady,
}));

`,
    "",
    "Home summary shared cache contract",
  );
  home = `${summaryCounts.chunk}\n\n${home}\n\n__mflHomeSummaryCacheReadyOwner = homeSummaryCacheReadyOwner;\n__mflHomeLoadSummaryOwner = homeLoadSummaryOwner;`;

  const sharedCore = insertBeforeRequiredMarker(
    extracted.core,
    "function tablePageKey(",
    HOME_SUMMARY_FACADE,
    "Home summary lazy facade",
  );

  return finalizeSplitArtifacts(
    sharedCore,
    routeChunks,
    "home",
    home,
    "Home",
  );
}
