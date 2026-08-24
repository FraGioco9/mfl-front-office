// Temporary one-shot migration for route-readiness-aware page loading; removed by its workflow.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (relative) => String(await readFile(resolve(root, relative), "utf8")).replace(/\r\n?/g, "\n");
const write = async (relative, source) => writeFile(resolve(root, relative), source);
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing migration target: ${label}`);
  return source.replace(before, after);
};

let entry = await read("modules/app-entry.js");
entry = replaceRequired(
  entry,
  " * __mflEnsureRouteRuntime?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,",
  " * __mflEnsureRouteRuntime?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,\n * __mflIsRouteRuntimeReady?: (pageName: string, options?: Record<string, unknown>) => boolean,",
  "app-entry route-runtime readiness typedef",
);
entry = replaceRequired(
  entry,
  "const routeRuntimeEnsurePromises = new Map();",
  "const routeRuntimeEnsurePromises = new Map();\nconst routeRuntimeReadyKeys = new Set();",
  "app-entry route-runtime ready set",
);
entry = replaceRequired(
  entry,
  `function trackRouteRuntimePromise(key, promise) {\n  const pending = promise.catch((error) => {\n    routeRuntimeEnsurePromises.delete(key);\n    throw error;\n  });\n  routeRuntimeEnsurePromises.set(key, pending);\n  return pending;\n}`,
  `function trackRouteRuntimePromise(key, promise) {\n  const pending = promise.then(() => {\n    routeRuntimeReadyKeys.add(key);\n  }).catch((error) => {\n    routeRuntimeEnsurePromises.delete(key);\n    routeRuntimeReadyKeys.delete(key);\n    throw error;\n  });\n  routeRuntimeEnsurePromises.set(key, pending);\n  return pending;\n}\n\n/** @param {string} pageName @param {Record<string, unknown>} [options] */\nfunction routeRuntimeReady(pageName, options = {}) {\n  return routeRuntimeReadyKeys.has(routeRuntimeKey(normalizeRoutePageName(pageName), options));\n}`,
  "app-entry route-runtime settled tracking",
);
entry = replaceRequired(
  entry,
  "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;\ninstallClubRouteRuntimeGate();",
  "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;\nruntimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;\ninstallClubRouteRuntimeGate();",
  "app-entry route-runtime readiness export",
);
await write("modules/app-entry.js", entry);

let routeCore = await read("route-core-loader-runtime.js");
routeCore = replaceRequired(
  routeCore,
  "   * __mflEnsureRouteCore?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,",
  "   * __mflEnsureRouteCore?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,\n   * __mflIsRouteCoreReady?: (pageName: string, options?: Record<string, unknown>) => boolean,",
  "route-core readiness typedef",
);
routeCore = replaceRequired(
  routeCore,
  "   *   ensure?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,",
  "   *   ensure?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,\n   *   isReady?: (pageName: string, options?: Record<string, unknown>) => boolean,",
  "route-core runtime readiness typedef",
);
routeCore = replaceRequired(
  routeCore,
  "    runtimeWindow.__mflEnsureRouteCore = runtimeWindow.__mflRouteCoreRuntime.ensure;",
  "    runtimeWindow.__mflEnsureRouteCore = runtimeWindow.__mflRouteCoreRuntime.ensure;\n    if (typeof runtimeWindow.__mflRouteCoreRuntime.isReady === \"function\") {\n      runtimeWindow.__mflIsRouteCoreReady = runtimeWindow.__mflRouteCoreRuntime.isReady;\n    }",
  "route-core reused-runtime readiness bridge",
);
routeCore = replaceRequired(
  routeCore,
  "  const routeCorePromises = new Map();",
  "  const routeCorePromises = new Map();\n  const loadedRouteCorePages = new Set();",
  "route-core loaded set",
);
routeCore = replaceRequired(
  routeCore,
  "    await loadExternalRouteCore(path);\n    runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();",
  "    await loadExternalRouteCore(path);\n    loadedRouteCorePages.add(pageName);\n    runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();",
  "route-core settled readiness mark",
);
routeCore = replaceRequired(
  routeCore,
  `  async function ensure(pageName, options = {}) {\n    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;\n    for (const dependency of dependencies) {\n      await ensureSingle(dependency);\n    }\n  }`,
  `  async function ensure(pageName, options = {}) {\n    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;\n    for (const dependency of dependencies) {\n      await ensureSingle(dependency);\n    }\n  }\n\n  function isReady(pageName, options = {}) {\n    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;\n    return dependencies.every((dependency) => !ROUTE_CORE_PATHS[dependency] || loadedRouteCorePages.has(dependency));\n  }`,
  "route-core readiness predicate",
);
routeCore = replaceRequired(
  routeCore,
  "  runtimeWindow.__mflEnsureRouteCore = ensure;\n  runtimeWindow.__mflRouteCoreRuntime = Object.freeze({\n    ensure,",
  "  runtimeWindow.__mflEnsureRouteCore = ensure;\n  runtimeWindow.__mflIsRouteCoreReady = isReady;\n  runtimeWindow.__mflRouteCoreRuntime = Object.freeze({\n    ensure,\n    isReady,",
  "route-core readiness export",
);
await write("route-core-loader-runtime.js", routeCore);

let bootstrap = await read("bootstrap-core.js");
bootstrap = replaceRequired(
  bootstrap,
  '      "startup",\n      "setPage",\n      "switchWatchlist",',
  '      "startup",\n      "switchWatchlist",',
  "bootstrap setPage legacy alias",
);
bootstrap = replaceRequired(
  bootstrap,
  `    function wrapBusyGlobal(name, reason = name) {`,
  `    function routeDestinationReady(pageName, options = {}) {\n      const normalizedOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};\n      const dataReady = window.__mflRouteDataCache?.isReady?.(pageName, normalizedOptions) === true;\n      const coreReady = window.__mflIsRouteCoreReady?.(pageName, normalizedOptions) === true;\n      const runtimeReady = window.__mflIsRouteRuntimeReady?.(pageName, normalizedOptions) === true;\n      return dataReady && coreReady && runtimeReady;\n    }\n\n    function routeLoadingActive() {\n      return currentSnapshot.reasons.includes(ROUTE_LOADING_REASON);\n    }\n\n    function wrapRoutePageGlobal() {\n      const original = globalFunction("setPage");\n      if (!original || original.__mflInteractionBusyWrapped) return Boolean(original);\n      const wrapped = async (...args) => {\n        const pageName = args[0];\n        const options = args[2] && typeof args[2] === "object" && !Array.isArray(args[2]) ? args[2] : {};\n        if (routeDestinationReady(pageName, options) || routeLoadingActive()) {\n          return original.apply(window, args);\n        }\n        return run(async () => {\n          const result = await original.apply(window, args);\n          await waitForRoutePaint();\n          return result;\n        }, ROUTE_LOADING_REASON);\n      };\n      Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });\n      Object.defineProperty(wrapped, "__mflInteractionBusyOriginal", { value: original });\n      return replaceGlobalFunction("setPage", original, wrapped);\n    }\n\n    function wrapBusyGlobal(name, reason = name) {`,
  "bootstrap route-readiness-aware page wrapper",
);
bootstrap = replaceRequired(
  bootstrap,
  '        const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => run(callback, reason);',
  '        const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {\n          const normalizedReason = loadingReason(reason);\n          if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();\n          return run(callback, normalizedReason);\n        };',
  "bootstrap nested route-loading dedup bridge",
);
bootstrap = replaceRequired(
  bootstrap,
  `      [\n        "setPage",\n        "switchWatchlist",\n        "ensureProgressionData",\n      ].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));`,
  `      wrapRoutePageGlobal();\n      [\n        "switchWatchlist",\n        "ensureProgressionData",\n      ].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));`,
  "bootstrap setPage specialized wrapper install",
);
bootstrap = replaceRequired(
  bootstrap,
  "      snapshot: () => currentSnapshot,\n      isBusy: () => currentSnapshot.busy,",
  "      snapshot: () => currentSnapshot,\n      routeReady: routeDestinationReady,\n      isBusy: () => currentSnapshot.busy,",
  "bootstrap route readiness controller export",
);
await write("bootstrap-core.js", bootstrap);

let core = await read("modules/app-core.js");
core = replaceRequired(
  core,
  `        const ownerBeforeRuntime = setPage;\n        const busyToken = window.__mflInteractionBusy?.begin\n          ? window.__mflInteractionBusy.begin("route-runtime")\n          : "";\n        try {\n          const waitForLoadingPaint = Reflect.get(window, "__mflWaitForViewTransitionPaint");\n          if (busyToken && typeof waitForLoadingPaint === "function") {\n            await waitForLoadingPaint();\n          }`,
  `        const ownerBeforeRuntime = setPage;\n        const loadingController = window.__mflInteractionBusy;\n        const routeReady = loadingController?.routeReady?.(pageName, incomingOptions) === true;\n        const routeLoadingActive = loadingController?.snapshot?.().reasons?.includes?.(loadingController.reason) === true;\n        const busyToken = !routeReady && !routeLoadingActive && loadingController?.begin\n          ? loadingController.begin(loadingController.reason)\n          : "";\n        try {\n          const waitForLoadingPaint = Reflect.get(window, "__mflWaitForViewTransitionPaint");\n          if ((busyToken || routeLoadingActive) && typeof waitForLoadingPaint === "function") {\n            await waitForLoadingPaint();\n          }`,
  "canonical setPage route gate loading ownership",
);
await write("modules/app-core.js", core);

let routeValidator = await read("validate-route-runtime.mjs");
routeValidator = replaceRequired(
  routeValidator,
  'includes(entry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime", "SPA navigation must expose the route runtime gate to app-core.");',
  'includes(entry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime", "SPA navigation must expose the route runtime gate to app-core.");\nincludes(entry, "runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady", "SPA navigation must expose settled route-runtime readiness.");\nincludes(entry, "const routeRuntimeReadyKeys = new Set();", "Route runtime readiness must track settled dependency plans explicitly.");',
  "route validator runtime readiness",
);
routeValidator = replaceRequired(
  routeValidator,
  'includes(routeCoreLoader, "runtimeWindow.__mflEnsureRouteCore = ensure", "The route-core loader must expose one route gate API.");',
  'includes(routeCoreLoader, "runtimeWindow.__mflEnsureRouteCore = ensure", "The route-core loader must expose one route gate API.");\nincludes(routeCoreLoader, "runtimeWindow.__mflIsRouteCoreReady = isReady", "The route-core loader must expose settled dependency readiness.");\nincludes(routeCoreLoader, "const loadedRouteCorePages = new Set();", "Route-core readiness must track successfully loaded dependency owners explicitly.");',
  "route validator core readiness",
);
routeValidator = replaceRequired(
  routeValidator,
  'includes(coreSource, "routeCorePromise", "Canonical app-core must overlap route-core download with route-runtime loading.");',
  'includes(coreSource, "routeCorePromise", "Canonical app-core must overlap route-core download with route-runtime loading.");\nincludes(coreSource, "loadingController?.routeReady?.(pageName, incomingOptions)", "Canonical setPage gate must consult full destination readiness before acquiring route loading.");\nincludes(coreSource, "routeLoadingActive", "Canonical setPage gate must avoid duplicate route-loading tokens when an outer transition already owns loading.");',
  "route validator page readiness gate",
);
await write("validate-route-runtime.mjs", routeValidator);

console.log("Migrated page transitions to full route readiness and deduplicated canonical route loading.");
