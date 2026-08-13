import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const readSite = (path) => readFile(resolve(siteRoot, path), "utf8");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function matches(source, pattern, message) {
  invariant(pattern.test(source), message);
}

function excludes(source, pattern, message) {
  invariant(!pattern.test(source), message);
}

async function mustNotExist(path, message) {
  try {
    await access(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

const release = JSON.parse(await readSite("release.json"));
invariant(/^\d+\.\d+\.\d+$/.test(release.version), "release.json must contain a Semantic Version.");
invariant(String(release.description || "").trim().length > 20, "release.json must contain a useful description.");

const packageManifest = JSON.parse(await readSite("package.json"));
invariant(
  String(packageManifest.dependencies?.["@onflow/fcl"] || "").trim(),
  "package.json must keep @onflow/fcl as a runtime dependency for server-side Dapper proof verification.",
);
const dataAuth = await readSite("api/_data-auth.js");
matches(dataAuth, /require\(["']@onflow\/fcl["']\)/, "The data API must verify Dapper proofs with @onflow/fcl.");

const bridge = await readSite("bootstrap.js");
const staticVersion = bridge.match(/const\s+STATIC_RELEASE_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1];
invariant(staticVersion === release.version, `bootstrap.js release ${staticVersion || "<missing>"} must match ${release.version}.`);
matches(bridge, /window\.__mflReleaseVersion\s*=\s*version;/, "bootstrap.js must remain the release-version owner.");
excludes(bridge, /searchParams\.set\(["'](?:v|dev|rev)["']/, "bootstrap.js must keep runtime asset URLs queryless.");

const entry = await readSite("modules/app-entry.js");
matches(entry, /loadClassicScript\(["']\/modules\/app-core\.js["']\)/, "app-entry.js must load the canonical application core directly.");
matches(entry, /link\.href\s*=\s*["']\/responsive\.css["'];/, "app-entry.js must load responsive.css from the site root.");
excludes(entry, /\?(?:v|dev|rev)=|searchParams\.set\(["'](?:v|dev|rev)["']/, "app-entry.js must keep runtime asset URLs queryless.");
excludes(entry, /window\.__mflReleaseVersion\s*=/, "app-entry.js must not overwrite the bootstrap-owned release version.");
excludes(entry, /loadPreparedClassicScript|executeClassicSource|loadPartitionedClassicScript/, "app-entry.js must not restore deprecated runtime loaders.");

for (const path of [
  "evaluation-layout-runtime.js",
  "global-search-runtime.js",
  "release-ui-runtime.js",
  "selection-refresh-reset-runtime.js",
  "selection-stack-runtime.js",
  "watchlist-myplayers-route-runtime.js",
]) {
  const source = await readSite(path);
  excludes(source, /window\.__mflReleaseVersion\s*=/, `${path} must not overwrite the global release version.`);
}

const vercel = JSON.parse(await readSite("vercel.json"));
const cacheHeaders = new Map(
  (vercel.headers || []).map((rule) => [
    rule.source,
    rule.headers?.find((header) => header.key === "Cache-Control")?.value,
  ]),
);
for (const source of ["/(.*\\.js)", "/(.*\\.css)", "/release.json"]) {
  invariant(cacheHeaders.get(source) === "no-store, max-age=0", `${source} must use the no-store cache policy.`);
}

const rewritten = JSON.parse(await readSite("releases-rewritten.json"));
invariant(Array.isArray(rewritten) && rewritten.length > 0, "releases-rewritten.json must contain release history.");
invariant(rewritten[0]?.[0] === `v${release.version}`, "Release history must start with the current release.");
invariant(new Set(rewritten.map(([version]) => version)).size === rewritten.length, "Release history must not contain duplicate versions.");
const releaseApi = await readSite("api/releases.js");
matches(releaseApi, /require\(["']\.\.\/releases-rewritten\.json["']\)/, "The releases API must serve rewritten release history.");
excludes(releaseApi, /releases-recent\.json/, "The releases API must not serve the development release history.");

const databaseRefresh = await readRepository(".github/workflows/full-database-refresh.yml");
matches(databaseRefresh, /--workflow\s+vercel-site-update\.yml/, "Database refreshes must resolve the last explicit site release.");
excludes(databaseRefresh, /--workflow\s+site-quality\.yml/, "Database refreshes must not publish the latest quality-check commit.");
matches(databaseRefresh, /Verify published frontend source is unchanged/, "Database refreshes must verify the published frontend source.");
matches(databaseRefresh, /cp builder\/site\/api\/_database\.js production-site\/site\/api\/_database\.js/, "Database refreshes must install the current SQLite runtime adapter.");
matches(databaseRefresh, /Verify live production database/, "Database refreshes must verify live SQLite freshness.");

const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
matches(siteDeploy, /release\.json/, "Site deployment must validate canonical release metadata.");
matches(siteDeploy, /vercel deploy --prod --yes --force/, "Site deployment must force the explicit production release.");

const preparer = await readRepository("prepare_runtime_database.py");
matches(preparer, /["']generated_at["']\s*:\s*generated_at/, "Runtime database preparation must write generated_at metadata.");
const databaseRuntime = await readSite("api/_database.js");
matches(databaseRuntime, /runtime_metadata/, "SQLite runtime must read runtime_metadata.");
matches(databaseRuntime, /\.get\(["']generated_at["']\)/, "SQLite runtime must expose generated_at freshness.");

for (const path of [
  "modules/core-runtime.js",
  "modules/http.js",
  "modules/release.js",
  "modules/runtime-loader.js",
  "my-players-refresh-view-runtime.js",
  "search-result-click-runtime.js",
  "selection-stack-source-v1.120.26.js",
  "v1-120-10-runtime.js",
  "v1-123-31-runtime.js",
]) {
  await mustNotExist(resolve(siteRoot, path), `${path} is deprecated and must stay removed.`);
}
await mustNotExist(resolve(siteRoot, "tests"), "site/tests must stay removed.");
await mustNotExist(resolve(siteRoot, "playwright.config.mjs"), "Playwright regression infrastructure must stay removed.");

console.log(`Repository validation passed for MFL Front Office v${release.version}.`);
