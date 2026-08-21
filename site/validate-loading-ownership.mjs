import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, loadingStyles, bootstrapCore, loadingUi, tableLoading] = await Promise.all([
  read("./styles.css"),
  read("./loading.css"),
  read("./bootstrap-core.js"),
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
  ".siteFooter.mflLoadingLocked",
  "#mflLoadingToast",
]) {
  invariant(loadingStyles.includes(required), `loading.css is missing canonical loading rule: ${required}`);
}
invariant(!loadingStyles.includes("!important"), "loading.css must not introduce !important overrides.");

for (const required of [
  "const subscribers = new Set();",
  "function subscribe(callback, options = {}) {",
  "snapshot: () => currentSnapshot,",
  'window.dispatchEvent(new CustomEvent("mfl:loading-state", { detail: snapshot }));',
]) {
  invariant(bootstrapCore.includes(required), `bootstrap-core.js is missing loading-state ownership: ${required}`);
}
invariant(
  !bootstrapCore.includes('document.createElement("style")'),
  "bootstrap-core.js must not inject loading CSS at runtime.",
);
invariant(
  !bootstrapCore.includes("window.__mflTableLoadingRuntime?.sync?.();"),
  "The loading-state owner must notify subscribers instead of directly repairing the table runtime.",
);

for (const [name, source] of [
  ["loading-toast-runtime.js", loadingUi],
  ["table-loading-runtime.js", tableLoading],
]) {
  invariant(
    source.includes("controller.subscribe(sync)"),
    `${name} must subscribe directly to the canonical loading controller.`,
  );
  invariant(
    !source.includes("new MutationObserver"),
    `${name} must not infer loading state through MutationObserver.`,
  );
  invariant(
    !source.includes('document.createElement("style")'),
    `${name} must not inject deterministic loading CSS at runtime.`,
  );
}

for (const reason of [
  "setPage",
  "setView",
  "switchWatchlist",
  "route-runtime",
  "requestIncrementalRoute",
]) {
  invariant(
    loadingUi.includes(`"${reason}"`),
    `Loading toast must classify ${reason} as navigation/cache coordination rather than standalone loading.`,
  );
}
invariant(
  loadingUi.includes("const TOAST_COORDINATION_REASONS = new Set(["),
  "Loading toast must keep navigation/cache coordination reasons separate from real loading reasons.",
);
invariant(
  loadingUi.includes("function snapshotNeedsToast(snapshot) {")
    && loadingUi.includes("reasons.some((reason) => !TOAST_COORDINATION_REASONS.has(String(reason || \"\")))"),
  "Loading toast must require at least one non-coordination busy reason before becoming visible.",
);
invariant(
  loadingUi.includes("if (snapshotNeedsToast(snapshot) && !toastSuppressed())"),
  "Loading toast visibility must use the cache-aware loading predicate.",
);
invariant(
  !loadingUi.includes("if (snapshot.busy && !toastSuppressed())"),
  "Loading toast must not appear for every busy navigation snapshot.",
);

invariant(
  !loadingUi.includes("syncToastHosts"),
  "Loading UI must not maintain toast layering through DOM-reparent observers.",
);
invariant(
  !loadingUi.includes("STYLE_ID"),
  "Loading UI must not retain a runtime stylesheet owner.",
);
invariant(
  !tableLoading.includes("observer.observe"),
  "Table loading must react to controller snapshots, not DOM observation.",
);
invariant(
  !tableLoading.includes('window.addEventListener("popstate", sync)'),
  "Table loading must not use route events as a second loading-state owner.",
);
invariant(
  tableLoading.includes('Reflect.get(window, "__mflPrimeTableRows")')
  && tableLoading.includes("primeRows(true);"),
  "Table loading must delegate skeleton row creation to the bootstrap first-paint owner.",
);
invariant(
  !tableLoading.includes("BLANK_ROW_OPACITIES")
  && !tableLoading.includes("document.createDocumentFragment()")
  && !tableLoading.includes('document.createElement("td")'),
  "Table loading must not retain a second loading-row renderer.",
);

console.log("Canonical loading-state ownership, cache-aware toast suppression, bootstrap-owned loading rows, static presentation, and direct subscribers validation passed.");
