import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [loadingRuntime, sharedCore] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./modules/core-sources/shared.js"),
]);

const finishStart = loadingRuntime.indexOf("function finishRequest(token) {");
const finishEnd = loadingRuntime.indexOf("\n  function show(", finishStart);
invariant(finishStart >= 0 && finishEnd > finishStart, "Table loading must expose the canonical request-finishing owner.");
const finishRequest = loadingRuntime.slice(finishStart, finishEnd);

invariant(
  finishRequest.includes("if (!requestToken) {")
    && finishRequest.includes("if (!requestActive()) sync();"),
  "Cached table-route completions must reconcile settled pager visibility when no loading request token was created.",
);
invariant(
  finishRequest.indexOf("if (!requestActive()) sync();") < finishRequest.indexOf("if (requestToken !== activeRequestToken) return false;"),
  "Zero-token cached reconciliation must happen before stale request-token rejection.",
);
invariant(
  loadingRuntime.includes("if (page) page.hidden = !pagerRouteActive();"),
  "Settled pager reconciliation must keep route-aware visibility, including pager-free Club pages.",
);
invariant(
  sharedCore.includes('if (route.scope === "empty" || incrementalRouteIsCached(route, 1)) {\n      return loadAndRender();')
    && sharedCore.includes("finishRequest?.(progressionLoadingRequestToken);"),
  "Cached table page navigation must continue through the shared settled-loading finalizer.",
);

console.log("Cached table pager restoration validation passed.");
