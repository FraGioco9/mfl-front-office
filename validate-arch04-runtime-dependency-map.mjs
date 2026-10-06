import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { coreSourceManifest } from "./modules/core-source-manifest.js";

const read = path => readValidationText(path, import.meta.url);
const [appConfig, appEntry, ownership, docs] = await Promise.all([
  read("./modules/app-config.js"),
  read("./modules/app-entry.js"),
  read("./validate-core-source-ownership.mjs"),
  read("./docs/arch04-runtime-dependency-map.md"),
]);

const shared = coreSourceManifest.find(({ domain }) => domain === "shared");
const routeDomains = coreSourceManifest.filter(({ domain }) => domain !== "shared");

invariant(shared?.runtime === "app-core-runtime.js", "Shared must remain the one universal canonical core runtime.");
invariant(shared?.maxUniversalBytes === 355000, "ARCH-04 must preserve the existing Shared 355000-byte no-growth ceiling.");
invariant(
  routeDomains.every(({ runtime }) => runtime !== shared.runtime && /^app-core-.+-runtime\.js$/.test(runtime)),
  "Every non-Shared core domain must retain a distinct lazy runtime artifact.",
);

for (const { domain, runtime } of routeDomains) {
  invariant(
    appConfig.includes(`"/modules/${runtime}"`),
    `Route core path for ${domain} must remain declared in app-config.`,
  );
}

const universalStart = appEntry.indexOf("const UNIVERSAL_RUNTIME_SCRIPTS");
const universalEnd = appEntry.indexOf("]);", universalStart);
const universalSource = universalStart >= 0 && universalEnd > universalStart
  ? appEntry.slice(universalStart, universalEnd)
  : "";
for (const { runtime } of routeDomains) {
  invariant(
    !universalSource.includes(runtime),
    `Lazy route runtime ${runtime} must not enter UNIVERSAL_RUNTIME_SCRIPTS.`,
  );
}

invariant(
  appEntry.includes("function routeDependencyPlan(pageName, options = {})")
    && appEntry.includes("await loadScriptGroup(plan.preCore);")
    && appEntry.includes("await loadScriptGroup(plan.postCore);")
    && appEntry.includes("const existing = routeRuntimeEnsurePromises.get(key);")
    && appEntry.includes("return trackRouteRuntimePromise(key, ensureRouteRuntimeNow(page, options));"),
  "Route startup must remain plan-driven, lazy and deduplicated.",
);

invariant(
  appConfig.includes('core.push("table", "mflstats")')
    && appConfig.includes('core.push("table", "club")')
    && appConfig.includes('core.push("table", "watchlist")')
    && appConfig.includes('else if (table) {\n      core.push("table");')
    && appConfig.includes('else if (data.routes.corePaths[page]) {\n      core.push(page);'),
  "Route dependency plans must keep Table/shared infrastructure separate from route-specific core owners.",
);

invariant(
  ownership.includes("355000-byte universal no-growth ceiling")
    && docs.includes("Universal startup")
    && docs.includes("Lazy route domains")
    && docs.includes("No route-size ceiling"),
  "ARCH-04 dependency-map documentation and the existing universal ceiling must remain explicit.",
);

console.log("ARCH-04 runtime dependency graph and universal/lazy ownership validation passed.");
