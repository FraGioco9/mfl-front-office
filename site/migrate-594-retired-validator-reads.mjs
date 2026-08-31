import { readdir, readFile, writeFile } from "node:fs/promises";

const canonicalCoreRead = `Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\\n"))`;
const canonicalDirectCoreRead = `Promise.all([
    readFile(new URL("./modules/core-sources/shared.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/evaluation.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/mfl-stats.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/club.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/settings.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/player.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/table.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/wallet.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/watchlist.js", import.meta.url), "utf8"),
  ]).then((parts) => parts.join("\\n"))`;
const canonicalResolvedCoreRead = `Promise.all([
    read(resolve(siteRoot, "modules/core-sources/shared.js")),
    read(resolve(siteRoot, "modules/core-sources/evaluation.js")),
    read(resolve(siteRoot, "modules/core-sources/mfl-stats.js")),
    read(resolve(siteRoot, "modules/core-sources/club.js")),
    read(resolve(siteRoot, "modules/core-sources/settings.js")),
    read(resolve(siteRoot, "modules/core-sources/player.js")),
    read(resolve(siteRoot, "modules/core-sources/table.js")),
    read(resolve(siteRoot, "modules/core-sources/wallet.js")),
    read(resolve(siteRoot, "modules/core-sources/watchlist.js")),
  ]).then((parts) => parts.join("\\n"))`;
const canonicalJoinedCoreRead = `Promise.all([
    readFile(join(siteRoot, "modules/core-sources/shared.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/evaluation.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/mfl-stats.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/club.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/settings.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/player.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/table.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/wallet.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/watchlist.js"), "utf8"),
  ]).then((parts) => parts.join("\\n"))`;
const canonicalSyncCoreRead = `[
  "modules/core-sources/shared.js",
  "modules/core-sources/evaluation.js",
  "modules/core-sources/mfl-stats.js",
  "modules/core-sources/club.js",
  "modules/core-sources/settings.js",
  "modules/core-sources/player.js",
  "modules/core-sources/table.js",
  "modules/core-sources/wallet.js",
  "modules/core-sources/watchlist.js",
].map((path) => fs.readFileSync(path, "utf8")).join("\\n")`;
const canonicalRepositoryCoreRead = `[
  "site/modules/core-sources/shared.js",
  "site/modules/core-sources/evaluation.js",
  "site/modules/core-sources/mfl-stats.js",
  "site/modules/core-sources/club.js",
  "site/modules/core-sources/settings.js",
  "site/modules/core-sources/player.js",
  "site/modules/core-sources/table.js",
  "site/modules/core-sources/wallet.js",
  "site/modules/core-sources/watchlist.js",
].map(read).join("\\n")`;

const names = (await readdir(new URL("./", import.meta.url)))
  .filter((name) => /^validate.*\.mjs$/.test(name));

let changed = 0;
for (const name of names) {
  const url = new URL(`./${name}`, import.meta.url);
  let source = await readFile(url, "utf8");
  const original = source;
  source = source.replaceAll('read("./modules/app-core.js")', canonicalCoreRead);
  source = source.replaceAll("read('./modules/app-core.js')", canonicalCoreRead);
  source = source.replaceAll('read("modules/app-core.js")', canonicalCoreRead);
  source = source.replaceAll("read('modules/app-core.js')", canonicalCoreRead);
  source = source.replaceAll('read("site/modules/app-core.js")', canonicalRepositoryCoreRead);
  source = source.replaceAll("read('site/modules/app-core.js')", canonicalRepositoryCoreRead);
  source = source.replaceAll(
    'readFile(new URL("./modules/app-core.js", import.meta.url), "utf8")',
    canonicalDirectCoreRead,
  );
  source = source.replaceAll(
    "readFile(new URL('./modules/app-core.js', import.meta.url), 'utf8')",
    canonicalDirectCoreRead,
  );
  source = source.replaceAll('read(resolve(siteRoot, "modules/app-core.js"))', canonicalResolvedCoreRead);
  source = source.replaceAll("read(resolve(siteRoot, 'modules/app-core.js'))", canonicalResolvedCoreRead);
  source = source.replaceAll(
    'readFile(join(siteRoot, "modules/app-core.js"), "utf8")',
    canonicalJoinedCoreRead,
  );
  source = source.replaceAll(
    "readFile(join(siteRoot, 'modules/app-core.js'), 'utf8')",
    canonicalJoinedCoreRead,
  );
  source = source.replaceAll('fs.readFileSync("modules/app-core.js", "utf8")', canonicalSyncCoreRead);
  source = source.replaceAll("fs.readFileSync('modules/app-core.js', 'utf8')", canonicalSyncCoreRead);
  source = source.replaceAll(
    'import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";',
    'import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";',
  );
  source = source.replaceAll("normalizeBuiltApplicationCoreArtifacts(", "readCanonicalCoreArtifacts(");
  source = source.replaceAll(
    'core.includes("navigateFromSearch(() => openAgentPage(result.walletAddress));")',
    'core.includes("navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));")',
  );
  source = source.replaceAll(
    '"if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {"',
    '"if (incrementalRouteIsCached(route, 1)) return loadAndRender();"',
  );
  source = source.replaceAll(
    `'await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);'`,
    `'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);'`,
  );
  source = source.replaceAll(
    `'function updateFilterSummary(count = activeFilterCount()) {\\n  filterSummary.textContent = String(count);\\n}'`,
    `'function updateFilterSummary(count = activeFilterCount()) {\\n  const numericCount = Number(count);\\n  const normalizedCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;\\n  const active = normalizedCount >= 1;\\n  filterSummary.textContent = String(normalizedCount);'`,
  );
  source = source.replaceAll(
    `'state.filterDraftRules = null;\\n  document.body.classList.remove("filtersOpen");\\n  hideModal(filtersModal, () => {\\n    openFiltersButton.focus();'`,
    `'state.filterDraftRules = null;\\n  document.body.classList.remove("filtersOpen");\\n  hideModal(filtersModal, () => {\\n    if (restoreTriggerFocus) openFiltersButton.focus();'`,
  );
  source = source.replaceAll(
    '"const pageName = state.currentPage;\\n    if (!tablePages.has(pageName)) {"',
    '"const pageName = state.currentPage;\\n    if (!tablePages.has(pageName) && pageName !== \\\"club\\\") {"',
  );
  source = source.replaceAll(
    '"await loadExternalRouteCore(path);"',
    '"await resources().load(path, { versioned: true });"',
  );
  source = source.replaceAll(
    'const optOutEnd = optOutStart >= 0 ? coreSource.indexOf("function walletAddressCandidatesFromValue", optOutStart) : -1;',
    'const optOutEnd = optOutStart >= 0 ? coreSource.indexOf("\\nfunction ", optOutStart + "function optOutWallet".length) : -1;',
  );
  source = source.replaceAll(
    '["runViewTransition(CLUB_PAGE, nextView", "setClubSwitching(true);", "Club view"],',
    '["void runViewTransition(pageName, viewName, {", "await setView(viewName);", "Club view"],',
  );
  source = source.replaceAll(
    '["runPageTransition(CLUB_PAGE, updateHistory", "setClubSwitching(true);", "Club page"],',
    '["const transition = await runPageTransition(CLUB_PAGE, updateHistory, {", "await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {", "Club page"],',
  );
  source = source.replaceAll(
    `'function renderTable() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;'`,
    `'function tableRenderTableOwner() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;'`,
  );
  if (source !== original) {
    await writeFile(url, source, "utf8");
    changed += 1;
  }
}

console.log(`Migrated ${changed} validator files to canonical application-core sources.`);
