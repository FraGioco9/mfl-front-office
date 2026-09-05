import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const readSite = (path) => readFile(resolve(siteRoot, path), "utf8");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
function includes(source, value, message) {
  invariant(source.includes(value), message);
}
function excludes(source, value, message) {
  invariant(!source.includes(value), message);
}
function matches(source, pattern, message) {
  invariant(pattern.test(source), message);
}
async function readOptionalSite(path) {
  try {
    return await readSite(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
async function mustNotExist(path, message) {
  try {
    await access(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

const release = JSON.parse(await readSite("release.json"));
invariant(/^\d+\.\d+\.\d+$/.test(release.version), "release.json must contain a Semantic Version.");
invariant(String(release.description || "").trim().length > 20, "release.json must contain a useful description.");

const packageManifest = JSON.parse(await readSite("package.json"));
invariant(String(packageManifest.dependencies?.["@onflow/fcl"] || "").trim(), "package.json must keep @onflow/fcl.");
invariant(packageManifest.scripts?.["build:core"] === "node build-app-core.mjs", "package.json must expose the canonical core build command.");
includes(String(packageManifest.scripts?.check || ""), "npm run build", "The full site check must run the canonical site build before generated verification and validation.");

const dataAuth = await readSite("api/_data-auth.js");
const walletProof = await readSite("api/_wallet-proof.js");
matches(walletProof, /require\(["']@onflow\/fcl["']\)/, "The canonical wallet-proof owner must verify Dapper proofs with @onflow/fcl.");
includes(dataAuth, 'require("./_wallet-proof")', "The data API must delegate Dapper proof verification to the canonical wallet-proof owner.");

const bootstrap = await readSite("bootstrap.js");
const bootstrapCore = await readSite("bootstrap-core.js");
const staticVersion = bootstrap.match(/const\s+STATIC_RELEASE_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1];
const bootstrapCoreFallbackVersion = bootstrapCore.match(/window\.__mflReleaseVersion\s*\|\|\s*["'](\d+\.\d+\.\d+)["']/)?.[1];
invariant(staticVersion === release.version, `bootstrap.js release ${staticVersion || "<missing>"} must match ${release.version}.`);
invariant(bootstrapCoreFallbackVersion === release.version, `bootstrap-core.js fallback ${bootstrapCoreFallbackVersion || "<missing>"} must match ${release.version}.`);
includes(bootstrap, "window.__mflReleaseVersion = STATIC_RELEASE_VERSION", "bootstrap.js must own the release version synchronously.");
excludes(bootstrap, "loadRuntime(\"/table-width-runtime.js\")", "bootstrap.js must not pretend to own the static Uniform Width marker.");
includes(bootstrap, "loadRuntime(\"/dropdowns-runtime.js\")", "bootstrap.js must load dropdown ownership before app startup.");
excludes(bootstrap, "loadRuntime(\"/filter-controls-runtime.js\")", "bootstrap.js must not pretend to own route-scoped filter behavior.");
includes(bootstrap, "loadRuntime(\"/bootstrap-core.js\")", "bootstrap.js must load bootstrap-core before app startup.");
excludes(bootstrap, "club-squad-route-runtime", "bootstrap.js must not restore Club pre-render repair owners.");
includes(bootstrap, "function primeStaticButtonGroup", "bootstrap.js must own deterministic first-paint control rendering.");
excludes(bootstrap, "preloadAsset", "bootstrap.js must not create app-entry preload hints after document parsing.");
excludes(bootstrap, "data-mfl-bootstrap-preload", "bootstrap.js must not retain dynamic preload bookkeeping.");

includes(bootstrapCore, "function createInteractionBusyController()", "bootstrap-core must own the canonical route/data loading controller.");
excludes(bootstrapCore, "function bindInteractionBlockers()", "The retired whole-site busy blocker must not restore interaction listeners.");
excludes(bootstrapCore, "function unbindInteractionBlockers()", "The retired whole-site busy blocker must not restore idle listener cleanup.");
includes(bootstrapCore, "import(new URL(\"/modules/app-entry.js\"", "bootstrap-core must import the modular application entrypoint.");
excludes(bootstrapCore, "fetch(\"/release.json\"", "bootstrap-core must not block startup on release.json.");
excludes(bootstrapCore, "normalizeSingleRenderCore", "bootstrap-core must not rewrite the application core in the browser.");
excludes(bootstrapCore, "installSingleRenderCoreTransform", "bootstrap-core must not install legacy fetch interception.");

const buildCore = await readSite("build-app-core.mjs");
includes(buildCore, 'from "./modules/core-source-manifest.js"', "The core build must consume the canonical source manifest.");
includes(buildCore, "for (const entry of coreSourceManifest)", "The core build must generate canonical split source modules from the manifest.");
excludes(buildCore, "normalizeBuiltApplicationCoreArtifacts", "The core build must not behavior-patch application source after authoring.");
excludes(buildCore, "modules/app-core.js", "The core build must not depend on the legacy application-core monolith.");
const sharedCoreManifest = coreSourceByDomain.shared;
invariant(
  sharedCoreManifest?.source === "shared.js"
    && sharedCoreManifest?.runtime === "app-core-runtime.js",
  "Canonical manifest must map the shared core source to app-core-runtime.js.",
);
invariant(String(sharedCoreManifest?.banner || "").includes("Do not edit directly"), "Generated core artifacts must carry manifest-owned ownership banners.");

const canonicalSharedCore = (await readSite("modules/core-sources/shared.js")).replace(/\s*$/, "");
const coreSource = [
  canonicalSharedCore,
  await readSite("modules/core-sources/evaluation.js"),
  await readSite("modules/core-sources/mfl-stats.js"),
  await readSite("modules/core-sources/club.js"),
  await readSite("modules/core-sources/settings.js"),
  await readSite("modules/core-sources/player.js"),
  await readSite("modules/core-sources/table.js"),
  await readSite("modules/core-sources/wallet.js"),
  await readSite("modules/core-sources/watchlist.js"),
].join("\n");
invariant(canonicalSharedCore.length > 300_000, "Canonical shared core source is unexpectedly small.");
includes(canonicalSharedCore, "const shellFirstTablePages = new Set();", "The shared core must keep destination shell-first rendering disabled.");
includes(canonicalSharedCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName)', "The shared core must delegate Club view URLs to canonical route configuration.");
excludes(canonicalSharedCore, 'viewName === "attributes" ? "squad" : viewSlug(viewName)', "The shared core must not duplicate the Club view-to-slug mapping.");
excludes(canonicalSharedCore, "      renderIncrementalLoadingState(pageName, route);", "The shared core must not render a destination loading phase before canonical data.");
includes(canonicalSharedCore, "function copyDelegatedPlayerId(button, event)", "The shared core must own player-ID copying through table delegation.");
includes(canonicalSharedCore, 'tableBody?.addEventListener("click", (event) => {', "The shared core must have one delegated player-table click owner.");
includes(canonicalSharedCore, 'tableBody?.addEventListener("pointermove", (event) => {', "The shared core must delegate table hover state.");
includes(canonicalSharedCore, 'selectionInput.dataset.playerId = String(playerId);', "Rendered selection controls must carry player identity instead of row closures.");
includes(canonicalSharedCore, 'nameLink.dataset.playerId = String(playerId);', "Rendered player links must carry player identity instead of row closures.");
includes(canonicalSharedCore, 'link.dataset.walletAddress = String(walletAddress || "");', "Rendered agent links must carry wallet identity instead of row closures.");
includes(canonicalSharedCore, "clubLink.dataset.clubId = clubId;", "Rendered Club links must carry Club identity instead of row closures.");
excludes(canonicalSharedCore, 'selectionInput.addEventListener("click", (event) => setPlayerSelected', "Rows must not allocate selection click closures.");
excludes(canonicalSharedCore, 'nameLink.addEventListener("click", (event) => {', "Rows must not allocate player navigation closures.");
excludes(canonicalSharedCore, 'noteIcon.addEventListener("mouseenter"', "Rows must not allocate note tooltip closures.");
excludes(canonicalSharedCore, 'markerElement.addEventListener("mouseenter"', "Rows must not allocate marker tooltip closures.");
excludes(canonicalSharedCore, 'link.addEventListener("mouseenter", () => showPlayerNoteTooltip(link));', "Rows must not allocate agent tooltip closures.");
excludes(canonicalSharedCore, 'clubLink.addEventListener("click", (event) => {', "Rows must not allocate Club navigation closures.");

const generatedCore = await readOptionalSite("modules/app-core-runtime.js");
if (generatedCore !== null) {
  const banner = String(sharedCoreManifest?.banner || "");
  invariant(banner && generatedCore.startsWith(banner), "Generated app-core-runtime.js must identify its manifest-owned canonical source.");
  invariant(generatedCore.slice(banner.length).replace(/\s*$/, "") === canonicalSharedCore, "Generated shared core must exactly reproduce its canonical source.");
  includes(generatedCore, 'icon: "calendar-x-2"', "Generated app-core-runtime.js must use the canonical retirement icon.");
}

const entry = await readSite("modules/app-entry.js");
const appConfig = await readSite("modules/app-config.js");
const routeCoreLoader = await readSite("route-core-loader-runtime.js");
includes(entry, "const PREBUILT_CORE_PATH = \"/modules/app-core-runtime.js\"", "app-entry.js must use the build-time application core.");
includes(entry, "const PREBUILT_CORE_CACHE_QUERY = \"mfl_core\"", "The prebuilt core must use its dedicated cache-key query parameter.");
includes(entry, 'const immutableRevision = `${entryRelease.version}-${buildId}`;', "The prebuilt core cache key must combine release and generated content identity.");
includes(bootstrap, 'url.searchParams.set("mfl_core", `${version}-${buildId}`);', "Route-core cache keys must combine release and generated content identity.");
includes(entry, "preloadClassicScript(prebuiltApplicationCorePath());", "The versioned prebuilt core must start downloading while critical runtimes load.");
includes(entry, "await loadClassicScript(prebuiltApplicationCorePath());", "The production core must execute as an external classic script.");
excludes(entry, "SOURCE_CORE_PATH", "app-entry.js must not restore a raw source-core fallback.");
excludes(entry, "__mflLoadFallbackApplicationCoreArtifacts", "app-entry.js must not restore browser-side core normalization fallback.");
excludes(routeCoreLoader, "/modules/app-core.js", "Route-core loading must not fetch the raw application core.");
excludes(routeCoreLoader, "app-core-build-normalizer.js", "Route-core loading must not import build-time normalizers in the browser.");
excludes(routeCoreLoader, "normalizeBuiltApplicationCoreArtifacts", "Route-core loading must remain prebuilt-only.");
excludes(entry, "initialPreCoreRuntimeScripts.forEach(preloadClassicScript)", "Initial runtime scripts must load directly instead of receiving same-tick preload links.");
excludes(entry, "CORE_RUNTIME_CACHE_KEY", "The prebuilt core must not be copied into sessionStorage.");
excludes(entry, "cachedApplicationCore", "The prebuilt core must rely on browser HTTP caching instead of a duplicate string cache.");
excludes(entry, "cacheApplicationCore", "The prebuilt core must not write a second full source copy to sessionStorage.");
excludes(entry, "fetchApplicationCoreSource(PREBUILT_CORE_PATH)", "The production prebuilt core must not be fetched as text.");
includes(appConfig, "\"/filter-controls-runtime.js\"", "Canonical app config must own route-scoped filter behavior.");
includes(appConfig, "\"/table-loading-runtime.js\"", "Canonical app config must own the table-loading dependency.");
includes(entry, "routeDependencyPlan(initialRouteRuntime.pageName, initialRouteRuntime.options).preCore", "app-entry.js must consume the canonical initial-route dependency plan.");
excludes(entry, "\"/table-width-runtime.js\"", "Uniform Width must stay static-only and must not be dynamically loaded again by app-entry.js.");
for (const retiredRuntime of [
  "table-view-runtime.js",
  "evaluation-discount-rate-display-runtime.js",
  "database-stats-tooltip-portal-runtime.js",
  "database-stats-reload-bootstrap-runtime.js",
  "database-stats-custom-filter-runtime.js",
  "watchlist-ui-runtime.js",
]) {
  excludes(entry, retiredRuntime, `${retiredRuntime} must stay retired from the browser runtime graph.`);
}
excludes(entry, "view-button-visibility-runtime", "app-entry.js must not restore deprecated view repair owners.");
excludes(entry, "club-squad-route-runtime", "app-entry.js must not restore deprecated Club route repair owners.");
excludes(entry, "deferredRuntimePromise", "app-entry.js must not retain legacy deferred runtime bookkeeping.");
excludes(entry, "evaluationSearchRuntimePromise", "app-entry.js must not retain legacy Evaluation runtime bookkeeping.");

const tableLoading = await readSite("table-loading-runtime.js");
includes(coreSource, "function ensureCanonicalTableHeader", "Canonical app-core must own table-header reconciliation directly.");
includes(coreSource, "if (needsCanonicalBuild) buildHeader();", "Canonical app-core must invoke the canonical header when table state changes.");
includes(tableLoading, "function hasRealRows", "Loading placeholders must never overwrite real table rows.");
excludes(tableLoading, "VIEW_COLUMNS", "Table loading must not own the table schema.");

const tableWidth = await readSite("table-width-runtime.js");
includes(tableWidth, "window.__mflUniformWidth", "Table widths must remain globally single-owned.");
matches(tableWidth, /window\.__mflCoreBuildId = "[a-f0-9]{16}";/, "Pre-bootstrap config must expose the generated application-core build identity.");
excludes(tableWidth, "MutationObserver", "The table width owner must not globally observe DOM mutations.");

const sharedTableUi = await readSite("shared-table-ui-runtime.js");
excludes(sharedTableUi, "MutationObserver", "Shared table UI must not observe and repair rendered tables.");
excludes(sharedTableUi, "replaceChildren", "Shared table UI must not recreate table content.");

const desktopTableStyle = await readSite("desktop-table-style-runtime.js");
excludes(desktopTableStyle, "MutationObserver", "Desktop table styling must not repair rendered content after app-core.");
includes(desktopTableStyle, "agentWalletCopy", "Agent wallet-copy interaction must remain delegated to the canonical title element.");

const selectionStartup = await readSite("selection-startup-reset-runtime.js");
includes(selectionStartup, "restoreSavedTableState.__mflStartupSelectionReset", "Startup selection reset must sanitize restored selection state before canonical table rendering.");
excludes(selectionStartup, "MutationObserver", "Startup selection reset must not watch the rendered table.");

const evaluationLayout = await readSite("evaluation-layout-runtime.js");
excludes(evaluationLayout, "MutationObserver", "Evaluation layout must not repair rendered content.");
excludes(evaluationLayout, "replaceChildren", "Evaluation layout must not become a second renderer.");

const evaluationDiscountRate = await readSite("evaluation-discount-rate-runtime.js");
includes(evaluationDiscountRate, "mfl:season-ratios-ready", "Evaluation discount-rate data must publish one explicit ready event.");
excludes(evaluationDiscountRate, "setInterval", "Evaluation discount-rate ownership must be event-driven.");

const evaluationSearchState = await readSite("evaluation-search-state-runtime.js");
includes(coreSource, "recentEvaluationRows.__mflSupabaseOnly", "Canonical app-core must keep Evaluation recents Supabase-backed.");
includes(evaluationSearchState, "coreContracts()?.evaluationRecentPlayerIds?.()", "Evaluation search state must consume the canonical recent-entry contract.");
excludes(evaluationSearchState, "MutationObserver", "Evaluation recents must not watch and rebuild rendered results.");

const globalSearch = await readSite("global-search-runtime.js");
includes(globalSearch, "installCoreSearchMatching", "Global Search runtime must remain the authoritative search-data bridge.");
includes(coreSource, "__mflSurnameFirst", "Canonical app-core must preserve surname-first player matching.");
excludes(globalSearch, "resultsObserver", "Global Search must not repair rendered result nodes.");

const filterControls = await readSite("filter-controls-runtime.js");
includes(filterControls, "buildOperatorSelect.__mflContractOperators", "Filter behavior must be installed at canonical control construction time.");
excludes(filterControls, "subtree: true", "Filter controls must not broadly observe rendered controls.");

const nationalityFilterOptions = await readSite("nationality-filter-options-runtime.js");
includes(nationalityFilterOptions, "uniqueNationalityValues.__mflAuthoritativeFilterOptions", "Nationality options must feed app-core's canonical filter builder.");
excludes(nationalityFilterOptions, "filterRulesObserver", "Nationality options must not rebuild rendered selects behind app-core.");

const changelogHistory = await readSite("changelog-history-runtime.js");
includes(changelogHistory, "function buildList", "Changelog history must have one explicit list renderer.");
excludes(changelogHistory, "MutationObserver", "Changelog history must not continuously repair rendered content.");

const databaseStats = await readSite("database-stats-runtime.js");
includes(databaseStats, "bindPermanentControls", "Database Stats must bind the permanent HTML shell instead of recreating it.");
includes(databaseStats, "function positionCustomPanel()", "Database Stats must own its Custom filter in the same domain runtime.");
excludes(databaseStats, 'document.createElement("style")', "Database Stats must not create runtime CSS.");
excludes(databaseStats, "function createPage", "Database Stats must not recreate its static page.");

const indexHtml = await readSite("index.html");
matches(indexHtml, /<meta[^>]+name=["']viewport["'][^>]+viewport-fit=cover/i, "Mobile first paint must enable safe-area viewport fitting.");
includes(indexHtml, "data-mfl-responsive-layout=\"true\"", "responsive.css must be render-blocking.");
includes(indexHtml, "<colgroup id=\"tableColGroup\"></colgroup>", "Shared player table shell must stay permanent in index.html.");
includes(indexHtml, "id=\"evaluationDiscountRate\"", "Evaluation must keep a permanent discount-rate placeholder.");
const appEntryModulePreload = '<link rel="modulepreload" href="/modules/app-entry.js">';
const appEntryPreloadIndex = indexHtml.indexOf(appEntryModulePreload);
const headEndIndex = indexHtml.indexOf("</head>");
invariant(appEntryPreloadIndex >= 0 && headEndIndex > appEntryPreloadIndex, "app-entry.js must be parser-discovered through one static modulepreload in the document head.");
invariant(indexHtml.indexOf(appEntryModulePreload, appEntryPreloadIndex + 1) === -1, "app-entry.js must have only one modulepreload owner.");
const staticWidthScript = '<script src="/table-width-runtime.js"></script>';
invariant(indexHtml.split(staticWidthScript).length - 1 === 1, "Uniform Width/config runtime must load exactly once from its unversioned no-store URL.");
invariant(!indexHtml.includes("mfl_config="), "Table schema must not use a cache revision query.");
const staticWidthIndex = indexHtml.indexOf(staticWidthScript);
const bootstrapIndex = indexHtml.indexOf('<script src="/bootstrap.js"></script>');
invariant(staticWidthIndex >= 0 && bootstrapIndex > staticWidthIndex, "Uniform Width must load from static HTML before bootstrap.");

const vercelLocal = JSON.parse(await readSite("vercel.json"));
const vercelProduction = JSON.parse(await readSite("vercel.production.json"));
const localConfigSource = JSON.stringify(vercelLocal);
invariant(!localConfigSource.includes('"has"') && !localConfigSource.includes('"missing"'), "Local Vercel config must not contain unsupported has/missing request conditions.");
const localJsRule = (vercelLocal.headers || []).find((rule) => rule.source === "/(.*\\.js)");
invariant(localJsRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Local JavaScript must use the no-store cache policy.");
const productionJsNoStoreRule = (vercelProduction.headers || []).find((rule) => rule.source === "/(.*\\.js)" && rule.missing?.some((condition) => condition.type === "query" && condition.key === "mfl_core"));
invariant(productionJsNoStoreRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Production unversioned JavaScript must retain the no-store cache policy.");
const productionCoreCacheRule = (vercelProduction.headers || []).find((rule) => rule.source === "/modules/app-core-runtime.js" && rule.has?.some((condition) => condition.type === "query" && condition.key === "mfl_core"));
invariant(productionCoreCacheRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=31536000, immutable"), "Production versioned application core must retain immutable browser caching.");
await mustNotExist(resolve(siteRoot, "vercel.mjs"), "Programmatic Vercel config must stay removed so local development uses the static safe config.");

const databaseRefresh = await readRepository(".github/workflows/full-database-refresh.yml");
includes(databaseRefresh, "--workflow vercel-site-update.yml", "Database refreshes must resolve the last explicit site release.");
excludes(databaseRefresh, "--workflow site-quality.yml", "Database refreshes must not publish the latest quality-check commit.");

const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
includes(siteDeploy, "node site/build-app-core.mjs", "Vercel deployment must generate the canonical application core before upload.");
includes(siteDeploy, "test -s site/modules/app-core-runtime.js", "Vercel deployment must refuse to upload without the generated core.");
includes(siteDeploy, "vercel deploy --prod --yes --force", "Site deployment must force the explicit production release.");
includes(siteDeploy, "--local-config site/vercel.production.json", "Production deployment must use the dedicated production Vercel config.");

const siteQuality = await readRepository(".github/workflows/site-quality.yml");
includes(siteQuality, "npm run build", "Site quality must execute the canonical site build used by deployment asset generation.");
includes(siteQuality, "npm run validate", "Site quality must validate the generated architecture after building it.");

const databaseRuntime = await readSite("api/_database.js");
includes(databaseRuntime, "runtime_metadata", "SQLite runtime must read runtime_metadata.");

for (const path of [
  "core-response-cache-runtime.js",
  "mfl-stats-runtime.js",
  "table-blank-row-guard-runtime.js",
  "table-view-runtime.js",
  "player-loading-runtime.js",
  "club-squad-route-runtime.js",
  "desktop-table-observer-guard-runtime.js",
  "desktop-table-width.css",
  "evaluation-discount-rate-display-runtime.js",
  "evaluation-discount-rate-guard-runtime.js",
  "filter-contract-operator-runtime.js",
  "release-ui-runtime.js",
  "selection-refresh-reset-runtime.js",
  "view-button-visibility-runtime.js",
  "watchlist-ui-runtime.js",
  "watchlist-route-ui-runtime.js",
  "database-stats-tooltip-portal-runtime.js",
  "database-stats-reload-bootstrap-runtime.js",
  "database-stats-custom-filter-runtime.js",
]) {
  await mustNotExist(resolve(siteRoot, path), `${path} is deprecated and must stay removed.`);
}

console.log(`Repository validation passed for MFL Front Office v${release.version}.`);
