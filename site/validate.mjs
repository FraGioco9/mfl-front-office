import { access, readFile, readdir } from "node:fs/promises";
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
invariant(
  String(packageManifest.dependencies?.["@onflow/fcl"] || "").trim(),
  "package.json must keep @onflow/fcl as a runtime dependency for server-side Dapper proof verification.",
);
const dataAuth = await readSite("api/_data-auth.js");
matches(dataAuth, /require\(["']@onflow\/fcl["']\)/, "The data API must verify Dapper proofs with @onflow/fcl.");

const bootstrap = await readSite("bootstrap.js");
const bootstrapCore = await readSite("bootstrap-core.js");
const staticVersion = bootstrap.match(/const\s+STATIC_RELEASE_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1];
invariant(staticVersion === release.version, `bootstrap.js release ${staticVersion || "<missing>"} must match ${release.version}.`);
matches(bootstrap, /window\.__mflReleaseVersion\s*=\s*STATIC_RELEASE_VERSION;/, "bootstrap.js must remain the release-version owner without a redundant alias.");
matches(bootstrap, /loadBootstrapRuntime\(["']\/filter-controls-runtime\.js["']\)/, "bootstrap.js must load the canonical filter-controls runtime.");
excludes(bootstrap, /FILTER_OPERATOR_LABELS|installFilterOperatorDefaults|installFilterOperatorAlignment/, "Filter behavior must stay out of bootstrap.js.");
excludes(bootstrap, /searchParams\.set\(["'](?:v|dev|rev)["']/, "bootstrap.js must keep runtime asset URLs queryless.");
excludes(bootstrap, /bootstrap-core-owned|void\s+MOBILE_TABLE_MIN_WIDTH|void\s+eventTargetsBusyScrollSurface/, "bootstrap.js must not keep validation-only compatibility markers.");
matches(bootstrapCore, /MOBILE_TABLE_MIN_WIDTH\s*=\s*1240/, "Static first paint must preserve a horizontally scrollable mobile table width.");
matches(bootstrapCore, /function\s+eventTargetsBusyScrollSurface/, "Busy interaction blocking must preserve native scrolling in its actual owner.");

const entry = await readSite("modules/app-entry.js");
matches(entry, /const\s+path\s*=\s*["']\/modules\/app-core\.js["'];[\s\S]*nativeFetch\(assetUrl\(path\)/, "app-entry.js must fetch and execute the canonical application core directly.");
matches(entry, /link\.href\s*=\s*["']\/responsive\.css["'];/, "app-entry.js must load responsive.css from the site root.");
matches(entry, /["']\/desktop-table-style-runtime\.js["']/, "app-entry.js must load the desktop table stylesheet owner.");
matches(entry, /["']\/evaluation-discount-rate-display-runtime\.js["']/, "app-entry.js must load the discount-rate display owner.");
matches(entry, /["']\/selection-startup-reset-runtime\.js["']/, "app-entry.js must load the selection startup reset owner.");
matches(entry, /["']\/table-view-runtime\.js["']/, "app-entry.js must load the canonical table-view interaction owner.");
matches(entry, /["']\/watchlist-ui-runtime\.js["']/, "app-entry.js must load the canonical Watchlist UI owner.");
excludes(entry, /view-button-visibility-runtime|watchlist-route-ui-runtime/, "app-entry.js must not load renamed runtime owners.");
excludes(entry, /__mflRestoreNativeMutationObserver|desktop-table-observer-guard-runtime|evaluation-discount-rate-guard-runtime|selection-refresh-reset-runtime/, "app-entry.js must not restore removed compatibility runtimes.");
excludes(entry, /\?(?:v|dev|rev)=|searchParams\.set\(["'](?:v|dev|rev)["']/, "app-entry.js must keep runtime asset URLs queryless.");
excludes(entry, /window\.__mflReleaseVersion\s*=/, "app-entry.js must not overwrite the bootstrap-owned release version.");
excludes(entry, /loadPreparedClassicScript|executeClassicSource|loadPartitionedClassicScript/, "app-entry.js must not restore deprecated runtime loaders.");

const desktopTableStyle = await readSite("desktop-table-style-runtime.js");
matches(desktopTableStyle, /desktop-table-layout\.css/, "Desktop table layout runtime must load desktop-table-layout.css.");
excludes(desktopTableStyle, /MutationObserver|RestoreNativeMutationObserver/, "Desktop table stylesheet loading must not include obsolete MutationObserver compatibility logic.");

const filterControls = await readSite("filter-controls-runtime.js");
matches(filterControls, /AT_MOST_DEFAULT_COLUMNS/, "Filter controls must own numeric default operators.");
matches(filterControls, /contractStatusFilterColumn/, "Filter controls must own Contracts Is/Is not behavior.");
matches(filterControls, /grid-template-columns:\s*104px/, "Filter controls must preserve the full And/Or selector width.");

const sharedTableUi = await readSite("shared-table-ui-runtime.js");
matches(sharedTableUi, /syncQuickFilterLabels/, "Shared table UI must own quick-filter visibility.");
matches(sharedTableUi, /syncViewButtons/, "Shared table UI must own shared table view visibility and order.");
matches(sharedTableUi, /primeMflStatsOverallFilters/, "Shared table UI must own the MFL stats filter bar.");

const tableView = await readSite("table-view-runtime.js");
excludes(tableView, /MFL_STATS_FILTERS|hideMflPlayersFilter|packablePlayersFilter|syncDatabaseViewButtons/, "Table view interactions must not duplicate shared table chrome ownership.");
matches(tableView, /DATABASE_STATS_FILTERS/, "Table view runtime must preserve Database Stats filter priming.");
matches(tableView, /installInitialWatchlistActiveGuard/, "Table view runtime must preserve Watchlist first-paint active-view stability.");

const watchlistUi = await readSite("watchlist-ui-runtime.js");
excludes(watchlistUi, /syncWatchlistNavigationLink|resolvedWatchlistNavigationPath|setTimeout\(schedule|watchlistRenameStableTooltip/, "Watchlist UI must not retain obsolete navigation repair, timer polling, or stale object names.");
matches(watchlistUi, /watchlistRenameTooltip/, "Watchlist UI must use the canonical rename tooltip object.");

const discountRateDisplay = await readSite("evaluation-discount-rate-display-runtime.js");
excludes(discountRateDisplay, /evaluationSearch|recentSearch|Changelog/, "Discount-rate display runtime must not own unrelated UI state.");

const responsive = await readSite("responsive.css");
const styles = await readSite("styles.css");
const indexHtml = await readSite("index.html");
matches(indexHtml, /<meta[^>]+name=["']viewport["'][^>]+viewport-fit=cover/i, "Mobile first paint must enable safe-area viewport fitting.");
matches(indexHtml, /<link[^>]+href=["']\/responsive\.css["'][^>]+data-mfl-responsive-layout=["']true["']/i, "responsive.css must be render-blocking on first paint.");
invariant(indexHtml.includes(`MFL Front Office v${release.version}`), "The static footer version must match release.json before runtime startup.");
matches(indexHtml, /TABLE_VIEW_CONFIG[\s\S]*mflInitialTableViewFirstPaint/, "index.html must generate table-view first paint from the canonical view config.");
excludes(styles, /data-initial-page\^=["']database/, "styles.css must not duplicate the generated table-view first-paint matrix.");
matches(responsive, /\/\* Mobile parity contract\./, "responsive.css must keep the mobile parity contract.");
matches(responsive, /#mflLoadingToast[\s\S]*--mfl-visual-viewport-bottom/, "Mobile loading toast must account for the visual viewport.");
matches(responsive, /#progressionPage \.tableScroller[\s\S]*touch-action:\s*pan-x pan-y/, "Mobile player tables must remain touch-scrollable.");

const viewportMediaPattern = /@media\s*\(\s*(?:max|min)-width/i;
const responsiveOwnerCandidates = [];
for (const entry of await readdir(siteRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(?:css|html|js|mjs)$/.test(entry.name) || entry.name === "responsive.css") continue;
  responsiveOwnerCandidates.push(entry.name);
}
for (const entry of await readdir(resolve(siteRoot, "modules"), { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) responsiveOwnerCandidates.push(`modules/${entry.name}`);
}
for (const path of responsiveOwnerCandidates) {
  const source = await readSite(path);
  excludes(source, viewportMediaPattern, `${path} must keep viewport media queries in responsive.css.`);
}

for (const path of [
  "evaluation-layout-runtime.js",
  "global-search-runtime.js",
  "static-ui-runtime.js",
  "selection-startup-reset-runtime.js",
  "selection-stack-runtime.js",
  "table-view-runtime.js",
  "watchlist-ui-runtime.js",
  "watchlist-myplayers-route-runtime.js",
]) {
  const source = await readSite(path);
  excludes(source, /window\.__mflReleaseVersion\s*=/, `${path} must not overwrite the global release version.`);
}

const vercel = JSON.parse(await readSite("vercel.json"));
const cacheHeaders = new Map(
  (vercel.headers || []).map((rule) => [
    rule.source,
    rule.headers?.find((header) => header.key === "Cache-Control")?.value,
  ]),
);
for (const source of ["/(.*\\.js)", "/(.*\\.css)", "/release.json"]) {
  invariant(cacheHeaders.get(source) === "no-store, max-age=0", `${source} must use the no-store cache policy.`);
}

const historyOverrides = JSON.parse(await readSite("release-history-overrides.json"));
invariant(Array.isArray(historyOverrides) && historyOverrides.length > 0, "release-history-overrides.json must contain release-history corrections.");
invariant(historyOverrides[0]?.[0] === `v${release.version}`, "Release history overrides must start with the current release.");
invariant(new Set(historyOverrides.map(([version]) => version)).size === historyOverrides.length, "Release history overrides must not contain duplicate versions.");
const releaseApi = await readSite("api/releases.js");
matches(releaseApi, /require\(["']\.\.\/release-history-overrides\.json["']\)/, "The releases API must serve canonical history overrides.");
excludes(releaseApi, /releases-recent\.json|releases-rewritten\.json/, "The releases API must not depend on removed development or legacy history files.");

const changelogHistory = await readSite("changelog-history-runtime.js");
excludes(changelogHistory, /rewrittenReleaseVersion|rewrittenHistoryKey|\?v=/, "Changelog state must not retain rewritten-history or cache-busting legacy names.");

const databaseRefresh = await readRepository(".github/workflows/full-database-refresh.yml");
matches(databaseRefresh, /--workflow\s+vercel-site-update\.yml/, "Database refreshes must resolve the last explicit site release.");
excludes(databaseRefresh, /--workflow\s+site-quality\.yml/, "Database refreshes must not publish the latest quality-check commit.");
matches(databaseRefresh, /Verify published frontend source is unchanged/, "Database refreshes must verify the published frontend source.");
matches(databaseRefresh, /cp builder\/site\/api\/_database\.js production-site\/site\/api\/_database\.js/, "Database refreshes must install the current SQLite runtime adapter.");
matches(databaseRefresh, /Verify live production database/, "Database refreshes must verify live SQLite freshness.");

const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
matches(siteDeploy, /release\.json/, "Site deployment must validate canonical release metadata.");
matches(siteDeploy, /vercel deploy --prod --yes --force/, "Site deployment must force the explicit production release.");

const preparer = await readRepository("prepare_runtime_database.py");
matches(preparer, /["']generated_at["']\s*:\s*generated_at/, "Runtime database preparation must write generated_at metadata.");
const databaseRuntime = await readSite("api/_database.js");
matches(databaseRuntime, /runtime_metadata/, "SQLite runtime must read runtime_metadata.");
matches(databaseRuntime, /\.get\(["']generated_at["']\)/, "SQLite runtime must expose generated_at freshness.");

for (const path of [
  "desktop-table-observer-guard-runtime.js",
  "desktop-table-width.css",
  "evaluation-discount-rate-guard-runtime.js",
  "filter-contract-operator-runtime.js",
  "release-ui-runtime.js",
  "releases-recent.json",
  "releases-rewritten.json",
  "selection-refresh-reset-runtime.js",
  "modules/core-runtime.js",
  "modules/http.js",
  "modules/release.js",
  "modules/runtime-loader.js",
  "my-players-refresh-view-runtime.js",
  "search-result-click-runtime.js",
  "selection-stack-source-v1.120.26.js",
  "v1-120-10-runtime.js",
  "v1-123-31-runtime.js",
  "view-button-visibility-runtime.js",
  "watchlist-route-ui-runtime.js",
]) {
  await mustNotExist(resolve(siteRoot, path), `${path} is deprecated and must stay removed.`);
}
await mustNotExist(resolve(siteRoot, "tests"), "site/tests must stay removed.");
await mustNotExist(resolve(siteRoot, "playwright.config.mjs"), "Playwright regression infrastructure must stay removed.");

console.log(`Repository validation passed for MFL Front Office v${release.version}.`);
