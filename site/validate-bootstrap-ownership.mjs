import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [bootstrap, bootstrapCore] = await Promise.all([
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
]);

includes(
  bootstrap,
  'root.classList.add("mflSingleRenderPending");',
  "bootstrap.js must synchronously own first-paint loading state.",
);
includes(
  bootstrap,
  'root.classList.remove("mflInitialRouteResolved");',
  "First-paint route state must remain distinct until startup settles.",
);
includes(
  bootstrap,
  'const LOADING_VALUE_TEXT = "-";',
  "All first-paint data boxes must share the global dash loading placeholder.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflLoadingValueText", LOADING_VALUE_TEXT);',
  "The loading-value placeholder must be published for route runtimes to reuse.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflSetLoadingValue", setLoadingValue);',
  "Data-box loading state must have one shared setter instead of page-specific blank values.",
);
includes(
  bootstrap,
  'const BLANK_TABLE_LOADING_TEXT = "\\u00a0";',
  "Table-row loading skeletons must remain separate from data-box placeholders.",
);
includes(
  bootstrap,
  "cell.textContent = BLANK_TABLE_LOADING_TEXT;",
  "Table-row skeletons must keep their dedicated blank placeholder.",
);
excludes(
  bootstrap,
  "function setBlankLoadingValue(",
  "Bootstrap must not retain a competing blank data-box loading owner.",
);
includes(
  bootstrap,
  '<strong>${LOADING_VALUE_TEXT}</strong>',
  "Player loading cards must show the same global dash placeholder while data resolves.",
);
includes(
  bootstrap,
  "function primeInitialShell() {",
  "bootstrap.js must immediately select the destination shell.",
);
includes(
  bootstrap,
  "function primeTableChrome(page, urlLike = window.location.href) {",
  "bootstrap.js must synchronously prime route-authoritative table title, view, and quickfilters.",
);
includes(
  bootstrap,
  "function tableViewFromUrl(page, urlLike = window.location.href) {",
  "Bootstrap table chrome must derive the active view from the destination URL.",
);
includes(
  bootstrap,
  "function primeViewButtons(page, view) {",
  "First-paint view buttons must be updated directly in the DOM.",
);
includes(
  bootstrap,
  "container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);",
  "View order must be represented by DOM order instead of CSS order overrides.",
);
includes(
  bootstrap,
  'candidate.textContent = page === "club" ? "Squad" : "Attributes";',
  "Club Squad must use real button text instead of generated pseudo-content.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflPrimeTableChrome", primeTableChrome);',
  "Runtime navigation must reuse the bootstrap-owned route-authoritative table chrome primer.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflTableTitleForPageFallback", firstPaintTableTitle);',
  "Player-only startup must retain a shared table-title fallback.",
);
includes(
  bootstrap,
  "function primeInitialTableRows(replaceExisting = false) {",
  "bootstrap.js must seed table routes with five rows before data arrives.",
);
includes(
  bootstrap,
  "const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];",
  "Initial table loading must retain exactly five blank rows.",
);
includes(
  bootstrap,
  "function primeRouteSkeleton(target) {",
  "Non-table routes must have an immediate static skeleton owner.",
);
includes(
  bootstrap,
  "function primePlayerSkeleton() {",
  "Player navigation must reveal structural boxes before player data resolves.",
);
includes(
  bootstrap,
  "function resetStatsShell(target) {",
  "Stats navigation must reset destination boxes before data resolves.",
);
includes(
  bootstrap,
  "function primeStaticButtonGroup(containerId, options, className, activeValue) {",
  "Deterministic route controls must have a reusable first-paint renderer.",
);
includes(
  bootstrap,
  'primeStaticButtonGroup("mflStatsOverallFilters", MFL_STATS_FILTER_LABELS, "mflStatsFilterButton", "all");',
  "MFL Stats overall filters must exist at their final size before its lazy runtime loads.",
);
includes(
  bootstrap,
  'primeStaticButtonGroup("settingsDateFormatOptions", SETTINGS_DATE_FORMAT_LABELS, "settingsToggleButton", "DMY");',
  "Settings date-format controls must exist before Settings data loads.",
);
includes(
  bootstrap,
  'primeStaticButtonGroup("settingsTimeFormatOptions", SETTINGS_TIME_FORMAT_LABELS, "settingsToggleButton", "24h");',
  "Settings time-format controls must exist before Settings data loads.",
);
includes(
  bootstrap,
  'if (target.id === "settingsPage") {',
  "Settings must participate in the same deterministic route-shell priming used by other pages.",
);
const mflStatsResetStart = bootstrap.indexOf('if (target.id === "mflStatsPage") {');
const mflStatsPrime = bootstrap.indexOf("primeMflStatsControls();", mflStatsResetStart);
const mflStatsValues = bootstrap.indexOf('["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]', mflStatsResetStart);
invariant(
  mflStatsResetStart >= 0 && mflStatsPrime > mflStatsResetStart && mflStatsValues > mflStatsPrime,
  "MFL Stats fixed controls must be committed before its loading values are reset.",
);
excludes(
  bootstrap,
  'document.createElement("style")',
  "First-paint bootstrap must not patch layout through injected styles.",
);
excludes(
  bootstrap,
  "!important",
  "First-paint bootstrap must not use CSS overrides.",
);

excludes(
  bootstrapCore,
  'document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");',
  "bootstrap-core.js must not duplicate bootstrap.js first-paint ownership.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.remove("mflSingleRenderPending");',
  "bootstrap-core.js must release first-paint loading state when startup finishes.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.add("mflInitialRouteResolved");',
  "Runtime route ownership must begin only after startup settles.",
);
includes(
  bootstrapCore,
  "if (startupFinished) return;",
  "Startup cleanup must be idempotent across success and error paths.",
);
includes(
  bootstrapCore,
  'if (document.documentElement.dataset.mflReady === "error")',
  "The bootstrap busy controller must observe actual startup failures.",
);
includes(
  bootstrapCore,
  "const recoverCompletedApplicationStartup = async () => {",
  "Post-core errors must be classified against the application startup promise.",
);
includes(
  bootstrapCore,
  "await appStartPromise;",
  "A post-core error must keep loading active until the application promise settles.",
);
excludes(
  bootstrapCore,
  "Promise.race([",
  "Post-core recovery must not use a short timeout that can misclassify slow successful loading.",
);
includes(
  bootstrapCore,
  'document.getElementById("mflStartupError")?.remove();',
  "A recovered post-core error must remove its false fatal message.",
);
includes(
  bootstrapCore,
  'html.${BUSY_CLASS} #progressionPage nav.pager { display: none; }',
  "Pagination must stay hidden for the entire uniform interaction-busy lifecycle and appear only after loading ends.",
);
includes(
  bootstrapCore,
  'html.${DATA_LOADING_CLASS} #progressionPage #watchlistPlayerCount { display: none; }',
  "Watchlist count can remain data-loading scoped while pagination follows the full uniform loading workflow.",
);
excludes(
  bootstrapCore,
  "!important",
  "The bootstrap busy controller must not depend on CSS priority overrides.",
);

console.log("Bootstrap complete first-paint shells, deterministic controls, uniform pager loading, placeholders, and startup ownership validation passed.");
