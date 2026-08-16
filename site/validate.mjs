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
matches(bootstrap, /footerVersion\.textContent\s*=\s*`MFL Front Office v\$\{STATIC_RELEASE_VERSION\}`/, "bootstrap.js must synchronously own the release footer label.");
matches(bootstrap, /mflSingleRenderPending/, "bootstrap.js must keep page content hidden until the canonical startup render completes.");
matches(bootstrap, /loadRuntime\(["']\/table-width-runtime\.js["']\)/, "bootstrap.js must load the canonical table width owner before app startup.");
matches(bootstrap, /loadRuntime\(["']\/filter-controls-runtime\.js["']\)/, "bootstrap.js must load filter behavior before app startup.");
excludes(bootstrap, /club-squad-route-runtime|player-loading-runtime|syncBootstrapFirstPaint|syncViewButtonsFirstPaint|syncQuickFilterFirstPaint|primeStatic/, "bootstrap.js must not load page-specific pre-render or repair owners.");

matches(bootstrapCore, /function\s+normalizeSingleRenderCore/, "bootstrap-core must normalize legacy multi-phase core rendering into one final render.");
matches(bootstrapCore, /function\s+installSingleRenderCoreTransform/, "bootstrap-core must install the single-render core transform before app startup.");
matches(bootstrapCore, /shellFirstTablePages\s*=\s*new Set\(\);/, "The transformed core must not use destination shell-first table rendering.");
matches(bootstrapCore, /squad\|contracts\|attributes\|current-season\|all-time/, "Club /squad parsing must be folded into the canonical core transform.");
matches(bootstrapCore, /:\s*["']squad["'];\n\s*return `\/clubs\//, "Club Attributes must canonicalize to /squad in app-core.");
matches(bootstrapCore, /state\.currentPage === ["']club["'] \? ["']Squad["'] : ["']Attributes["']/, "Club Squad label must be set by the canonical view renderer.");
matches(bootstrapCore, /mflSingleRenderPending/, "bootstrap-core must reveal page content only after the canonical startup render settles.");
matches(bootstrapCore, /function\s+createInteractionBusyController/, "bootstrap-core must own global startup interaction blocking.");
excludes(bootstrapCore, /STATIC_TABLE_|primeStaticTable|primeStaticMfl|applyStaticSharedTableWidths|renderStaticClubTitle|syncClubChrome|primeLoadingSurface|GUARD_INTERVAL_MS/, "bootstrap-core must not contain a second page/data-container renderer.");

const entry = await readSite("modules/app-entry.js");
matches(entry, /const\s+path\s*=\s*["']\/modules\/app-core\.js["'];[\s\S]*nativeFetch\(assetUrl\(path\)/, "app-entry.js must execute the canonical application core directly.");
matches(entry, /["']\/table-loading-runtime\.js["']/, "app-entry.js must load the canonical table-loading owner.");
excludes(entry, /view-button-visibility-runtime|watchlist-route-ui-runtime|club-squad-route-runtime/, "app-entry.js must not restore deprecated route/view repair owners.");
excludes(entry, /\?(?:v|dev|rev)=|searchParams\.set\(["'](?:v|dev|rev)["']/, "app-entry.js must keep runtime asset URLs queryless.");

const tableLoading = await readSite("table-loading-runtime.js");
matches(tableLoading, /buildHeader\.__mflSingleRenderOwner/, "Table loading must make app-core buildHeader the single persistent header owner.");
matches(tableLoading, /renderTableLoadingShell\.__mflSingleRenderOwner/, "Table loading must invoke the canonical header before data fetch.");
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

const desktopTableStyle = await readSite("desktop-table-style-runtime.js");
excludes(desktopTableStyle, /MutationObserver|replaceChildren|title\.textContent\s*=|title\.innerHTML/, "Desktop table styling must not rewrite Agent or table content after app-core renders it.");
matches(desktopTableStyle, /agentWalletCopy/, "Agent wallet-copy interaction must remain delegated to the canonical title element.");

const selectionStartup = await readSite("selection-startup-reset-runtime.js");
matches(selectionStartup, /restoreSavedTableState\.__mflStartupSelectionReset/, "Startup selection reset must sanitize restored selection state before canonical table rendering.");
excludes(selectionStartup, /MutationObserver|renderTable\s*\(/, "Startup selection reset must never watch or rerender the table.");

const evaluationLayout = await readSite("evaluation-layout-runtime.js");
excludes(evaluationLayout, /MutationObserver|showEvaluationPage|syncLoadButton|syncDiscountRateFallback|main\s*>\s*\.pageView|replaceChildren/, "Evaluation layout must not pre-render or repair Evaluation content.");

const evaluationDiscountDisplay = await readSite("evaluation-discount-rate-display-runtime.js");
excludes(evaluationDiscountDisplay, /MutationObserver|setInterval|querySelector|textContent\s*=|classList\./, "Evaluation discount display compatibility must never repair or poll rendered DOM.");

const evaluationDiscountRate = await readSite("evaluation-discount-rate-runtime.js");
matches(evaluationDiscountRate, /mfl:season-ratios-ready/, "Evaluation discount-rate data must publish one explicit ready event.");
excludes(evaluationDiscountRate, /setInterval|subtree:\s*true/, "Evaluation discount-rate ownership must be event-driven and must not poll or broadly observe the page.");

const evaluationDiscountUi = await readSite("evaluation-discount-rate-ui-runtime.js");
excludes(evaluationDiscountUi, /MutationObserver|setInterval|evaluationDiscountRate\.textContent|advancedDiscountRateValue\.textContent/, "Evaluation discount-rate UI must remain tooltip-only and event-driven.");

const evaluationSearchState = await readSite("evaluation-search-state-runtime.js");
matches(evaluationSearchState, /recentEvaluationRows\.__mflSupabaseOnly/, "Evaluation recents must stay Supabase-backed data consumed by the canonical renderer.");
excludes(evaluationSearchState, /MutationObserver|resultsObserver|\.replaceChildren\(/, "Evaluation recent-state runtime must not watch or rebuild the search results container.");

const globalSearch = await readSite("global-search-runtime.js");
matches(globalSearch, /installCoreSearchMatching/, "Global Search runtime must remain the authoritative search-data bridge.");
matches(globalSearch, /__mflSurnameFirst/, "Player search must preserve surname-first matching.");
excludes(globalSearch, /resultsObserver|canonicalSearchResults|canonicalSearchCaptured|observeResultBoxes|syncCanonicalSearchResults|prependCanonicalSearchResult/, "Global Search must never snapshot or repair rendered result nodes.");

const watchlistUi = await readSite("watchlist-ui-runtime.js");
excludes(watchlistUi, /MutationObserver|history\.pushState|history\.replaceState|syncWatchlistTitle|syncWatchlistSwitcher|protectedRoute|currentWatchlistIdentity/, "Watchlist UI must not compete with app-core for route, title, or switcher state.");

const filterControls = await readSite("filter-controls-runtime.js");
matches(filterControls, /buildOperatorSelect\.__mflContractOperators/, "Filter behavior must be installed at canonical control construction time.");
excludes(filterControls, /syncStaticViewButtons|installStaticViewShell|playerLoading|syncExistingContractOperators|viewButtonsContainer|subtree:\s*true/, "Filter controls must not pre-render view chrome or repair existing filter controls.");

const nationalityFilterOptions = await readSite("nationality-filter-options-runtime.js");
matches(nationalityFilterOptions, /uniqueNationalityValues\.__mflAuthoritativeFilterOptions/, "Nationality options must feed app-core's canonical filter builder.");
excludes(nationalityFilterOptions, /filterRulesObserver|select\.replaceChildren|subtree:\s*true/, "Nationality option loading must not rebuild rendered selects behind app-core.");

const changelogHistory = await readSite("changelog-history-runtime.js");
matches(changelogHistory, /function\s+buildList/, "Changelog history must have one explicit list renderer.");
excludes(changelogHistory, /MutationObserver|setTimeout\(sync|listMatches\(|footerLabel/, "Changelog must not repeatedly repair or rebuild its rendered history.");

const databaseStats = await readSite("database-stats-runtime.js");
matches(databaseStats, /bindPermanentControls/, "Database Stats must bind the permanent HTML shell instead of recreating it.");
excludes(databaseStats, /function\s+createPage|page\.innerHTML|databaseStatsOverallFilters[\s\S]*replaceChildren\(fragment\)/, "Database Stats must not recreate its static page or filter controls.");

const databaseStatsTooltipPortal = await readSite("database-stats-tooltip-portal-runtime.js");
matches(databaseStatsTooltipPortal, /databaseStatsCustomFilter/, "Database Stats custom filtering must use the permanent filter element.");
excludes(databaseStatsTooltipPortal, /databaseStatsCustomTooltipPortal|innerHTML|createElement|MutationObserver|replaceChildren/, "Database Stats must not create a duplicate custom-filter portal/form.");

const mflStats = await readSite("mfl-stats-runtime.js");
matches(mflStats, /__mflStatsRuntime\s*=\s*Object\.freeze/, "MFL Stats compatibility hooks must remain available to app-entry.");
excludes(mflStats, /fetch\(|MutationObserver|replaceChildren|innerHTML|renderMflStats|ensureStaticFilters|showStatsShell/, "MFL Stats runtime must not compete with app-core's single MFL Stats renderer.");

const indexHtml = await readSite("index.html");
matches(indexHtml, /<meta[^>]+name=["']viewport["'][^>]+viewport-fit=cover/i, "Mobile first paint must enable safe-area viewport fitting.");
matches(indexHtml, /<link[^>]+href=["']\/responsive\.css["'][^>]+data-mfl-responsive-layout=["']true["']/i, "responsive.css must be render-blocking.");
matches(indexHtml, /<colgroup id="tableColGroup"><\/colgroup>[\s\S]*<thead id="tableHead"><\/thead>[\s\S]*<tbody id="tableBody"><\/tbody>/, "Shared player table shell must stay permanent in index.html.");
matches(indexHtml, /id="databaseStatsPage"[\s\S]*id="mflStatsPage"[\s\S]*id="evaluationPage"[\s\S]*id="playerPage"[\s\S]*id="settingsPage"[\s\S]*id="changelogPage"/, "Every major page must keep a permanent HTML shell.");
matches(indexHtml, /id="evaluationDiscountRate"[^>]*>\s*-\s*<\/strong>/, "Evaluation Discount Rate must start from the permanent HTML placeholder instead of a bootstrap renderer.");

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

for (const path of [
  "player-loading-runtime.js",
  "club-squad-route-runtime.js",
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
