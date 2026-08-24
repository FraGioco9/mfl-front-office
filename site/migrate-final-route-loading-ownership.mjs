// Temporary one-shot Step 3 loading-ownership migration; removed by its workflow before commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (relative) => String(await readFile(resolve(root, relative), "utf8")).replace(/\r\n?/g, "\n");
const write = async (relative, source) => writeFile(resolve(root, relative), source);

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
}

let bootstrap = await read("bootstrap-core.js");
bootstrap = replaceRequired(bootstrap, '      "switchWatchlist",\n', "", "switchWatchlist route-loading alias");
bootstrap = replaceRequired(bootstrap, '      "ensureProgressionData",\n', "", "ensureProgressionData route-loading alias");
bootstrap = replaceRequired(
  bootstrap,
  `      [\n        "switchWatchlist",\n        "ensureProgressionData",\n      ].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));\n`,
  "",
  "remaining blanket route-data wrapper block",
);
await write("bootstrap-core.js", bootstrap);

let loading = await read("validate-loading-ownership.mjs");
loading = replaceRequired(loading, '  "switchWatchlist",\n', "", "loading validator switchWatchlist alias");
loading = replaceRequired(loading, '  "ensureProgressionData",\n', "", "loading validator ensureProgressionData alias");
loading = replaceRequired(
  loading,
  `invariant(\n  !bootstrapCore.includes('\"requestIncrementalRoute\",'),\n  "Incremental requests must not be blanket-wrapped outside their cache-aware request owner.",\n);`,
  `for (const name of ["switchWatchlist", "ensureProgressionData"]) {\n  invariant(\n    !bootstrapCore.includes(\`"\${name}"\`),\n    \`\${name} must not retain a bootstrap blanket route-loading alias or wrapper.\`,\n  );\n}\ninvariant(\n  appCoreSource.includes("function switchWatchlist(watchlistId) {")\n    && appCoreSource.includes("saveTableState();\\n  applyFilters();"),\n  "Direct Watchlist switching must remain a source-owned local state/filter transition.",\n);\ninvariant(\n  appCoreSource.includes("const loaded = await ensureProgressionData();"),\n  "The legacy full-data fallback must remain internal to the canonical setPage owner.",\n);\ninvariant(\n  !bootstrapCore.includes('\"requestIncrementalRoute\",'),\n  "Incremental requests must not be blanket-wrapped outside their cache-aware request owner.",\n);`,
  "loading validator source-owned route-data boundary",
);
await write("validate-loading-ownership.mjs", loading);

let bootstrapValidator = await read("validate-bootstrap-ownership.mjs");
bootstrapValidator = replaceRequired(bootstrapValidator, '  "switchWatchlist",\n', "", "bootstrap validator switchWatchlist alias");
bootstrapValidator = replaceRequired(bootstrapValidator, '  "ensureProgressionData",\n', "", "bootstrap validator ensureProgressionData alias");
bootstrapValidator = replaceRequired(
  bootstrapValidator,
  `for (const name of ["switchWatchlist", "ensureProgressionData"]) {\n  includes(\n    bootstrapCore,\n    \`"\${name}"\`,\n    \`The remaining direct route-data owner \${name} must retain canonical route loading until its cache contract is migrated.\`,\n  );\n}\n`,
  `for (const name of ["switchWatchlist", "ensureProgressionData"]) {\n  excludes(\n    bootstrapCore,\n    \`"\${name}"\`,\n    \`\${name} must not retain a bootstrap blanket route-loading alias or wrapper after Step 3 consolidation.\`,\n  );\n}\n`,
  "bootstrap validator remaining route-data wrapper loop",
);
bootstrapValidator = replaceRequired(
  bootstrapValidator,
  `includes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "Direct Watchlist/progression data owners must retain canonical route loading until their cache contracts are migrated.",\n);\n`,
  `includes(\n  appCoreSource,\n  "function switchWatchlist(watchlistId) {",\n  "Direct Watchlist switching must remain source-owned after blanket loading removal.",\n);\nincludes(\n  appCoreSource,\n  "const loaded = await ensureProgressionData();",\n  "The legacy full-data fallback must remain enclosed by canonical setPage ownership.",\n);\n`,
  "bootstrap validator blanket wrapper assertion",
);
await write("validate-bootstrap-ownership.mjs", bootstrapValidator);

let watchlist = await read("validate-watchlist-route-core.mjs");
watchlist = replaceRequired(
  watchlist,
  `for (const reason of ["setPage", "switchWatchlist", "route-runtime", "ensureProgressionData"]) {\n  includes(\n    bootstrapCore,\n    \`"\${reason}"\`,\n    \`Watchlist loading classification must retain \${reason} as a canonical route-loading alias or wrapped route owner.\`,\n  );\n}\n`,
  `includes(bootstrapCore, '"route-runtime"', "Legacy route-runtime requests must still normalize into canonical route loading.");\nexcludes(bootstrapCore, '"switchWatchlist"', "Direct Watchlist switching must not retain a blanket route-loading alias.");\nexcludes(bootstrapCore, '"ensureProgressionData"', "The setPage-owned full-data fallback must not retain a separate route-loading alias.");\n`,
  "Watchlist legacy loading classification loop",
);
watchlist = replaceRequired(
  watchlist,
  `includes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "The global loading bridge must wrap direct Watchlist switches and remaining page owners with route loading.",\n);\n`,
  `excludes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "The global loading bridge must not blanket-wrap direct Watchlist or fallback progression operations.",\n);\nincludes(\n  coreSource,\n  "function switchWatchlist(watchlistId) {",\n  "Direct Watchlist switching must remain a local source-owned operation.",\n);\n`,
  "Watchlist blanket bridge assertion",
);
watchlist = replaceRequired(
  watchlist,
  `  "Direct Watchlist changes may retain request deduping, but their final owner must be wrapped by the Uniform Loading Workflow.",`,
  `  "Direct Watchlist changes may retain single-filter deduping without acquiring route-loading presentation.",`,
  "Watchlist switch ownership message",
);
await write("validate-watchlist-route-core.mjs", watchlist);

console.log("Removed remaining blanket route-data loading ownership and migrated validators.");
