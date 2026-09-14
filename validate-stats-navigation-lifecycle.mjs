import { readFile } from "node:fs/promises";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const source = await Promise.all([
  Promise.resolve(readCanonicalCoreSource("shared")),
  readFile(new URL("./modules/core-sources/evaluation.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/mfl-stats.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/club.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/settings.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/player.js", import.meta.url), "utf8"),
  Promise.resolve(readCanonicalCoreSource("table")),
  readFile(new URL("./modules/core-sources/wallet.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/watchlist.js", import.meta.url), "utf8"),
]).then((parts) => parts.join("\n"));
const runtime = await readFile(new URL("./modules/app-core-runtime.js", import.meta.url), "utf8");
const stateRuntime = await readFile(new URL("./database-stats-state-runtime.js", import.meta.url), "utf8");
const validators = await readFile(new URL("./validate-all.mjs", import.meta.url), "utf8");
const statsDomainValidators = await readFile(new URL("./validate-domain-stats.mjs", import.meta.url), "utf8");

for (const retiredOwner of ["normalizeStatsNavigationLifecycle", "statsNavigationArtifacts", "app-core-build-normalizer"]) {
  if (source.includes(retiredOwner) || runtime.includes(retiredOwner)) {
    throw new Error(`Stats navigation must remain source-owned without retired build owner ${retiredOwner}.`);
  }
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

console.log("Source-owned Stats navigation lifecycle validation passed.");
