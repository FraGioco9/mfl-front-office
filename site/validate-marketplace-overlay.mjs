import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [dataPage, marketplaceApi, overlayRuntime, tableLoadingRuntime, appConfig] = await Promise.all([
  read("./api/_data-page.js"),
  read("./api/marketplace.js"),
  read("./marketplace-overlay-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./modules/app-config.js"),
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
  !dataPage.includes('String(scope || "").toLowerCase() === "player"')
    && !dataPage.includes('["player", "evaluation"].includes(String(scope || "").toLowerCase())'),
  "Player and Evaluation core data must not block on marketplace state; entity listing presentation is enriched separately.",
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
  overlayRuntime.includes("listingSensitiveRequest(url.searchParams)")
    && !overlayRuntime.includes('scope === "player"')
    && !overlayRuntime.includes('scope === "evaluation"'),
  "Marketplace overlay must leave Listing sort/filter authoritative while allowing ordinary Player/Evaluation page data to be enriched asynchronously.",
);
invariant(
  appConfig.includes('playerPre: Object.freeze([\n    "/shared-table-ui-runtime.js",\n    "/marketplace-overlay-runtime.js",\n  ])'),
  "Player routes must preload the canonical marketplace overlay so listing enrichment can run in parallel with core Player data.",
);
invariant(
  overlayRuntime.includes('currentPage === "player" && currentScope === "player"')
    && overlayRuntime.includes('Reflect.get(window, "__mflRenderPlayerPageOwner")')
    && overlayRuntime.includes("renderPlayer(playerId);"),
  "Marketplace overlay must rerender only the current Player surface after stale-safe row enrichment.",
);
invariant(
  tableLoadingRuntime.includes('resources.load("/marketplace-overlay-runtime.js")'),
  "Table infrastructure must load the marketplace overlay independently of application-core readiness.",
);

console.log("Marketplace overlay separation, backend timing, and canonical data-client ownership validation passed.");