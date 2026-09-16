import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createNextHeaders, createNextRewrites, outputFileTracingIncludes } from "./next.config.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [packageSource, vercelIgnore, siteUpdateWorkflow, checkpointPublisher, deepRoutePage] = await Promise.all([
  read("package.json"),
  read(".vercelignore"),
  read(".github/workflows/vercel-site-update.yml"),
  read("scripts/workflows/full-database-refresh-publish-checkpoint.sh"),
  read("pages/[...path].js"),
]);

const developmentHeaders = createNextHeaders({ production: false });
const productionHeaders = createNextHeaders({ production: true });
const rewrites = createNextRewrites();
invariant(
  outputFileTracingIncludes["/api/data"]?.some((value) => String(value).includes("api/data-files/mfl_database.db")),
  "Next config must trace the SQLite database into database-backed routes.",
);
invariant(
  developmentHeaders.some((rule) => rule.source === "/:path*.js")
    && productionHeaders.some((rule) => rule.source === "/:path*.js" && rule.has?.some((condition) => condition.key === "mfl_core")),
  "Next config must own distinct development and production cache-header behavior.",
);
invariant(
  rewrites.beforeFiles?.some((rule) => rule.source === "/evaluation" && rule.destination === "/api/evaluation-preview")
    && rewrites.fallback?.some((rule) => rule.source === "/:path*" && rule.destination === "/index.html"),
  "Next config must own Evaluation routing and SPA fallback.",
);
invariant(
  deepRoutePage.includes("export function getServerSideProps()")
    && deepRoutePage.includes("return { props: {} };"),
  "Production deep routes must stay server-resolved so Vercel can match arbitrary direct app URLs.",
);
invariant(!packageSource.includes("build-vercel-config.mjs") && !packageSource.includes("vercel.production.json"), "Package scripts must not retain the legacy generated Vercel config model.");
invariant(!vercelIgnore.includes("html-sources") && !vercelIgnore.includes("modules/core-sources"), "Vercel uploads must retain sources required by next build.");

for (const source of [siteUpdateWorkflow, checkpointPublisher]) {
  invariant(source.includes("vercel pull") && source.includes("--environment=production"), "Production deployment must pull Vercel project settings/environment.");
  invariant(source.includes("vercel build --prod"), "Production deployment must create a production Vercel build.");
  invariant(source.includes("vercel deploy --prebuilt --prod"), "Production deployment must deploy the exact prebuilt Next artifact.");
  invariant(!source.includes("vercel.production.json"), "Production deployment must not use the retired static Vercel config projection.");
}

invariant(
  !siteUpdateWorkflow.includes("ensure-vercel-remote-project-root.mjs"),
  "Normal site deployment must not require privileged Vercel project-setting mutation.",
);

console.log("Next.js/Vercel deployment ownership validation passed.");
