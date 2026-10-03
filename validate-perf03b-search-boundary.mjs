// PERF-03B: guard the lexical and first-use Global Search boundary.
// Read-only analysis; does not split runtime code or introduce network requests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";
import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const root = fileURLToPath(new URL("./", import.meta.url));
const sourceRoot = resolve(root, "modules/core-sources");
const shared = coreSourceByDomain.shared;
assert.ok(shared?.sources.includes("shared-global-search.js"),
  "PERF-03B: canonical Global Search is no longer in Shared; revisit this audit");

const load = async (name) => readFile(resolve(sourceRoot, name), "utf8");
const fragment = await load("shared-global-search.js");
const parse = (name, source) => {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(file.parseDiagnostics?.length || 0, 0, `Invalid source ${name}`);
  return file;
};
const fragmentAst = parse("shared-global-search.js", fragment);
const declarations = fragmentAst.statements
  .filter((node) => ts.isFunctionDeclaration(node) && node.name)
  .map((node) => node.name.text);
const declared = new Set(declarations);
const expected = [
  "openSearch", "closeSearch", "playerSearchResult", "clubSearchResult",
  "searchMatchScore", "bestSearchResults", "agentSearchResultByWallet",
  "recentSearchRows", "rememberSearchResult", "rememberAgentSearchResult",
  "navigateFromSearch", "syncPlayerSearchClearButton", "clearPlayerSearch",
  "renderSearchResultsNow", "renderSearchResults",
];
assert.deepEqual(declarations, expected, "Global Search ownership changed; re-audit callable boundary");

function referencedSymbols(name, source) {
  const matches = new Map();
  const file = parse(name, source);
  function visit(node) {
    if (ts.isIdentifier(node) && declared.has(node.text)) {
      // Do not count a field called `closeSearch` as a direct lexical read.
      if (!(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
        matches.set(node.text, (matches.get(node.text) || 0) + 1);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return Object.fromEntries([...matches].sort(([a], [b]) => a.localeCompare(b)));
}

const dependencies = {};
for (const name of shared.sources) {
  if (name === "shared-global-search.js") continue;
  const references = referencedSymbols(name, await load(name));
  if (Object.keys(references).length) dependencies[name] = references;
}
const runtimeSource = await readFile(resolve(root, "global-search-runtime.js"), "utf8");
const runtimeReferences = referencedSymbols("global-search-runtime.js", runtimeSource);

// First-use Global Search handlers are bound immediately on *every* route.
// A split cannot remove these names until delegates are installed before binding.
const bindings = await load("shared-interaction-bindings.js");
const criticalHandlers = [
  ['openSearchButton.addEventListener("click", openSearch)', "openSearch"],
  ['closeSearchButton.addEventListener("click", closeSearch)', "closeSearch"],
  ['playerSearchClearButton.addEventListener("click", clearPlayerSearch)', "clearPlayerSearch"],
  ['playerSearchInput.addEventListener("input", renderSearchResults)', "renderSearchResults"],
  ['setupBackdropClickClose(searchModal, closeSearch)', "closeSearch"],
  ["openSearch();", "openSearch"],
];
for (const [text, name] of criticalHandlers) {
  assert.ok(bindings.includes(text), `PERF-03B first-use contract missing: ${name} (${text})`);
  assert.ok(dependencies["shared-interaction-bindings.js"]?.[name],
    `PERF-03B lexical call/binding missing: ${name}`);
}
assert.ok(dependencies["shared-personal-state.js"]?.renderSearchResultsNow,
  "Recent search history refresh references Global Search from Shared state");
assert.ok(dependencies["shared-core-contracts.js"]?.searchMatchScore,
  "Global Search matching is patched through the Shared lexical binding");
assert.ok(dependencies["shared-core-contracts.js"]?.renderSearchResultsNow,
  "Global Search render remains available through cross-domain core contracts");
assert.ok(runtimeSource.includes("installCoreSearchMatching();"),
  "First-use search runtime must install name matching before search");
assert.ok(runtimeSource.includes('windowFunction("closeSearch")'),
  "First-use search runtime expects the legacy window function contract");
assert.ok(runtimeSource.includes("observeSearchModal();"),
  "First-use search runtime must initialize search-modal observer");

// Source bytes are an upper bound on possible initial payload savings, not
// a transfer/compile win or authorization to perform a runtime split.
const result = {
  scope: "PERF-03B1: read-only lexical/first-use ownership audit",
  candidate: "modules/core-sources/shared-global-search.js",
  sourceBytes: Buffer.byteLength(fragment.replace(/\r\n?/g, "\n").replace(/\s*$/, ""), "utf8"),
  declaredFunctions: declarations,
  sharedExternalReferences: dependencies,
  searchRuntimeLexicalReferences: runtimeReferences,
  startupBindingCount: criticalHandlers.length,
  decision: "Require first-use contract preserving split and same-runner browser A/B before any product change",
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
