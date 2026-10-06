import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = path => readValidationText(path, import.meta.url);
const [types, routing, incremental, routeGate, tableState, jsconfigText, baselineText] = await Promise.all([
  read("./types/global.d.ts"),
  read("./modules/core-sources/shared-routing.js"),
  read("./modules/core-sources/shared-incremental-routing.js"),
  read("./modules/core-sources/shared-route-runtime-gate.js"),
  read("./modules/core-sources/shared-table-state.js"),
  read("./jsconfig.core.json"),
  read("./validation/core-type-diagnostic-baseline.json"),
]);

for (const contract of [
  "interface MflDataClientRequestOptions",
  "interface MflRouteOptions",
  "interface MflIncrementalTableFilters",
  "interface MflIncrementalRoute",
  "interface MflIncrementalPayload",
  "interface MflTableSortState",
]) {
  invariant(types.includes(contract), `ARCH-02 must retain named boundary contract: ${contract}.`);
}

invariant(
  types.includes("options?: MflDataClientRequestOptions")
    && types.includes("options: MflRouteOptions;")
    && types.includes("routeDependencyPlan(pageName: unknown, options?: MflRouteOptions)")
    && types.includes("requestShellId(request: unknown, options?: MflRouteOptions)")
    && types.includes("mflLoadIncrementalRoutePage?: (pageName: string, options?: MflRouteOptions)"),
  "Data-client and route runtime public boundaries must consume the named ARCH-02 contracts.",
);

invariant(
  routing.includes("@param {MflRouteOptions} [options]")
    && routing.includes("function pagePath(pageName, options = {}) {")
    && routing.includes("function updatePageUrl(pageName, options = {}) {"),
  "Shared route path/update boundaries must be JSDoc-typed with MflRouteOptions.",
);

for (const contract of [
  "@returns {MflIncrementalRoute | null}",
  "@param {MflIncrementalRoute} route",
  "@param {MflIncrementalPayload | null | undefined} payload",
  "@returns {MflIncrementalPayload | null}",
]) {
  invariant(
    incremental.includes(contract),
    `Incremental route/data boundaries must retain typed contract: ${contract}.`,
  );
}
invariant(
  incremental.includes("function routeDataCacheReady(pageName, options = {}) {")
    && incremental.includes("@param {MflRouteOptions} [options]"),
  "Incremental cache readiness must consume the canonical route option type.",
);

invariant(
  routeGate.includes("@param {MflRouteOptions} [options]")
    && routeGate.includes("async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {"),
  "The lazy route-runtime gate must keep its named route-option boundary.",
);

invariant(
  tableState.includes("@returns {MflTableSortState}")
    && tableState.includes("@param {Partial<MflTableSortState> | null | undefined} sortState")
    && tableState.includes("@param {MflTableSortState | null} [fallbackSortState]"),
  "Table sort state must retain its named incremental typing boundary.",
);

const jsconfig = JSON.parse(jsconfigText);
invariant(
  jsconfig?.compilerOptions?.checkJs === true
    && jsconfig?.compilerOptions?.strict === false
    && jsconfig?.compilerOptions?.noImplicitAny === false,
  "ARCH-02 is an incremental checkJs migration; it must not silently claim a repo-wide strict/noImplicitAny flip.",
);

const baseline = JSON.parse(baselineText);
invariant(
  baseline?.version === 1
    && Number.isInteger(baseline?.total)
    && baseline.total <= 288
    && Number.isInteger(baseline?.fingerprintCount)
    && baseline.fingerprintCount <= 253,
  "Core TypeScript diagnostic debt may stay flat or ratchet down, but ARCH-02 must never expand the accepted baseline.",
);

console.log("ARCH-02 typed route/data/sort boundaries and non-growing TypeScript diagnostic ratchet validation passed.");
