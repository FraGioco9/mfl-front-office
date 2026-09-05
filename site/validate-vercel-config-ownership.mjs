import { serializeVercelConfig } from "./vercel-config-source.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [development, production, packageJson, vercelIgnore, siteUpdateWorkflow] = await Promise.all([
  read("./vercel.json"),
  read("./vercel.production.json"),
  read("./package.json"),
  read("../.vercelignore"),
  read("../.github/workflows/vercel-site-update.yml"),
]);

invariant(development === serializeVercelConfig(), "vercel.json must be generated exactly from the canonical Vercel config source.");
invariant(production === serializeVercelConfig({ production: true }), "vercel.production.json must be generated exactly from the canonical Vercel config source.");

const devConfig = JSON.parse(development);
const prodConfig = JSON.parse(production);
invariant(JSON.stringify(devConfig.functions) === JSON.stringify(prodConfig.functions), "Development and production Vercel configs must share one function packaging contract.");
invariant(JSON.stringify(devConfig.rewrites) === JSON.stringify(prodConfig.rewrites), "Development and production Vercel configs must share one rewrite contract.");
invariant(
  prodConfig.headers.some((entry) => entry.source === "/modules/app-core-runtime.js"
    && entry.has?.some((condition) => condition.type === "query" && condition.key === "mfl_core")
    && entry.headers?.some((header) => header.key === "Cache-Control" && header.value.includes("immutable"))),
  "Production Vercel config must preserve immutable caching for versioned app-core-runtime requests.",
);
invariant(
  !devConfig.headers.some((entry) => entry.source === "/modules/app-core-runtime.js" && entry.has),
  "Development Vercel config must not apply the production immutable-cache query contract.",
);
invariant(
  packageJson.includes('"build:config": "node build-vercel-config.mjs"')
    && packageJson.includes("vercel.json vercel.production.json")
    && packageJson.includes('"build": "npm run build:config && npm run build:core && npm run build:styles"'),
  "Package scripts must generate and verify both Vercel configs from the canonical owner.",
);
invariant(
  vercelIgnore.includes("site/build-vercel-config.mjs")
    && vercelIgnore.includes("site/vercel-config-source.mjs")
    && vercelIgnore.includes("site/vercel.production.json"),
  "Vercel config compiler/source and deployment-only production config must stay out of the production artifact.",
);
invariant(
  siteUpdateWorkflow.includes("node site/build-vercel-config.mjs")
    && siteUpdateWorkflow.includes("--local-config site/vercel.production.json"),
  "Explicit site deployments must regenerate the canonical configs before using the production projection.",
);

console.log("Canonical Vercel config ownership and generated development/production projections passed.");
