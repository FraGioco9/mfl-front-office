import { invariant } from "./validation/assertions.mjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

const [developmentConfig, productionConfig] = await Promise.all([
  readJson("./vercel.json"),
  readJson("./vercel.production.json"),
]);

const coreRuntimePaths = [
  "./modules/app-core-runtime.js",
  "./modules/app-core-evaluation-runtime.js",
  "./modules/app-core-mfl-stats-runtime.js",
  "./modules/app-core-club-runtime.js",
  "./modules/app-core-settings-runtime.js",
  "./modules/app-core-player-runtime.js",
  "./modules/app-core-table-runtime.js",
  "./modules/app-core-wallet-runtime.js",
  "./modules/app-core-watchlist-runtime.js",
];
const [tableWidthRuntime, appEntry, bootstrap, ...coreRuntimes] = await Promise.all([
  readFile(new URL("./table-width-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/app-entry.js", import.meta.url), "utf8"),
  readFile(new URL("./bootstrap.js", import.meta.url), "utf8"),
  ...coreRuntimePaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
]);
const expectedCoreBuildId = createHash("sha256")
  .update(coreRuntimes.join("\n"))
  .digest("hex")
  .slice(0, 16);
const projectedCoreBuildId = tableWidthRuntime.match(/window\.__mflCoreBuildId = "([a-f0-9]{16})";/)?.[1] || "";
invariant(
  projectedCoreBuildId === expectedCoreBuildId,
  "The pre-bootstrap core build identity must be generated from the exact application-core artifacts.",
);
invariant(
  appEntry.includes("const immutableRevision = `${entryRelease.version}-${buildId}`;")
    && bootstrap.includes('url.searchParams.set("mfl_core", `${version}-${buildId}`);'),
  "Every immutable application-core request must combine the release version with the generated content identity.",
);

const headerRule = (config, source, predicate = () => true) =>
  (config.headers || []).find((rule) => rule?.source === source && predicate(rule));
const cacheControl = (rule) =>
  String((rule?.headers || []).find((header) => String(header?.key || "").toLowerCase() === "cache-control")?.value || "");
const hasQuery = (rule, field, key) =>
  Array.isArray(rule?.[field]) && rule[field].some((condition) => condition?.type === "query" && condition?.key === key);

for (const [name, config] of [
  ["development", developmentConfig],
  ["production", productionConfig],
]) {
  for (const source of ["/", "/index.html", "/release.json", "/releases.json"]) {
    invariant(
      cacheControl(headerRule(config, source)) === "no-store, max-age=0",
      `${name} ${source} must remain uncached so route shell and release metadata are always current.`,
    );
  }

  const cssPolicy = cacheControl(headerRule(config, "/(.*\\.css)"));
  invariant(
    cssPolicy === "public, max-age=0, must-revalidate",
    `${name} CSS must be cacheable with mandatory revalidation instead of no-store.`,
  );
}

const developmentJsPolicy = cacheControl(headerRule(developmentConfig, "/(.*\\.js)"));
invariant(
  developmentJsPolicy === "no-store, max-age=0",
  "Development JavaScript must remain uncached so local runtime edits cannot reuse stale code.",
);

const productionJsRule = headerRule(
  productionConfig,
  "/(.*\\.js)",
  (rule) => hasQuery(rule, "missing", "mfl_core"),
);
invariant(productionJsRule, "Production JavaScript must keep the generic non-versioned cache rule.");
invariant(
  cacheControl(productionJsRule) === "no-store, max-age=0",
  "Non-versioned production JavaScript must remain uncached.",
);

const versionedCoreRule = headerRule(
  productionConfig,
  "/modules/app-core-runtime.js",
  (rule) => hasQuery(rule, "has", "mfl_core"),
);
invariant(versionedCoreRule, "Production must retain the versioned application-core cache rule.");
invariant(
  cacheControl(versionedCoreRule) === "public, max-age=31536000, immutable",
  "Versioned application core must remain immutable for one year.",
);

console.log("Asset cache policy validation passed.");
