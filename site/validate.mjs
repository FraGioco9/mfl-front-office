invariant(localJsRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Local JavaScript must use the no-store cache policy.");
const productionJsNoStoreRule = (vercelProduction.headers || []).find((rule) => rule.source === "/(.*\\.js)" && rule.missing?.some((condition) => condition.type === "query" && condition.key === "mfl_core"));
invariant(productionJsNoStoreRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Production unversioned JavaScript must retain the no-store cache policy.");
const productionCoreCacheRule = (vercelProduction.headers || []).find((rule) => rule.source === "/modules/app-core-runtime.js" && rule.has?.some((condition) => condition.type === "query" && condition.key === "mfl_core"));
invariant(productionCoreCacheRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=31536000, immutable"), "Production versioned application core must retain immutable browser caching.");
await mustNotExist(resolve(siteRoot, "vercel.mjs"), "Programmatic Vercel config must stay removed so local development uses the static safe config.");

const databaseRefresh = await readRepository(".github/workflows/full-database-refresh.yml");
includes(databaseRefresh, "--workflow vercel-site-update.yml", "Database refreshes must resolve the last explicit site release.");
excludes(databaseRefresh, "--workflow site-quality.yml", "Database refreshes must not publish the latest quality-check commit.");

const siteDeploy = await readRepository(".github/workflows/vercel-site-update.yml");
includes(siteDeploy, "node site/build-app-core.mjs", "Vercel deployment must generate the canonical application core before upload.");
includes(siteDeploy, "test -s site/modules/app-core-runtime.js", "Vercel deployment must refuse to upload without the generated core.");
includes(siteDeploy, "working-directory: site", "Vercel deployment must run from the site project root.");
includes(siteDeploy, "vercel deploy --prod --yes --force", "Site deployment must force the explicit production release.");
includes(siteDeploy, "--local-config vercel.production.json", "Production deployment must use the dedicated production Vercel config relative to the site project root.");
excludes(siteDeploy, "--local-config site/vercel.production.json", "Production deployment must not address the Vercel config from the repository root.");

const siteQuality = await readRepository(".github/workflows/site-quality.yml");
includes(siteQuality, "npm run build:core", "Site quality must execute the same canonical core build used by deployment.");
includes(siteQuality, "npm run validate", "Site quality must validate the generated architecture after building it.");

const databaseRuntime = await readSite("api/_database.js");
includes(databaseRuntime, "runtime_metadata", "SQLite runtime must read runtime_metadata.");

for (const path of [
  "core-response-cache-runtime.js",