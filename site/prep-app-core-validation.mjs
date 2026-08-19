import { readFile, writeFile } from "node:fs/promises";

const validationPath = new URL("./validate.mjs", import.meta.url);
let source = await readFile(validationPath, "utf8");

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Validation migration pattern missing: ${label}`);
  source = source.replace(before, after);
}

replaceRequired(
  'includes(tableWidth, "canonical: true", "Table widths must remain globally single-owned.");',
  [
    'includes(tableWidth, "window.__mflUniformWidth = Object.freeze", "Table widths must expose one immutable ownership marker.");',
    'includes(tableWidth, \'source: "styles.css"\', "Static CSS must remain the canonical table-width geometry owner.");',
  ].join("\n"),
  "Uniform Width ownership",
);

replaceRequired(
  'includes(evaluationSearchState, "recentEvaluationRows.__mflSupabaseOnly", "Evaluation recents must stay Supabase-backed.");',
  [
    'includes(evaluationSearchState, "persistEvaluationRecentPlayerIds", "Evaluation recents must persist through the canonical Supabase-backed core contract.");',
    'includes(evaluationSearchState, "purgeLegacyLocalRecentState", "Evaluation recents must purge legacy local recent-ID persistence.");',
  ].join("\n"),
  "Evaluation recent persistence ownership",
);

replaceRequired(
  'includes(globalSearch, "__mflSurnameFirst", "Player search must preserve surname-first matching.");',
  [
    'includes(globalSearch, "coreContracts()?.installSearchMatching", "Global Search must install canonical matching through the application-core contract.");',
    'includes(globalSearch, "coreContracts()?.applySearchPayload", "Global Search must apply authoritative payloads through the application-core contract.");',
  ].join("\n"),
  "Global Search matching ownership",
);

replaceRequired(
  'invariant(localJsRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Local JavaScript must use the no-store cache policy.");',
  'invariant(localJsRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=0, must-revalidate"), "Local JavaScript must use the cacheable revalidation policy.");',
  "local JavaScript cache policy",
);

replaceRequired(
  'invariant(productionJsNoStoreRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Production unversioned JavaScript must retain the no-store cache policy.");',
  'invariant(productionJsNoStoreRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=0, must-revalidate"), "Production unversioned JavaScript must use mandatory revalidation.");',
  "production JavaScript cache policy",
);

await writeFile(validationPath, source, "utf8");

const appConfigValidationPath = new URL("./validate-app-config.mjs", import.meta.url);
let appConfigValidation = await readFile(appConfigValidationPath, "utf8");
const oldSame = `function same(actual, expected, label) {
  invariant(
    JSON.stringify(plain(actual)) === JSON.stringify(plain(expected)),
    \`${"${label}"} must match modules/app-config.js.\`,
  );
}`;
const newSame = `function canonical(value) {
  const normalized = plain(value);
  if (Array.isArray(normalized)) return normalized.map(canonical);
  if (normalized && typeof normalized === "object") {
    return Object.fromEntries(
      Object.entries(normalized)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return normalized;
}

function same(actual, expected, label) {
  invariant(
    JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)),
    \`${"${label}"} must match modules/app-config.js.\`,
  );
}`;
if (!appConfigValidation.includes(oldSame)) throw new Error("Order-sensitive app-config comparison helper was not found.");
appConfigValidation = appConfigValidation.replace(oldSame, newSame);
await writeFile(appConfigValidationPath, appConfigValidation, "utf8");

const routeRuntimeValidationPath = new URL("./validate-route-runtime.mjs", import.meta.url);
let routeRuntimeValidation = await readFile(routeRuntimeValidationPath, "utf8");

function replaceRouteValidation(before, after, label) {
  if (!routeRuntimeValidation.includes(before)) throw new Error(`Route-runtime validation migration pattern missing: ${label}`);
  routeRuntimeValidation = routeRuntimeValidation.replace(before, after);
}

for (const legacyRead of [
  'const requestNormalizer = await read("./modules/app-core-route-request-normalizer.js");\n',
  'const routeNormalizer = await read("./modules/app-core-route-runtime-normalizer.js");\n',
  'const tableStateNormalizer = await read("./modules/app-core-table-state-normalizer.js");\n',
]) {
  replaceRouteValidation(legacyRead, "", `legacy normalizer read ${legacyRead.trim()}`);
}

replaceRouteValidation(
  [
    'includes(routeNormalizer, "export function normalizeRouteRuntimeGate(source)", "The route gate must be a build-time core transform.");',
    'includes(routeNormalizer, "setPageWithRouteRuntime", "The generated core must gate setPage before destination commit.");',
    'includes(routeNormalizer, "ownerBeforeRuntime", "The gate must redispatch when a loaded runtime replaces setPage.");',
    'includes(routeNormalizer, "window.__mflCancelIncrementalRouteRequest?.();", "A new SPA route intent must cancel obsolete route data before lazy runtime loading.");',
    'includes(routeNormalizer, "window.__mflEnsureRouteCore", "The route gate must await route-owned core code before committing its destination.");',
    'includes(routeNormalizer, "routeCorePromise", "Route-core download must overlap route-runtime loading.");',
    'includes(routeNormalizer, "window.__mflMarkApplicationCoreLoaded?.();", "The generated core must mark itself loaded before startApp.");',
  ].join("\n"),
  [
    'includes(coreSource, "function setPageWithRouteRuntime", "The authored core must gate setPage before destination commit.");',
    'includes(coreSource, "ownerBeforeRuntime", "The authored route gate must redispatch when a loaded runtime replaces setPage.");',
    'includes(coreSource, "window.__mflCancelIncrementalRouteRequest?.();", "A new SPA route intent must cancel obsolete route data before lazy runtime loading.");',
    'includes(coreSource, "window.__mflEnsureRouteCore", "The authored route gate must await route-owned core code before committing its destination.");',
    'includes(coreSource, "routeCorePromise", "Route-core download must overlap route-runtime loading.");',
    'includes(coreSource, "window.__mflMarkApplicationCoreLoaded?.();", "The authored core must mark itself loaded before startApp.");',
  ].join("\n"),
  "route gate source ownership",
);

replaceRouteValidation(
  [
    'includes(tableStateNormalizer, "export function normalizePureTableStateRestoration(source)", "Table-state restoration must be a build-time core transform.");',
    'includes(tableStateNormalizer, "state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);", "Saved controls must stage in JavaScript state instead of mutating the page during route preparation.");',
    'includes(tableStateNormalizer, "function syncRestoredTableControls(", "The final table renderer must own one explicit restored-control sync.");',
    '',
    'includes(requestNormalizer, "export function normalizeRouteRequestCancellation(source)", "Route request cancellation must be a build-time core transform.");',
    'includes(requestNormalizer, "activeIncrementalNetworkRequest", "The route request transform must own one abortable active network request.");',
    'includes(requestNormalizer, "incrementalRouteRequestGeneration", "The route request transform must reject stale async completions by generation.");',
    'includes(requestNormalizer, "signal: controller.signal", "Incremental route requests must be actually abortable.");',
    'includes(requestNormalizer, "ROUTE_REQUEST_TIMEOUT_MS = 60_000", "Abortable route requests must retain the bounded API timeout.");',
    'includes(requestNormalizer, "let requestPromise = force ? null", "Forced route refreshes must bypass in-flight request reuse.");',
    'includes(requestNormalizer, "if (force) state.incrementalPayloadCache.delete(cacheKey);", "Forced route refreshes must bypass cached payloads.");',
  ].join("\n"),
  [
    'includes(coreSource, "state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);", "Saved controls must stage in JavaScript state instead of mutating the page during route preparation.");',
    'includes(coreSource, "function syncRestoredTableControls(", "The authored final table renderer must own one explicit restored-control sync.");',
    'includes(coreSource, "activeIncrementalNetworkRequest", "The authored core must own one abortable active network request.");',
    'includes(coreSource, "incrementalRouteRequestGeneration", "The authored core must reject stale async completions by generation.");',
    'includes(coreSource, "signal: controller.signal", "Incremental route requests must be actually abortable.");',
    'includes(coreSource, "ROUTE_REQUEST_TIMEOUT_MS = 60_000", "Abortable route requests must retain the bounded API timeout.");',
    'includes(coreSource, "let requestPromise = force ? null", "Forced route refreshes must bypass in-flight request reuse.");',
    'includes(coreSource, "if (force) state.incrementalPayloadCache.delete(cacheKey);", "Forced route refreshes must bypass cached payloads.");',
  ].join("\n"),
  "table state and request ownership",
);

replaceRouteValidation(
  [
    'includes(buildNormalizer, "normalizeRouteRuntimeGate(startupDataSource)", "The build must apply the route runtime gate after startup-data normalization.");',
    'includes(buildNormalizer, "normalizePureTableStateRestoration(routeRuntimeSource)", "The build must make saved table-state restoration pure before route request cancellation is applied.");',
    'includes(buildNormalizer, "normalizeRouteRequestCancellation(tableStateSource)", "The build must apply route cancellation after pure table-state restoration.");',
    'includes(buildNormalizer, "splitApplicationCoreRuntime(normalizeCompleteApplicationCore(source))", "The complete normalized core must be split only after all behavior transforms are applied.");',
  ].join("\n"),
  [
    'includes(buildNormalizer, "splitApplicationCoreRuntime(canonicalApplicationCoreSource(source))", "The build must split the canonical authored core without behavioral source rewriting.");',
    'excludes(buildNormalizer, "normalizeRouteRuntimeGate", "Route gating must no longer be a build-time source transform.");',
    'excludes(buildNormalizer, "normalizePureTableStateRestoration", "Table-state restoration must no longer be a build-time source transform.");',
    'excludes(buildNormalizer, "normalizeRouteRequestCancellation", "Route request cancellation must no longer be a build-time source transform.");',
  ].join("\n"),
  "split-only build ownership",
);

await writeFile(routeRuntimeValidationPath, routeRuntimeValidation, "utf8");
