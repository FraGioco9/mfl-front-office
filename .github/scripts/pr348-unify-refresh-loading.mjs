import fs from "node:fs";

function replaceExact(path, before, after, label) {
  let source = fs.readFileSync(path, "utf8");
  if (!source.includes(before)) throw new Error(`${path}: could not find ${label}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source, "utf8");
}

// Keep the pre-core refresh placeholder alive, but do not let it masquerade as
// the canonical route-loading lifecycle used by real page/view transitions.
replaceExact(
  "site/bootstrap-core.js",
  '  const ROUTE_LOADING_REASON = "route-loading";\n',
  '  const ROUTE_LOADING_REASON = "route-loading";\n  const INITIAL_ROUTE_BOOTSTRAP_REASON = "initial-route-bootstrap";\n',
  "initial bootstrap loading reason",
);
replaceExact(
  "site/bootstrap-core.js",
  '    const DATA_LOADING_REASONS = new Set([\n      ROUTE_LOADING_REASON,',
  '    const DATA_LOADING_REASONS = new Set([\n      INITIAL_ROUTE_BOOTSTRAP_REASON,\n      ROUTE_LOADING_REASON,',
  "bootstrap loading reason classification",
);
replaceExact(
  "site/bootstrap-core.js",
  `    function routeLoadingActive() {\n      return currentSnapshot.reasons.includes(ROUTE_LOADING_REASON);\n    }\n\n    function routeLoadingOwnerReusable() {\n      return document.documentElement.classList.contains("mflInitialRouteResolved")\n        && routeLoadingActive();\n    }\n\n    function wrapRoutePageGlobal() {`,
  `    function routeLoadingActive() {\n      return currentSnapshot.reasons.includes(ROUTE_LOADING_REASON);\n    }\n\n    function wrapRoutePageGlobal() {`,
  "remove refresh-specific route owner reuse",
);
replaceExact(
  "site/bootstrap-core.js",
  "if (routeDestinationReady(pageName, options) || routeLoadingOwnerReusable()) {",
  "if (routeDestinationReady(pageName, options) || routeLoadingActive()) {",
  "restore canonical page loading reuse",
);
replaceExact(
  "site/bootstrap-core.js",
  "if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingOwnerReusable()) return callback();",
  "if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();",
  "restore canonical nested loading reuse",
);
replaceExact(
  "site/bootstrap-core.js",
  "const initialRouteToken = window.__mflInteractionBusy.begin(ROUTE_LOADING_REASON);",
  "const initialRouteToken = window.__mflInteractionBusy.begin(INITIAL_ROUTE_BOOTSTRAP_REASON);",
  "separate pre-core bootstrap token",
);

// Publish a readiness gate before the core script loads. startApp can therefore
// wait until the exact same route runtimes/bridges used by SPA clicks are ready.
replaceExact(
  "site/modules/app-entry.js",
  " * __mflAppStartPromise?: Promise<void>,\n",
  " * __mflAppStartPromise?: Promise<void>,\n * __mflInitialRouteRuntimeReadyPromise?: Promise<void>,\n",
  "initial route runtime gate window type",
);
replaceExact(
  "site/modules/app-entry.js",
  `const applicationCoreLoadedPromise = new Promise((resolve) => {\n  applicationCoreLoadedResolve = () => resolve(undefined);\n});\nconst routeRuntimeEnsurePromises = new Map();`,
  `const applicationCoreLoadedPromise = new Promise((resolve) => {\n  applicationCoreLoadedResolve = () => resolve(undefined);\n});\n/** @type {() => void} */\nlet initialRouteRuntimeReadyResolve = () => {};\n/** @type {(reason?: unknown) => void} */\nlet initialRouteRuntimeReadyReject = () => {};\nconst initialRouteRuntimeReadyPromise = new Promise((resolve, reject) => {\n  initialRouteRuntimeReadyResolve = () => resolve(undefined);\n  initialRouteRuntimeReadyReject = reject;\n});\ninitialRouteRuntimeReadyPromise.catch(() => {});\nruntimeWindow.__mflInitialRouteRuntimeReadyPromise = initialRouteRuntimeReadyPromise;\nconst routeRuntimeEnsurePromises = new Map();`,
  "publish initial route runtime gate",
);
replaceExact(
  "site/modules/app-entry.js",
  `  const initialRouteKey = routeRuntimeKey(initialRouteRuntime.pageName, initialRouteRuntime.options);\n  await trackRouteRuntimePromise(\n    initialRouteKey,\n    finalizeRouteRuntimeNow(initialRouteRuntime.pageName, initialRouteRuntime.options),\n  );\n\n  if (runtimeWindow.__mflAppStartPromise) {`,
  `  const initialRouteKey = routeRuntimeKey(initialRouteRuntime.pageName, initialRouteRuntime.options);\n  try {\n    await trackRouteRuntimePromise(\n      initialRouteKey,\n      finalizeRouteRuntimeNow(initialRouteRuntime.pageName, initialRouteRuntime.options),\n    );\n    initialRouteRuntimeReadyResolve();\n  } catch (error) {\n    initialRouteRuntimeReadyReject(error);\n    throw error;\n  }\n\n  if (runtimeWindow.__mflAppStartPromise) {`,
  "resolve runtime gate before awaiting app startup",
);

// Preserve the working click/view transition lifecycle, removing only the
// refresh-only loading token that made refresh behavior different.
replaceExact(
  "site/modules/app-core.js",
  `  const navigationToken = typeof navigation?.begin === "function"\n    ? navigation.begin("view-transition")\n    : "";\n  const loadingController = Reflect.get(window, "__mflInteractionBusy");\n  const refreshLoadingToken = !document.documentElement.classList.contains("mflInitialRouteResolved")\n    && typeof loadingController?.begin === "function"\n    ? loadingController.begin(loadingController.reason)\n    : "";\n  try {`,
  `  const navigationToken = typeof navigation?.begin === "function"\n    ? navigation.begin("view-transition")\n    : "";\n  try {`,
  "remove refresh-only view loading owner",
);
replaceExact(
  "site/modules/app-core.js",
  `  } finally {\n    if (refreshLoadingToken) loadingController?.end?.(refreshLoadingToken);\n    if (navigationToken) navigation?.end?.(navigationToken);\n  }\n}`,
  `  } finally {\n    if (navigationToken) navigation?.end?.(navigationToken);\n  }\n}`,
  "remove refresh-only view loading release",
);
replaceExact(
  "site/modules/app-core.js",
  `  await Promise.allSettled(startupDependencies);\n  applyStoredWalletPermission();\n  updateAccountState();\n  updateMenuVisibility();\n  if (navigationTransitionSequence === startupNavigationSequence) {\n    const authoritativeTarget = pageTargetFromPath(\`${location.pathname}${location.search}\`);\n    await showHomeShell(authoritativeTarget.pageName, false, {\n      ...authoritativeTarget.options,\n      skipNavigationTransition: true,\n    });\n  }`,
  `  await Promise.allSettled(startupDependencies);\n  applyStoredWalletPermission();\n  updateAccountState();\n  updateMenuVisibility();\n\n  const initialRouteRuntimeReadyPromise = Reflect.get(window, "__mflInitialRouteRuntimeReadyPromise");\n  if (!initialRouteRuntimeReadyPromise || typeof initialRouteRuntimeReadyPromise.then !== "function") {\n    throw new Error("Initial route runtime readiness gate is unavailable.");\n  }\n  await initialRouteRuntimeReadyPromise;\n\n  if (navigationTransitionSequence === startupNavigationSequence) {\n    const authoritativeTarget = pageTargetFromPath(\`${location.pathname}${location.search}\`);\n    await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);\n  }`,
  "route runtime barrier before canonical refresh navigation",
);

// Loading ownership validators: bootstrap first paint may keep data-loading
// visible, but real route loading must remain the exact SPA lifecycle.
replaceExact(
  "site/validate-loading-ownership.mjs",
  `  'const ROUTE_LOADING_REASON = "route-loading";',\n  "const ROUTE_LOADING_ALIASES = new Set([",`,
  `  'const ROUTE_LOADING_REASON = "route-loading";',\n  'const INITIAL_ROUTE_BOOTSTRAP_REASON = "initial-route-bootstrap";',\n  "const ROUTE_LOADING_ALIASES = new Set([",`,
  "loading validator bootstrap reason declaration",
);
replaceExact(
  "site/validate-loading-ownership.mjs",
  `invariant(\n  bootstrapCore.includes('const initialRouteToken = window.__mflInteractionBusy.begin(ROUTE_LOADING_REASON);'),\n  "Refresh startup must enter the same route-loading reason used by SPA navigation.",\n);`,
  `invariant(\n  bootstrapCore.includes('const initialRouteToken = window.__mflInteractionBusy.begin(INITIAL_ROUTE_BOOTSTRAP_REASON);')\n    && bootstrapCore.includes("INITIAL_ROUTE_BOOTSTRAP_REASON,\\n      ROUTE_LOADING_REASON,"),\n  "Pre-core refresh presentation must stay data-loading without impersonating the canonical SPA route-loading owner.",\n);`,
  "loading validator initial bootstrap token",
);
replaceExact(
  "site/validate-loading-ownership.mjs",
  `invariant(\n  bootstrapCore.includes("if (routeDestinationReady(pageName, options) || routeLoadingOwnerReusable()) {")\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();"),\n  "SPA route loading must remain active through the final route paint.",\n);`,
  `invariant(\n  bootstrapCore.includes("if (routeDestinationReady(pageName, options) || routeLoadingActive()) {")\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();"),\n  "Refresh and SPA navigation must enter the same readiness-aware route-loading path through the final paint.",\n);`,
  "loading validator canonical route reuse",
);
replaceExact(
  "site/validate-loading-ownership.mjs",
  `invariant(\n  !bootstrapCore.includes("window.__mflWithInteractionBusy")\n    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")\n    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")\n    && bootstrapCore.includes("function routeLoadingOwnerReusable() {")\n    && bootstrapCore.includes('document.documentElement.classList.contains("mflInitialRouteResolved")')\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingOwnerReusable()) return callback();")\n    && bootstrapCore.includes("return run(callback, normalizedReason);"),\n  "Legacy uncached route/data loads must reuse route-loading only after initial route ownership has resolved, so refresh-time user navigation gets its own lifetime.",\n);`,
  `invariant(\n  !bootstrapCore.includes("window.__mflWithInteractionBusy")\n    && !bootstrapCore.includes("function routeLoadingOwnerReusable() {")\n    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")\n    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")\n    && bootstrapCore.includes("return run(callback, normalizedReason);"),\n  "Uncached refresh and SPA route/data loads must share the same canonical nested route-loading reuse contract.",\n);`,
  "loading validator shared refresh SPA contract",
);

replaceExact(
  "site/validate-bootstrap-ownership.mjs",
  `includes(\n  bootstrapCore,\n  'const ROUTE_LOADING_REASON = "route-loading";',\n  "Refresh and in-app navigation must share one route-loading identity.",\n);`,
  `includes(\n  bootstrapCore,\n  'const ROUTE_LOADING_REASON = "route-loading";',\n  "Runtime refresh rendering and in-app navigation must share one route-loading identity once the core route starts.",\n);\nincludes(\n  bootstrapCore,\n  'const INITIAL_ROUTE_BOOTSTRAP_REASON = "initial-route-bootstrap";',\n  "Pre-core refresh presentation must use a bootstrap-only loading identity so it cannot change SPA route ownership semantics.",\n);`,
  "bootstrap validator initial bootstrap reason",
);
replaceExact(
  "site/validate-bootstrap-ownership.mjs",
  `includes(\n  bootstrapCore,\n  "function routeLoadingOwnerReusable() {",\n  "Refresh startup and user-triggered route loading must have distinct ownership until the initial route resolves.",\n);\nincludes(\n  bootstrapCore,\n  'document.documentElement.classList.contains("mflInitialRouteResolved")',\n  "Route-loading reuse must be gated by completed initial-route ownership.",\n);\nincludes(\n  bootstrapCore,\n  "if (routeDestinationReady(pageName, options) || routeLoadingOwnerReusable()) {",\n  "Fully ready page destinations and post-startup nested page transitions may bypass duplicate route loading without borrowing the unresolved refresh owner.",\n);`,
  `excludes(\n  bootstrapCore,\n  "function routeLoadingOwnerReusable() {",\n  "Refresh must not retain a special route-loading reuse branch once bootstrap presentation is separated from route loading.",\n);\nincludes(\n  bootstrapCore,\n  "if (routeDestinationReady(pageName, options) || routeLoadingActive()) {",\n  "Refresh and in-app page transitions must use the same ready-or-active route-loading reuse rule.",\n);`,
  "bootstrap validator remove refresh loading branch",
);
replaceExact(
  "site/validate-bootstrap-ownership.mjs",
  `includes(\n  bootstrapCore,\n  "if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingOwnerReusable()) return callback();",\n  "Nested canonical route-loading owners may reuse an active lifecycle only after refresh startup ownership has resolved.",\n);`,
  `includes(\n  bootstrapCore,\n  "if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();",\n  "Nested refresh and in-app route-loading work must share the same canonical active-owner reuse rule.",\n);`,
  "bootstrap validator canonical nested loading reuse",
);

// The shared view click behavior remains unchanged; only remove validation for
// the refresh-only token that no longer exists.
replaceExact(
  "site/validate-generated-view-transition.mjs",
  `const viewRunnerNavigation = viewRunner.indexOf('navigation.begin("view-transition")');\nconst viewRunnerLoadingController = viewRunner.indexOf('Reflect.get(window, "__mflInteractionBusy")', viewRunnerNavigation);\nconst viewRunnerRefreshGuard = viewRunner.indexOf('!document.documentElement.classList.contains("mflInitialRouteResolved")', viewRunnerLoadingController);\nconst viewRunnerLoadingBegin = viewRunner.indexOf("loadingController.begin(loadingController.reason)", viewRunnerRefreshGuard);\nconst viewRunnerCancel = viewRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();", viewRunnerLoadingBegin);\nconst viewRunnerStage = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");\nconst viewRunnerPaint = viewRunner.indexOf("await waitForViewTransitionPaint();", viewRunnerStage);\nconst viewRunnerLoad = viewRunner.indexOf('typeof loader === "function"', viewRunnerPaint);\nconst viewRunnerLoaderCall = viewRunner.indexOf("return await loader(transition);", viewRunnerLoad);\nconst viewRunnerPendingCleanup = viewRunner.indexOf("if (pendingViewTransition === transition) pendingViewTransition = null;", viewRunnerLoaderCall);\nconst viewRunnerLoadingRelease = viewRunner.indexOf("loadingController?.end?.(refreshLoadingToken)", viewRunnerPendingCleanup);\nconst viewRunnerRelease = viewRunner.indexOf("navigation?.end?.(navigationToken)", viewRunnerLoadingRelease);\ninvariant(\n  viewRunnerNavigation >= 0\n    && viewRunnerLoadingController > viewRunnerNavigation\n    && viewRunnerRefreshGuard > viewRunnerLoadingController\n    && viewRunnerLoadingBegin > viewRunnerRefreshGuard\n    && viewRunnerCancel > viewRunnerLoadingBegin\n    && viewRunnerStage > viewRunnerCancel\n    && viewRunnerPaint > viewRunnerStage\n    && viewRunnerLoad > viewRunnerPaint\n    && viewRunnerLoaderCall > viewRunnerLoad\n    && viewRunnerPendingCleanup > viewRunnerLoaderCall\n    && viewRunnerLoadingRelease > viewRunnerPendingCleanup\n    && viewRunnerRelease > viewRunnerLoadingRelease,\n  "Refresh-time view navigation must acquire its own route-loading owner before staging the destination, retain staged ownership through its loader, then release loading and navigation after the destination settles.",\n);`,
  `const viewRunnerNavigation = viewRunner.indexOf('navigation.begin("view-transition")');\nconst viewRunnerCancel = viewRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();", viewRunnerNavigation);\nconst viewRunnerStage = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");\nconst viewRunnerPaint = viewRunner.indexOf("await waitForViewTransitionPaint();", viewRunnerStage);\nconst viewRunnerLoad = viewRunner.indexOf('typeof loader === "function"', viewRunnerPaint);\nconst viewRunnerLoaderCall = viewRunner.indexOf("return await loader(transition);", viewRunnerLoad);\nconst viewRunnerPendingCleanup = viewRunner.indexOf("if (pendingViewTransition === transition) pendingViewTransition = null;", viewRunnerLoaderCall);\nconst viewRunnerRelease = viewRunner.indexOf("navigation?.end?.(navigationToken)", viewRunnerPendingCleanup);\ninvariant(\n  viewRunnerNavigation >= 0\n    && viewRunnerCancel > viewRunnerNavigation\n    && viewRunnerStage > viewRunnerCancel\n    && viewRunnerPaint > viewRunnerStage\n    && viewRunnerLoad > viewRunnerPaint\n    && viewRunnerLoaderCall > viewRunnerLoad\n    && viewRunnerPendingCleanup > viewRunnerLoaderCall\n    && viewRunnerRelease > viewRunnerPendingCleanup\n    && !viewRunner.includes("refreshLoadingToken")\n    && !viewRunner.includes("mflInitialRouteResolved"),\n  "Shared view navigation must keep its proven click lifecycle unchanged, with no refresh-only loading branch.",\n);`,
  "generated view validator remove refresh-only loading branch",
);

// Startup handshake: initial refresh can seed route state early, but visible
// route execution must wait for the final runtime bridge and use normal setPage.
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  `  includes(source, "await Promise.allSettled(startupDependencies);", \`${"${label}"} initial route dependencies must settle through the canonical startup barrier.\`);\n  includes(source, "commitPageTransition(initialTarget.pageName, false, initialTarget.options);", \`${"${label}"} startup must seed live page/view state from the refresh URL before any startup dependency can yield.\`);`,
  `  includes(source, "await Promise.allSettled(startupDependencies);", \`${"${label}"} initial route dependencies must settle through the canonical startup barrier.\`);\n  includes(source, 'const initialRouteRuntimeReadyPromise = Reflect.get(window, "__mflInitialRouteRuntimeReadyPromise");', \`${"${label}"} startup must consume the app-entry initial-route runtime gate.\`);\n  includes(source, 'throw new Error("Initial route runtime readiness gate is unavailable.");', \`${"${label}"} startup must fail explicitly if the final route-runtime gate is missing.\`);\n  includes(source, "await initialRouteRuntimeReadyPromise;", \`${"${label}"} refresh rendering must wait until final route runtimes and loading bridges are installed.\`);\n  includes(source, "commitPageTransition(initialTarget.pageName, false, initialTarget.options);", \`${"${label}"} startup must seed live page/view state from the refresh URL before any startup dependency can yield.\`);`,
  "startup validator runtime gate requirements",
);
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  `  includes(source, "await showHomeShell(authoritativeTarget.pageName, false, {", \`${"${label}"} startup must render the authoritative route without creating a competing transition.\`);\n  includes(source, "...authoritativeTarget.options,", \`${"${label}"} startup must preserve the authoritative route options.\`);\n  includes(source, "skipNavigationTransition: true,", \`${"${label}"} startup render must not cancel or supersede a refresh-time page/view transition.\`);\n  excludes(source, "await showHomeShell(initialTarget.pageName, false, initialTarget.options);", \`${"${label}"} refresh startup must never replay the route captured before its dependency barrier.\`);\n  excludes(source, "await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);", \`${"${label}"} refresh startup must never perform an unguarded authoritative render.\`);`,
  `  includes(source, "await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);", \`${"${label}"} refresh must execute the authoritative route through the same normal setPage transition used by in-app navigation.\`);\n  excludes(source, "skipNavigationTransition: true,", \`${"${label}"} refresh must not bypass the normal navigation transition lifecycle.\`);\n  excludes(source, "await showHomeShell(initialTarget.pageName, false, initialTarget.options);", \`${"${label}"} refresh startup must never replay the route captured before its dependency barrier.\`);`,
  "startup validator canonical final navigation",
);
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  `  const startupBarrierIndex = source.indexOf("await Promise.allSettled(startupDependencies);");\n  const ownershipGuardIndex = source.indexOf("if (navigationTransitionSequence === startupNavigationSequence) {");\n  const authoritativeTargetIndex = source.indexOf('const authoritativeTarget = pageTargetFromPath(\`${location.pathname}${location.search}\`);');\n  const authoritativeRouteIndex = source.indexOf("await showHomeShell(authoritativeTarget.pageName, false, {");\n  const transitionBypassIndex = source.indexOf("skipNavigationTransition: true,", authoritativeRouteIndex);`,
  `  const startupBarrierIndex = source.indexOf("await Promise.allSettled(startupDependencies);");\n  const runtimeGateLookupIndex = source.indexOf('const initialRouteRuntimeReadyPromise = Reflect.get(window, "__mflInitialRouteRuntimeReadyPromise");');\n  const runtimeGateAwaitIndex = source.indexOf("await initialRouteRuntimeReadyPromise;", runtimeGateLookupIndex);\n  const ownershipGuardIndex = source.indexOf("if (navigationTransitionSequence === startupNavigationSequence) {");\n  const authoritativeTargetIndex = source.indexOf('const authoritativeTarget = pageTargetFromPath(\`${location.pathname}${location.search}\`);');\n  const authoritativeRouteIndex = source.indexOf("await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);");`,
  "startup validator ordering markers",
);
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  `      && startupBarrierIndex > permissionRefreshIndex\n      && ownershipGuardIndex > startupBarrierIndex\n      && authoritativeTargetIndex > ownershipGuardIndex\n      && authoritativeRouteIndex > authoritativeTargetIndex\n      && transitionBypassIndex > authoritativeRouteIndex,\n    \`${"${label}"} startup must seed refresh route state before yielding, then render only if startup still owns navigation after its dependency barrier.\`,`,
  `      && startupBarrierIndex > permissionRefreshIndex\n      && runtimeGateLookupIndex > startupBarrierIndex\n      && runtimeGateAwaitIndex > runtimeGateLookupIndex\n      && ownershipGuardIndex > runtimeGateAwaitIndex\n      && authoritativeTargetIndex > ownershipGuardIndex\n      && authoritativeRouteIndex > authoritativeTargetIndex,\n    \`${"${label}"} startup must seed refresh route state before yielding, wait for final route-runtime ownership, then use the normal navigation path only if startup still owns the route.\`,`,
  "startup validator canonical refresh order",
);
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  `validateRefreshNavigationOwnership(coreSource, "Canonical app-core");\nvalidateRefreshNavigationOwnership(generatedCore, "Built app-core");\n\nconst markerIndex`,
  `validateRefreshNavigationOwnership(coreSource, "Canonical app-core");\nvalidateRefreshNavigationOwnership(generatedCore, "Built app-core");\n\nincludes(entry, "runtimeWindow.__mflInitialRouteRuntimeReadyPromise = initialRouteRuntimeReadyPromise;", "app-entry must publish the initial route runtime gate before loading the core.");\nincludes(entry, "initialRouteRuntimeReadyResolve();", "app-entry must resolve the initial route runtime gate after final route runtime installation.");\nincludes(entry, "initialRouteRuntimeReadyReject(error);", "app-entry must reject the initial route runtime gate if route runtime installation fails.");\n\nconst markerIndex`,
  "startup validator app-entry runtime gate",
);
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  `const appStartAwaitIndex = entry.indexOf("await runtimeWindow.__mflAppStartPromise;");\nconst routePaintIndex`,
  `const routeRuntimeFinalizeIndex = entry.indexOf("await trackRouteRuntimePromise(");\nconst routeRuntimeGateResolveIndex = entry.indexOf("initialRouteRuntimeReadyResolve();", routeRuntimeFinalizeIndex);\nconst appStartAwaitIndex = entry.indexOf("await runtimeWindow.__mflAppStartPromise;");\ninvariant(\n  routeRuntimeFinalizeIndex >= 0\n    && routeRuntimeGateResolveIndex > routeRuntimeFinalizeIndex\n    && appStartAwaitIndex > routeRuntimeGateResolveIndex,\n  "app-entry must install the initial route runtime, release the refresh gate, then await the core startup that performs the canonical route transition.",\n);\nconst routePaintIndex`,
  "startup validator app-entry gate order",
);
replaceExact(
  "site/validate-app-core-startup-handshake.mjs",
  'console.log("Prebuilt application-core startup handshake, refresh navigation ownership, and route-ready background warm-up validation passed.");',
  'console.log("Prebuilt application-core startup handshake, unified refresh/SPA navigation ownership, and route-ready background warm-up validation passed.");',
  "startup validator completion message",
);
