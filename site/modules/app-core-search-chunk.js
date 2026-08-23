// @ts-check

import {
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const SEARCH_ROUTE_ONLY_FUNCTIONS = [
  "openSearch",
  "closeSearch",
  "playerSearchResult",
  "searchMatchScore",
  "bestSearchResults",
  "recentSearchRows",
  "syncPlayerSearchClearButton",
  "clearPlayerSearch",
  "renderSearchResultsNow",
  "renderSearchResults",
];

const SEARCH_FACADE = `let __mflSearchOpenOwner = null;
let __mflSearchCloseOwner = null;
let __mflSearchClearOwner = null;
let __mflSearchRenderNowOwner = null;
let __mflSearchRenderOwner = null;
let __mflSearchCorePromise = null;

function ensureGlobalSearchActionCore() {
  if (typeof __mflSearchOpenOwner === "function"
      && typeof __mflSearchRenderNowOwner === "function"
      && typeof __mflSearchRenderOwner === "function") {
    return Promise.resolve(true);
  }
  if (typeof window.__mflEnsureRouteCore !== "function") return Promise.resolve(false);
  if (!__mflSearchCorePromise) {
    __mflSearchCorePromise = Promise.resolve(window.__mflEnsureRouteCore("search"))
      .then(() => typeof __mflSearchOpenOwner === "function")
      .catch((error) => {
        console.warn("Could not load Global Search action core.", error);
        __mflSearchCorePromise = null;
        return false;
      });
  }
  return __mflSearchCorePromise;
}

async function openSearch() {
  await ensureGlobalSearchActionCore();
  if (typeof __mflSearchOpenOwner !== "function") return;
  return __mflSearchOpenOwner.apply(this, arguments);
}

function closeSearch() {
  if (typeof __mflSearchCloseOwner === "function") {
    return __mflSearchCloseOwner.apply(this, arguments);
  }
  hideModal(searchModal);
}

function clearPlayerSearch() {
  if (typeof __mflSearchClearOwner === "function") {
    return __mflSearchClearOwner.apply(this, arguments);
  }
  void ensureGlobalSearchActionCore().then(() => {
    if (typeof __mflSearchClearOwner === "function") __mflSearchClearOwner();
  });
}

function renderSearchResultsNow() {
  if (typeof __mflSearchRenderNowOwner === "function") {
    return __mflSearchRenderNowOwner.apply(this, arguments);
  }
  void ensureGlobalSearchActionCore().then(() => {
    if (typeof __mflSearchRenderNowOwner === "function") __mflSearchRenderNowOwner();
  });
}

function renderSearchResults() {
  if (typeof __mflSearchRenderOwner === "function") {
    return __mflSearchRenderOwner.apply(this, arguments);
  }
  void ensureGlobalSearchActionCore().then(() => {
    if (typeof __mflSearchRenderOwner === "function") __mflSearchRenderOwner();
  });
}`;

export function splitSearchApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core } = normalizeSplitterInput(
    artifacts,
    "search",
    "Global Search action ownership",
  );
  if (alreadySplit) return artifacts;

  const extracted = extractRequiredFunctions(core, SEARCH_ROUTE_ONLY_FUNCTIONS, "Global Search route-only helper");
  let search = extracted.chunks.join("\n\n");
  search = replaceRequired(search, "async function openSearch() {", "async function searchOpenOwner() {", "Global Search open owner");
  search = replaceRequired(search, "function closeSearch() {", "function searchCloseOwner() {", "Global Search close owner");
  search = replaceRequired(search, "function clearPlayerSearch() {", "function searchClearOwner() {", "Global Search clear owner");
  search = replaceRequired(search, "function renderSearchResultsNow() {", "function searchRenderNowOwner() {", "Global Search immediate renderer owner");
  search = replaceRequired(search, "function renderSearchResults() {", "function searchRenderOwner() {", "Global Search async renderer owner");
  search = `${search}\n\n__mflSearchOpenOwner = searchOpenOwner;\n__mflSearchCloseOwner = searchCloseOwner;\n__mflSearchClearOwner = searchClearOwner;\n__mflSearchRenderNowOwner = searchRenderNowOwner;\n__mflSearchRenderOwner = searchRenderOwner;`;

  const sharedCore = insertBeforeRequiredMarker(
    extracted.core,
    "function navigateFromSearch(callback) {",
    SEARCH_FACADE,
    "Global Search lazy action facade",
  );

  return finalizeSplitArtifacts(
    sharedCore,
    routeChunks,
    "search",
    search,
    "Global Search",
  );
}
