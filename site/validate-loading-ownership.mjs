import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, loadingUi, tableLoading] = await Promise.all([
  read("./styles.css"),
  read("./loading.css"),
  read("./bootstrap-core.js"),
  read("./modules/app-entry.js"),
  read("./route-core-loader-runtime.js"),
  read("./loading-toast-runtime.js"),
  read("./table-loading-runtime.js"),
]);

invariant(
  styles.includes('@import url("/loading.css");'),
  "styles.css must load the canonical loading stylesheet.",
);
invariant(
  styles.indexOf('@import url("/loading.css");') > styles.indexOf('@import url("/footer.css");'),
  "loading.css must load after component/footer styles so loading state has deterministic ownership.",
);
invariant(
  !styles.includes("html.mflInteractionBusy"),
  "styles.css must not duplicate loading-state presentation owned by loading.css.",
);

for (const required of [
  "html.mflInteractionBusy body::after",
  "html.mflNavigationPending #progressionPage nav.pager",
  "html.mflDataLoading #progressionPage #watchlistPlayerCount",
  "html.mflTableScrolling #progressionPage .tableScroller tbody",
]) {
  invariant(loadingStyles.includes(required), `loading.css is missing canonical loading ownership through ${required}.`);
}

for (const forbidden of ["!important", "document.createElement(\"style\")"]) {
  invariant(!loadingStyles.includes(forbidden), `Canonical loading CSS must not use runtime/priority repair through ${forbidden}.`);
}

for (const required of [
  "const ROUTE_LOADING_REASON = \"route-loading\";",
  "const DATA_LOADING_REASON = \"data-loading\";",
  "function loadingReasonKind(reason) {",
  "function updateLoadingState() {",
  "document.documentElement.classList.toggle(\"mflInteractionBusy\", interactionBusy);",
  "document.documentElement.classList.toggle(\"mflNavigationPending\", routeLoading);",
  "document.documentElement.classList.toggle(\"mflDataLoading\", dataLoading);",
  "function begin(reason = DATA_LOADING_REASON) {",
  "function end(token) {",
  "function subscribe(listener) {",
  "Object.freeze({ begin, end, subscribe, isBusy, reasons, waitForRoutePaint, installCoreBridge })",
]) {
  invariant(bootstrapCore.includes(required), `bootstrap-core.js is missing canonical loading ownership through ${required}.`);
}

invariant(
  bootstrapCore.includes('begin(ROUTE_LOADING_REASON)'),
  "Refresh startup must use the canonical route-loading reason.",
);
invariant(
  !bootstrapCore.includes('begin("startup")'),
  "Application startup must not retain a separate user-visible loading reason.",
);
invariant(
  bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();"),
  "SPA route loading must remain active through the final route paint.",
);
invariant(
  !bootstrapCore.includes('document.createElement("style")'),
  "bootstrap-core.js must not inject loading CSS at runtime.",
);
invariant(
  !bootstrapCore.includes("window.__mflTableLoadingRuntime?.sync?.();"),
  "The loading-state owner must notify subscribers instead of directly repairing the table runtime.",
);

invariant(
  appEntry.includes('document.documentElement.dataset.mflRouteReady = "true";')
    && appEntry.includes('window.dispatchEvent(new CustomEvent("mfl:route-ready", { detail: release }));'),
  "Initial refresh must publish explicit route readiness.",
);
invariant(
  appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:route-ready", { detail: release }));')
    < appEntry.indexOf("const globalSearchPreloadPromise = runtimeWindow.__mflGlobalSearchRuntime?.preload?.();"),
  "Background Global Search warm-up must not delay visible route readiness.",
);
invariant(
  appEntry.includes('begin?.("route-loading")'),
  "The single lazy Club navigation owner must use the same route-loading reason as refresh startup.",
);
invariant(
  !appEntry.includes('begin?.("route-runtime")'),
  "Lazy Club navigation must not retain a second route-runtime loading identity.",
);
invariant(
  !routeLoader.includes(".begin?.("),
  "The route-core dependency loader must not own interaction loading state after navigation ownership is consolidated in app-entry.",
);

for (const [name, source] of [
  ["loading-toast-runtime.js", loadingUi],
  ["table-loading-runtime.js", tableLoading],
]) {
  invariant(
    source.includes("controller.subscribe(sync)"),
    `${name} must subscribe directly to the canonical loading controller.`,
  );
}

invariant(
  loadingUi.includes('const ROUTE_LOADING_REASON = "route-loading";')
    && loadingUi.includes('const DATA_LOADING_REASON = "data-loading";'),
  "Loading UI must interpret only the canonical route/data loading reasons.",
);
invariant(
  !loadingUi.includes('"route-runtime"') && !loadingUi.includes('"startup"'),
  "Loading UI must not retain retired route-runtime/startup loading identities.",
);
invariant(
  !loadingUi.includes("MutationObserver"),
  "Loading UI must not poll/observe DOM state when the canonical controller can notify it directly.",
);
invariant(
  !tableLoading.includes("MutationObserver"),
  "Table loading must not poll/observe DOM state when the canonical controller can notify it directly.",
);

console.log("Canonical route/data loading ownership, subscriber notifications, single Club route-loading identity, and presentation validation passed.");