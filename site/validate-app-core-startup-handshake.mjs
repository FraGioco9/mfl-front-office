import { readFile } from "node:fs/promises";
import { normalizeStartupDataDependencies } from "./modules/app-core-startup-data-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [entry, routeNormalizer, applicationCore] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./modules/app-core.js"),
]);

includes(
  routeNormalizer,
  "window.__mflMarkApplicationCoreLoaded?.();",
  "The generated application core must explicitly mark successful initialization.",
);
includes(
  routeNormalizer,
  "window.__mflAppStartPromise = (async () => {",
  "The generated application core must publish its startup promise.",
);
const markerIndex = routeNormalizer.indexOf("window.__mflMarkApplicationCoreLoaded?.();");
const startupPromiseIndex = routeNormalizer.indexOf("window.__mflAppStartPromise = (async () => {");
invariant(markerIndex >= 0 && startupPromiseIndex > markerIndex, "The application-core marker must be reached immediately before startup begins.");

includes(
  entry,
  "function assertApplicationCoreInitialized(sourceLabel)",
  "app-entry must verify that a loaded core actually initialized.",
);
includes(
  entry,
  "if (applicationCoreLoaded && runtimeWindow.__mflAppStartPromise) return;",
  "Core initialization must require both the explicit marker and startup promise.",
);
includes(
  entry,
  'assertApplicationCoreInitialized("Prebuilt");',
  "The prebuilt core must prove initialization after its script load event.",
);
excludes(
  entry,
  'assertApplicationCoreInitialized("Fallback");',
  "Browser startup must not retain a raw-source fallback initialization path.",
);
excludes(
  entry,
  "executeApplicationCore(",
  "Browser startup must not execute application-core source text.",
);
excludes(
  entry,
  "__mflLoadFallbackApplicationCoreArtifacts",
  "Browser startup must not request fallback application-core artifacts.",
);
excludes(
  entry,
  "await loadClassicScript(prebuiltApplicationCorePath());\n  markApplicationCoreLoaded();",
  "A classic-script load event must never manufacture successful core initialization.",
);
excludes(
  entry,
  "await loadApplicationCore();\n  markApplicationCoreLoaded();",
  "Startup must trust only the application core's explicit initialization marker.",
);

const normalizedStartup = normalizeStartupDataDependencies(applicationCore);
includes(
  normalizedStartup,
  "const startupProgressionPermissionPromise = (",
  "Startup must create a Progression permission refresh before initial route authorization.",
);
includes(
  normalizedStartup,
  "pageRequiresProgressionPermission(initialTarget.pageName)",
  "Startup must use the canonical Progression permission route classifier.",
);
includes(
  normalizedStartup,
  "&& hasWalletOptIn()",
  "Startup must refresh Progression permission only when a signed wallet proof was restored.",
);
includes(
  normalizedStartup,
  "? loadWalletPermissions({ force: true })",
  "Initial Progression startup must force a live permission revalidation instead of trusting stale cache state.",
);
includes(
  normalizedStartup,
  "if (startupProgressionPermissionPromise) startupDependencies.push(startupProgressionPermissionPromise);",
  "The Progression permission refresh must join the initial startup barrier.",
);
const permissionRefreshIndex = normalizedStartup.indexOf("? loadWalletPermissions({ force: true })");
const startupBarrierIndex = normalizedStartup.indexOf("await Promise.allSettled(startupDependencies);");
const initialRouteIndex = normalizedStartup.indexOf("await showHomeShell(initialTarget.pageName, false, initialTarget.options);");
invariant(
  permissionRefreshIndex >= 0 && startupBarrierIndex > permissionRefreshIndex && initialRouteIndex > startupBarrierIndex,
  "Progression permission must settle before the initial route can run its authorization redirect.",
);

console.log("Prebuilt application-core startup handshake validation passed.");
