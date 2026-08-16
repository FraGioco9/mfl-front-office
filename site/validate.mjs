import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const readSite = (path) => readFile(resolve(siteRoot, path), "utf8");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
function matches(source, pattern, message) {
  invariant(pattern.test(source), message);
}
function excludes(source, pattern, message) {
  invariant(!pattern.test(source), message);
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
const dataAuth = await readSite("api/_data-auth.js");
matches(dataAuth, /require\(["']@onflow\/fcl["']\)/, "The data API must verify Dapper proofs with @onflow/fcl.");

const bootstrap = await readSite("bootstrap.js");
const bootstrapCore = await readSite("bootstrap-core.js");
const staticVersion = bootstrap.match(/const\s+STATIC_RELEASE_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1];
invariant(staticVersion === release.version, `bootstrap.js release ${staticVersion || "<missing>"} must match ${release.version}.`);
matches(bootstrap, /window\.__mflReleaseVersion\s*=\s*STATIC_RELEASE_VERSION/, "bootstrap.js must own the release version.");
matches(bootstrap, /loadRuntime\(["']\/table-width-runtime\.js["']\)/, "bootstrap.js must load the canonical table width owner before app startup.");
matches(bootstrap, /loadRuntime\(["']\/filter-controls-runtime\.js["']\)/, "bootstrap.js must load the filter-controls owner.");
excludes(bootstrap, /player-loading-runtime|syncBootstrapFirstPaint|syncViewButtonsFirstPaint|syncQuickFilterFirstPaint|ensureContractsFirstPaintColumnOrder|normalizeBootstrapCoreWidthOwnership/, "bootstrap.js must not render or repair page content before canonical owners load.");

matches(bootstrapCore, /function\s+applyRouteShell/, "bootstrap-core must resolve only the route shell before app startup.");
matches(bootstrapCore, /function\s+createInteractionBusyController/, "bootstrap-core must own global startup interaction blocking.");
excludes(bootstrapCore, /STATIC_TABLE_|primeStatic|applyStaticSharedTableWidths|replaceChildren\(|renderEvaluation|primeEvaluation|primeMflStats|filterRules|advancedPlayerTable/, "bootstrap-core must never build page or data-container content.");

const entry = await readSite("modules/app-entry.js");
matches(entry, /const\s+path\s*=\s*["']\/modules\/app-core\.js["'];[\s\S]*nativeFetch\(assetUrl\(path\)/, "app-entry.js must execute the canonical application core directly.");
matches(entry, /["']\/table-loading-runtime\.js["']/, "app-entry.js must load the canonical table-loading owner.");
excludes(entry, /view-button-visibility-runtime|watchlist-route-ui-runtime/, "app-entry.js must not restore renamed runtime owners.");
excludes(entry, /\?(?:v|dev|rev)=|searchParams\.set\(["'](?:v|dev|rev)["']/, "app-entry.js must keep runtime asset URLs queryless.");

const tableLoading = await readSite("table-loading-runtime.js");
matches(tableLoading, /buildHeader\.__mflSingleRenderOwner/, "Table loading must make app-core buildHeader the single persistent header owner.");
matches(tableLoading, /renderTableLoadingShell\.__mflSingleRenderOwner/, "Table loading must render the canonical header before data fetch.");
matches(tableLoading, /function\s+ensureCanonicalHeader/, "Table loading must ask app-core's header owner to build the initial header.");
matches(tableLoading, /function\s+hasRealRows/, "Loading placeholders must never overwrite real table rows.");
excludes(tableLoading, /VIEW_COLUMNS|COLUMN_META|primeHeader|active_contract_revenue_share|active_contract_club_name|syncSharedViewButtonPage/, "Table loading must not own table schema, column order, or view chrome.");

const tableWidth = await readSite("table-width-runtime.js");
matches(tableWidth, /canonical:\s*true/, "Table widths must remain globally single-owned.");

const sharedTableUi = await readSite("shared-table-ui-runtime.js");
excludes(sharedTableUi, /MFL_STATS_FILTERS|primeMflStats|syncViewButtons|applyCachedQuickFilters|MutationObserver|replaceChildren/, "Shared table UI must not render table or stats content.");

const tableView = await readSite("table-view-runtime.js");
excludes(tableView, /MutationObserver|primeDatabaseStatsFilters|activateSharedTableView|setPage\(|replaceChildren|primeHeader/, "Table view runtime must remain interaction-only.");

const tableNavigation = await readSite("table-navigation-chrome-runtime.js");
excludes(tableNavigation, /MutationObserver|replaceChildren|primeHeader|syncEntityViewButtons|revealTableDestination|history\./, "Table navigation chrome must not pre-render destination content.");

const staticUi = await readSite("static-ui-runtime.js");
excludes(staticUi, /MutationObserver|querySelector|replaceChildren|textContent\s*=|classList\./, "Static UI compatibility must never repair rendered DOM.");

const blankRowGuard = await readSite("table-blank-row-guard-runtime.js");
excludes(blankRowGuard, /MutationObserver|replaceChildren|querySelector/, "Blank-row compatibility must not compete with table-loading-runtime.");

const evaluationLayout = await readSite("evaluation-layout-runtime.js");
excludes(evaluationLayout, /MutationObserver|showEvaluationPage|syncLoadButton|syncDiscountRateFallback|storedMflPerUsd|main\s*>\s*\.pageView|replaceChildren/, "Evaluation layout must not pre-render or repair Evaluation content.");
matches(evaluationLayout, /focusWhenReady/, "Evaluation layout may own only post-readiness focus behavior.");

const watchlistUi = await readSite("watchlist-ui-runtime.js");
excludes(watchlistUi, /MutationObserver|history\.pushState|history\.replaceState|syncWatchlistTitle|syncWatchlistSwitcher|protectedRoute|currentWatchlistIdentity/, "Watchlist UI must not compete with app-core for route, title, or switcher state.");
matches(watchlistUi, /watchlistRenameTooltip/, "Watchlist UI must retain the unique rename tooltip interaction.");

const databaseStats = await readSite("database-stats-runtime.js");
matches(databaseStats, /bindPermanentControls/, "Database Stats must bind the permanent HTML shell instead of recreating it.");
excludes(databaseStats, /function\s+createPage|page\.innerHTML|databaseStatsOverallFilters[\s\S]*replaceChildren\(fragment\)/, "Database Stats must not recreate its static page or filter controls.");

const mflStats = await readSite("mfl-stats-runtime.js");
matches(mflStats, /__mflStatsRuntime\s*=\s*Object\.freeze/, "MFL Stats compatibility hooks must remain available to app-entry.");
excludes(mflStats, /fetch\(|MutationObserver|replaceChildren|innerHTML|renderMflStats|ensureStaticFilters|showStatsShell/, "MFL Stats runtime must not compete with app-core's single MFL Stats renderer.");

const globalSearch = await readSite("global-search-runtime.js");
matches(globalSearch, /installCoreSearchMatching/, "Global Search runtime must remain the authoritative search-data bridge.");

const indexHtml = await readSite("index.html");
matches(indexHtml, /<meta[^>]+name=["']viewport["'][^>]+viewport-fit=cover/i, "Mobile first paint must enable safe-area viewport fitting.");
matches(indexHtml, /<link[^>]+href=["']\/responsive\.css["'][^>]+data-mfl-responsive-layout=["']true["']/i, "responsive.css must be render-blocking.");
invariant(indexHtml.includes(`MFL Front Office v${release.version}`), "The static footer version must match release.json.");
matches(indexHtml, /<colgroup id="tableColGroup"><\/colgroup>[\s\S]*<thead id="tableHead"><\/thead>[\s\S]*<tbody id="tableBody"><\/tbody>/, "Shared player table shell must stay permanent in index.html.");
matches(indexHtml, /id="databaseStatsPage"[\s\S]*id="mflStatsPage"[\s\S]*id="evaluationPage"[\s\S]*id="playerPage"[\s\S]*id="settingsPage"[\s\S]*id="changelogPage"/, "Every major page must keep a permanent HTML shell.");

const responsive = await readSite("responsive.css");
matches(responsive, /\/\* Mobile parity contract\./, "responsive.css must keep the mobile parity contract.");
matches(responsive, /#progressionPage \.tableScroller[\s\S]*touch-action:\s*pan-x pan-y/, "Mobile player tables must remain touch-scrollable.");

const vercel = JSON.parse(await readSite("vercel.json"));
const cacheHeaders = new Map((vercel.headers || []).map((rule) => [rule.source, rule.headers?.find((header) => header.key === "Cache-Control")?.value]));
for (const source of ["/(.*\\.js)", "/(.*\\.css)", "/release.json"]) {
  invariant(cacheHeaders.get(source) === "no-store, max-age=0", `${source} must use the no-store cache policy.`);
}

const databaseRefresh = await readRepository(".github/workflows/full-database-refresh.yml");
matches(databaseRefresh, /--workflow\s+vercel-site-update\.yml/, "Database refreshes must resolve the last explicit site release.");
excludes(databaseRefresh, /--workflow\s+site-quality\.yml/, "Database refreshes must not publish the latest quality-check commit.");
const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
matches(siteDeploy, /vercel deploy --prod --yes --force/, "Site deployment must force the explicit production release.");

const databaseRuntime = await readSite("api/_database.js");
matches(databaseRuntime, /runtime_metadata/, "SQLite runtime must read runtime_metadata.");

await mustNotExist(resolve(siteRoot, "player-loading-runtime.js"), "player-loading-runtime.js must stay removed; Player has one canonical renderer.");
for (const path of [
  "desktop-table-observer-guard-runtime.js",
  "desktop-table-width.css",
  "evaluation-discount-rate-guard-runtime.js",
  "filter-contract-operator-runtime.js",
  "release-ui-runtime.js",
  "selection-refresh-reset-runtime.js",
  "view-button-visibility-runtime.js",
  "watchlist-route-ui-runtime.js",
]) {
  await mustNotExist(resolve(siteRoot, path), `${path} is deprecated and must stay removed.`);
}

console.log(`Repository validation passed for MFL Front Office v${release.version}.`);