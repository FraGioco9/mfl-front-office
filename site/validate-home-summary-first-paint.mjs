import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const occurrences = (source, value) => source.split(value).length - 1;

const [indexHtml, stylesBase, bootstrapRuntime, staticUiRuntime, coreSource, releaseJson] = await Promise.all([
  read("./index.html"),
  read("./styles-base.css"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./modules/app-core.js"),
  read("./release.json"),
]);
const release = JSON.parse(releaseJson);
const preBootstrap = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release));
const eagerCore = String(normalizeBuiltApplicationCoreArtifacts(coreSource).core || "");

includes(
  indexHtml,
  '<span id="totalPlayers">-</span>',
  "Header Players must exist statically with '-' before summary data loads.",
);
includes(
  indexHtml,
  '<span id="totalWallets">-</span>',
  "Header Wallets must exist statically with '-' before summary data loads.",
);
includes(
  indexHtml,
  '<span id="homePlayers">-</span>',
  "Home Players tracked must exist statically with '-' before summary data loads.",
);
includes(
  indexHtml,
  '<span id="homeWallets">-</span>',
  "Home Wallets tracked must exist statically with '-' before summary data loads.",
);

includes(
  stylesBase,
  'body[data-page="home"] .topbar .stats',
  "The canonical header summary visibility rule must remain Home-owned.",
);
includes(
  preBootstrap,
  "const initialRoute = routes.initialRequest(location.pathname);",
  "Pre-bootstrap runtime must resolve the real initial route before hydration.",
);
includes(
  preBootstrap,
  'if (typeof document !== "undefined" && document.body) document.body.dataset.page = initialRoute.pageName;',
  "Pre-bootstrap runtime must commit the real initial route to body[data-page] when a DOM is available.",
);
invariant(
  preBootstrap.indexOf("document.body.dataset.page = initialRoute.pageName;")
    < preBootstrap.indexOf('const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";'),
  "Initial body route state must be committed before canonical URL replacement or route-specific bootstrap work.",
);

includes(
  bootstrapRuntime,
  'setLoadingValue("homePlayers");',
  "Home route priming must retain the Players tracked loading placeholder.",
);
includes(
  bootstrapRuntime,
  'setLoadingValue("homeWallets");',
  "Home route priming must retain the Wallets tracked loading placeholder.",
);
includes(
  staticUiRuntime,
  'const prime = Reflect.get(window, "__mflPrimeRouteSkeleton");',
  "Shared navigation must continue using the canonical route-skeleton primer.",
);
includes(
  staticUiRuntime,
  'if (typeof prime === "function") prime(target);',
  "Home navigation must still prime its destination shell before data ownership resumes.",
);

includes(
  eagerCore,
  "let summaryLoadPromise = null;",
  "Shared summary loading must track one in-flight bootstrap request.",
);
includes(
  eagerCore,
  "let summaryLoaded = false;",
  "Shared summary loading must remember a successful bootstrap request.",
);
includes(
  eagerCore,
  "let summarySnapshot = null;",
  "Successful Players/Wallets counts must be cached for later Home repaint.",
);
includes(
  eagerCore,
  "if (summaryLoaded && summarySnapshot) {",
  "Home navigation must detect an already-loaded cached summary.",
);
includes(
  eagerCore,
  "updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);",
  "Home navigation must repaint cached counts after the route skeleton resets its placeholders.",
);
includes(
  eagerCore,
  "if (summaryLoadPromise) return summaryLoadPromise;",
  "Home navigation must reuse an in-flight database summary request.",
);
includes(
  eagerCore,
  'if (pageName === "home") void loadSummary();',
  "Every Home navigation must ensure the Players/Wallets tracked summary is restored or loading.",
);
invariant(
  occurrences(eagerCore, 'fetch("/api/data?mode=bootstrap"') === 1,
  "The normalized shared core must keep exactly one database-summary fetch owner.",
);
includes(
  eagerCore,
  'brandLinks.forEach((link) => {',
  "The MFL Front Office brand link must continue using shared page navigation.",
);
includes(
  eagerCore,
  'setPage("home");',
  "The MFL Front Office brand link must navigate through the Home page owner.",
);

const loaderStart = eagerCore.indexOf("let summaryLoadPromise = null;");
const loaderEnd = eagerCore.indexOf("\nfunction tablePageKey", loaderStart);
invariant(loaderStart >= 0 && loaderEnd > loaderStart, "Could not isolate the generated Home summary loader for behavioral validation.");
const loaderSource = eagerCore.slice(loaderStart, loaderEnd);
let fetchCount = 0;
const updates = [];
const context = {
  fetch: async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        manifest: { version: "test" },
        summary: {
          playerCount: 321,
          walletCount: 87,
          generatedAt: "2026-08-21T12:00:00.000Z",
        },
      }),
    };
  },
  state: {},
  updateSummaryCounts: (players, wallets) => updates.push([players, wallets]),
  updateStatusDate: () => {},
  console: { error: () => {} },
};
vm.runInNewContext(`${loaderSource}\nthis.__loadSummary = loadSummary;`, context);
await context.__loadSummary();
invariant(fetchCount === 1, "Initial Home summary load must fetch exactly once.");
invariant(
  updates.length === 1 && updates[0][0] === 321 && updates[0][1] === 87,
  "Initial Home summary load must render the fetched Players/Wallets counts.",
);

updates.length = 0;
await context.__loadSummary();
invariant(fetchCount === 1, "Returning Home after a successful summary load must not fetch again.");
invariant(
  updates.length === 1 && updates[0][0] === 321 && updates[0][1] === 87,
  "Returning Home must repaint cached Players/Wallets counts after route priming reset them to '-'.",
);

console.log("Home summary first-paint validation passed: canonical deep links show the correct header state immediately and brand-link Home navigation repaints cached Players/Wallets counts after route priming.");
