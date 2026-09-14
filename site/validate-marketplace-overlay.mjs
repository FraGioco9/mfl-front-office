import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [dataPage, marketplaceApi, overlayRuntime, tableLoadingRuntime] = await Promise.all([
  read("./api/_data-page.js"),
  read("./api/marketplace.js"),
  read("./marketplace-overlay-runtime.js"),
  read("./table-loading-runtime.js"),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(
  dataPage.includes("const marketplaceEmbedded = marketplaceRequiredForPage(scope, sortKey, rules);"),
  "Paged data must decide explicitly whether marketplace belongs in the authoritative query.",
);
invariant(
  dataPage.includes('const marketplace = marketplaceEmbedded\n    ? await measureAsync(timings, "marketplace", marketplaceState)\n    : null;'),
  "Ordinary table pages must not await marketplace state, while authoritative listing reads may measure the canonical marketplace owner.",
);
invariant(
  dataPage.includes('String(scope || "").toLowerCase() === "player"'),
  "Player routes must keep authoritative marketplace data for their visible listing badge.",
);
invariant(
  !dataPage.includes('["player", "evaluation"].includes(String(scope || "").toLowerCase())'),
  "Evaluation core data must not block on marketplace state because Evaluation does not consume listing presentation.",
);
invariant(
  dataPage.includes("String(sortKey || \"\").toLowerCase() === LISTING_COLUMN"),
  "Listing sorting must remain marketplace-aware on the backend.",
);
invariant(
  dataPage.includes("rules.some((rule) => String(rule?.column || \"\").toLowerCase() === LISTING_COLUMN)"),
  "Listing filters must remain marketplace-aware on the backend.",
);
invariant(
  marketplaceApi.includes("const marketplace = await marketplaceState();"),
  "The marketplace overlay endpoint must use the canonical fail-closed snapshot owner.",
);
invariant(
  overlayRuntime.includes('window.addEventListener("mfl:data-client-timing", onDataTiming);'),
  "Marketplace overlay must react to the canonical data-client lifecycle rather than intercept fetch.",
);
invariant(
  overlayRuntime.includes('const dataClient = window.__mflDataClient;')
    && overlayRuntime.includes('snapshotPromise = dataClient.fetch("/api/marketplace"'),
  "Marketplace overlay must fetch its snapshot through the canonical data client.",
);
invariant(
  !/(^|[^.\w$])fetch\s*\(\s*["'`]\/api\/marketplace/m.test(overlayRuntime),
  "Marketplace overlay must not keep a native-fetch fallback for its API request.",
);
invariant(
  overlayRuntime.includes("state.incrementalLastKey !== requestKey"),
  "Marketplace overlay must reject stale route completions.",
);
invariant(
  overlayRuntime.includes("listingSensitiveRequest(url.searchParams)"),
  "Marketplace overlay must not rewrite Listing sort/filter or entity-authoritative requests.",
);
invariant(
  tableLoadingRuntime.includes('resources.load("/marketplace-overlay-runtime.js")'),
  "Table infrastructure must load the marketplace overlay independently of application-core readiness.",
);

console.log("Marketplace overlay separation, backend timing, and canonical data-client ownership validation passed.");