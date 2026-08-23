import { readFile } from "node:fs/promises";

const normalizer = await readFile(new URL("./modules/app-core-build-normalizer.js", import.meta.url), "utf8");
const owner = await readFile(new URL("./modules/app-core-stats-navigation-lifecycle.js", import.meta.url), "utf8");
const runtime = await readFile(new URL("./modules/app-core-runtime.js", import.meta.url), "utf8");
const stateRuntime = await readFile(new URL("./database-stats-state-runtime.js", import.meta.url), "utf8");
const validators = await readFile(new URL("./validate-all.mjs", import.meta.url), "utf8");

if (!normalizer.includes("normalizeStatsNavigationLifecycle")) {
  throw new Error("Stats navigation normalization is not part of the canonical application-core normalizer.");
}
if (!owner.includes('state.view === "stats"') || !owner.includes('await setPage("database", false')) {
  throw new Error("Database Stats does not own an explicit canonical exit to table views.");
}
if (!runtime.includes('state.currentPage === "database"\n      && state.view === "stats"')) {
  throw new Error("Generated application core is missing the Database Stats exit branch.");
}
if (stateRuntime.includes("interaction-loading") || stateRuntime.includes('document.addEventListener("pointerup"')) {
  throw new Error("Legacy Database Stats loading bridge must not return.");
}
if (!validators.includes('"validate-stats-animation-owner.mjs"')) {
  throw new Error("The post-#184 single Stats animation ownership validation must remain active.");
}

console.log("Stats navigation lifecycle validation passed.");
