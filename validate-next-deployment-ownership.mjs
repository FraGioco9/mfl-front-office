import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextConfig, { createNextHeaders, createNextRewrites, outputFileTracingIncludes } from "./next.config.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [
  packageSource,
  vercelIgnore,
  siteUpdateWorkflow,
  checkpointPublisher,
  deepRoutePage,
  vercelConfigSource,
  identityRecorder,
  deploymentVerifier,
] = await Promise.all([
  read("package.json"),
  read(".vercelignore"),
  read(".github/workflows/vercel-site-update.yml"),
  read("scripts/workflows/full-database-refresh-publish-checkpoint.sh"),
  read("pages/[...path].js"),
  read("vercel.json"),
  read("scripts/workflows/record-production-identity.sh"),
  read("scripts/workflows/verify-live-production-deployment.sh"),
]);

const developmentHeaders = createNextHeaders({ production: false });
const productionHeaders = createNextHeaders({ production: true });
const rewrites = createNextRewrites();
const vercelConfig = JSON.parse(vercelConfigSource);
const vercelRewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
const shellRouteExpression = "mfl|database|progression|my-players|myplayers|my-clubs|myclubs|agents|watchlist|clubs|club|players|settings|changelog|privacy|evaluation";
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
invariant(
  vercelRewrites.some((rule) =>
    rule.source === "/evaluation"
      && rule.destination === "/api/evaluation-preview"
      && rule.has?.some((condition) => condition.type === "query" && condition.key === "share")
  ),
  "Vercel routing must preserve shared Evaluation preview requests before the SPA shell fallback.",
);
invariant(
  vercelRewrites.some((rule) =>
    rule.source === `/:app(${shellRouteExpression})`
      && rule.destination === "/index.html"
  )
    && vercelRewrites.some((rule) =>
      rule.source === `/:app(${shellRouteExpression})/:path*`
        && rule.destination === "/index.html"
    ),
  "Vercel routing must send canonical app roots and deep links to the SPA shell.",
);
invariant(
  !vercelRewrites.some((rule) => rule.source === "/api/:path*" && rule.destination === "/index.html"),
  "Vercel SPA routing must not swallow API routes.",
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
  Object.hasOwn(nextConfig.env || {}, "MFL_DEPLOY_COMMIT"),
  "Next build configuration must expose one build-bound deployment commit owner.",
);
invariant(
  siteUpdateWorkflow.includes("Record expected production identity")
    && siteUpdateWorkflow.includes("EXPECTED_SITE_SHA: ${{ github.sha }}")
    && siteUpdateWorkflow.includes("MFL_DEPLOY_COMMIT: ${{ github.sha }}")
    && siteUpdateWorkflow.includes("verify-live-production-deployment.sh")
    && siteUpdateWorkflow.includes("production-deployment-identity-${{ github.run_id }}"),
  "Normal site deployment must record, embed, verify and retain the source/version/database identity tuple.",
);
invariant(
  checkpointPublisher.includes('DEPLOYMENT_ROOT=production-site EXPECTED_SITE_SHA="$EXPECTED_SHA"')
    && checkpointPublisher.includes('MFL_DEPLOY_COMMIT="$EXPECTED_SHA" ALLOW_VERCEL_ACTION_DEPLOY=1 vercel build')
    && checkpointPublisher.includes("verify-live-production-deployment.sh")
    && checkpointPublisher.includes("deploymentIdentity:{siteCommit:$sourceSha,version:$version,databaseGeneratedAt:$generatedAt}"),
  "Database checkpoint publication must preserve the published site source identity and record it with the database generation.",
);
for (const token of [
  '"siteCommit": site_commit',
  '"version": version',
  '"commitVerificationRequired": commit_verification_required',
  '"generatedAt": generated_at',
  '"mfl-production-expected.json"',
]) {
  invariant(identityRecorder.includes(token), "Production identity recording must retain commit, release and database generation together.");
}
for (const route of ["/database", "/evaluation", "/players/374097", "/clubs/1/squad"]) {
  invariant(deploymentVerifier.includes(`"${route}"`), `Production verification must retain the representative route ${route}.`);
}
invariant(
  deploymentVerifier.includes('base_url + "/api/identity"')
    && deploymentVerifier.includes("runtime.get(\"commit\"")
    && deploymentVerifier.includes("runtime.get(\"version\"")
    && deploymentVerifier.includes("identity_database.get(\"generatedAt\"")
    && deploymentVerifier.includes('if \'id="appShell"\' not in body:'),
  "Production verification must bind the live runtime identity to the expected commit/version/database generation and canonical shell.",
);
invariant(
  !siteUpdateWorkflow.includes("ensure-vercel-remote-project-root.mjs"),
  "Normal site deployment must not require privileged Vercel project-setting mutation.",
);

console.log("Next.js/Vercel deployment ownership and production identity verification passed.");
