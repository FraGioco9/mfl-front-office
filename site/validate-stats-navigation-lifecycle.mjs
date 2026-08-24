import { readFile } from "node:fs/promises";

const normalizer = await readFile(new URL("./modules/app-core-build-normalizer.js", import.meta.url), "utf8");
const source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const runtime = await readFile(new URL("./modules/app-core-runtime.js", import.meta.url), "utf8");
const stateRuntime = await readFile(new URL("./database-stats-state-runtime.js", import.meta.url), "utf8");
const validators = await readFile(new URL("./validate-all.mjs", import.meta.url), "utf8");
const statsDomainValidators = await readFile(new URL("./validate-domain-stats.mjs", import.meta.url), "utf8");

if (normalizer.includes("normalizeStatsNavigationLifecycle") || normalizer.includes("statsNavigationArtifacts")) {
  throw new Error("Build normalization must not rewrite source-owned Stats navigation.");
}
if (
  !source.includes('state.currentPage === "database"\n      && state.view === "stats"\n      && pageName === "database"')
  || !source.includes('(viewName === "attributes" || viewName === "contracts")')
  || !source.includes('runViewTransition("database", viewName, { statePageName: "database" }')
  || !source.includes('view: viewName,\n        skipNavigationTransition: true,\n        skipNavigationLoading: true,')
) {
  throw new Error("Canonical app-core source must own the Database Stats exit to table views.");
}
if (!runtime.includes('state.currentPage === "database"\n      && state.view === "stats"')) {
  throw new Error("Generated application core is missing the Database Stats exit branch.");
}
if (stateRuntime.includes("interaction-loading") || stateRuntime.includes('document.addEventListener("pointerup"')) {
  throw new Error("Legacy Database Stats loading bridge must not return.");
}
if (
  !validators.includes('"validate-domain-stats.mjs"')
  || !statsDomainValidators.includes('"validate-stats-animation-owner.mjs"')
) {
  throw new Error("The post-#184 single Stats animation ownership validation must remain active through the Stats domain suite.");
}

console.log("Stats navigation lifecycle validation passed.");
