import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [entry, routeNormalizer] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
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
includes(
  entry,
  'assertApplicationCoreInitialized("Fallback");',
  "The source fallback must prove initialization after execution.",
);
excludes(
  entry,
  "await loadClassicScript(prebuiltPath);\n    markApplicationCoreLoaded();",
  "A classic-script load event must never manufacture successful core initialization.",
);
excludes(
  entry,
  "executeApplicationCore(SOURCE_CORE_PATH, source);\n  markApplicationCoreLoaded();",
  "Fallback execution must never manufacture successful core initialization.",
);
excludes(
  entry,
  "await loadApplicationCore();\n  markApplicationCoreLoaded();",
  "Startup must trust only the application core's explicit initialization marker.",
);

console.log("Application-core startup handshake validation passed.");
