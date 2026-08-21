import { readFile } from "node:fs/promises";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const occurrences = (source, value) => source.split(value).length - 1;

const [indexHtml, stylesBase, coreSource, releaseJson] = await Promise.all([
  read("./index.html"),
  read("./styles-base.css"),
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
    < preBootstrap.indexOf("const initialClubPath = String(location.pathname"),
  "Initial body route state must be committed before route-specific bootstrap work.",
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
  "if (summaryLoaded) return true;",
  "Home navigation must reuse an already-loaded database summary.",
);
includes(
  eagerCore,
  "if (summaryLoadPromise) return summaryLoadPromise;",
  "Home navigation must reuse an in-flight database summary request.",
);
includes(
  eagerCore,
  'if (pageName === "home") void loadSummary();',
  "Every Home navigation must ensure the Players/Wallets tracked summary is loading.",
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

console.log("Home summary first-paint validation passed: deep links show header placeholders immediately and Home navigation shares one summary-loading owner.");
