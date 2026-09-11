import vm from "node:vm";

import {
  NOT_FOUND_ROUTE_SHELL_ID,
  PROTECTED_ROUTE_SHELL_ID,
  ROUTE_SHELL_IDS,
  ROUTE_VIEW_SHELL_IDS,
  browserConfigRuntimeSource,
} from "./modules/app-config.js";
import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [releaseSource, bootstrap, staticUi, preBootstrap, indexHtml] = await Promise.all([
  read("./release.json"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./modules/pre-bootstrap-route-state.js"),
  read("./index.html"),
]);

const release = JSON.parse(releaseSource);
const sandbox = {
  window: {},
  location: { pathname: "/", origin: "https://example.test", search: "", hash: "" },
  history: { replaceState() {} },
  Object,
  Set,
  encodeURIComponent,
  decodeURIComponent,
};
vm.runInNewContext(browserConfigRuntimeSource(release), sandbox);
const routes = sandbox.window.__mflAppConfig?.routes;
invariant(routes, "Canonical browser route configuration must be available.");

for (const [page, shellId] of Object.entries(ROUTE_SHELL_IDS)) {
  invariant(
    routes.routeShellId(page, { walletOptedIn: true }) === shellId,
    `${page} must resolve to canonical shell #${shellId}.`,
  );
}
for (const [identity, shellId] of Object.entries(ROUTE_VIEW_SHELL_IDS)) {
  const [page, view] = identity.split(":");
  invariant(
    routes.routeShellId(page, { view, walletOptedIn: true }) === shellId,
    `${identity} must resolve to canonical view shell #${shellId}.`,
  );
}
for (const page of Object.keys(routes.protectedOptedOutPaths)) {
  invariant(
    routes.routeShellId(page, { walletOptedIn: false }) === PROTECTED_ROUTE_SHELL_ID,
    `${page} must resolve to the canonical protected shell while opted out.`,
  );
}
invariant(
  routes.routeShellId("notfound", { walletOptedIn: true }) === NOT_FOUND_ROUTE_SHELL_ID,
  "Typed not-found routes must resolve to the canonical not-found shell.",
);
invariant(
  routes.routeShellId("future-valid-route", { walletOptedIn: true }) === "",
  "An unregistered route shell must fail closed instead of falling back to Home.",
);

const validRouteCases = [
  ["/", true],
  ["/evaluation", true],
  ["/database/attributes", true],
  ["/database/stats", true],
  ["/mfl/stats", true],
  ["/progression/current-season", true],
  ["/my-players/attributes", true],
  ["/my-clubs", true],
  ["/watchlist/current-season", true],
  ["/agents/0xabc/attributes", true],
  ["/clubs/123/squad", true],
  ["/players/42", true],
  ["/settings", true],
  ["/changelog", true],
  ["/privacy", true],
];
for (const [path, walletOptedIn] of validRouteCases) {
  const request = routes.initialRequest(path);
  const shellId = routes.requestShellId(request, { walletOptedIn });
  invariant(shellId, `${path} must resolve a registered destination shell.`);
  if (request.pageName !== "home") {
    invariant(shellId !== "homePage", `${path} must never use Home as a non-Home route shell.`);
    invariant(shellId !== NOT_FOUND_ROUTE_SHELL_ID, `${path} must never pass through Not Found while valid.`);
  }
}

for (const path of ["/my-players/opted-out", "/my-clubs/opted-out", "/watchlist/opted-out", "/settings/opted-out"]) {
  const request = routes.initialRequest(path);
  invariant(
    routes.requestShellId(request, { walletOptedIn: false }) === PROTECTED_ROUTE_SHELL_ID,
    `${path} must remain on its protected destination shell.`,
  );
}

includes(
  preBootstrap,
  "const initialRouteShell = routes.requestShellId(initialRoute, {",
  "Pre-bootstrap must resolve the canonical destination shell before hydration.",
);
includes(
  preBootstrap,
  "document.documentElement.dataset.initialRouteShell = initialRouteShell;",
  "Pre-bootstrap must publish the canonical initial shell identity.",
);
includes(
  bootstrap,
  "APP_CONFIG.routes.requestShellId(request, {",
  "Bootstrap must consume canonical route-shell ownership.",
);
excludes(
  bootstrap,
  'return document.getElementById("homePage");',
  "Bootstrap must not retain a Home fallback for unknown or newly registered routes.",
);
includes(
  staticUi,
  "const requestShellId = window.__mflAppConfig?.routes?.requestShellId;",
  "Passive route chrome must consume canonical route-shell ownership.",
);
excludes(
  staticUi,
  "function routeNeedsLockedShell(",
  "Passive route chrome must not own a protected-route shell allowlist.",
);
excludes(
  staticUi,
  'return document.getElementById("homePage");',
  "Passive route chrome must not use Home as an unresolved-route fallback.",
);
for (const source of [bootstrap, staticUi]) {
  includes(
    source,
    "page.hidden = true;",
    "Missing destination-shell integration must hide stale route content.",
  );
}
includes(
  indexHtml,
  'html:not(.mflInitialRouteResolved):not([data-initial-page="home"]) #homePage,',
  "Parser-time first paint must suppress Home for every raw non-Home URL before canonical config runs.",
);

console.log("Canonical route shell ownership validation passed: one registry owns first paint and runtime shell selection, and non-Home routes cannot fall back to Home.");
