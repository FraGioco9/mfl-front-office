import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import nextConfig, { createNextHeaders, createNextRewrites, outputFileTracingIncludes } from "./next.config.mjs";
import { deploymentCommitModulePath, materializeDeploymentCommit, resolveDeploymentCommit, writeDeploymentCommit } from "./deployment-commit.mjs";
import { verifyPrebuiltDeploymentCommit } from "./scripts/workflows/verify-prebuilt-deployment-commit.mjs";
import { verifyNextBuildDeploymentCommit } from "./scripts/workflows/verify-next-build-deployment-commit.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [
  packageSource,
  vercelIgnore,
  siteUpdateWorkflow,
  siteQualityWorkflow,
  checkpointPublisher,
  deepRoutePage,
  vercelConfigSource,
  identityRecorder,
  deploymentVerifier,
  prebuiltVerifier,
] = await Promise.all([
  read("package.json"),
  read(".vercelignore"),
  read(".github/workflows/vercel-site-update.yml"),
  read(".github/workflows/site-quality.yml"),
  read("scripts/workflows/full-database-refresh-publish-checkpoint.sh"),
  read("pages/[...path].js"),
  read("vercel.json"),
  read("scripts/workflows/record-production-identity.sh"),
  read("scripts/workflows/verify-live-production-deployment.sh"),
  read("scripts/workflows/verify-prebuilt-deployment-commit.mjs"),
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
  siteQualityWorkflow.includes('write-deployment-commit.mjs "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"')
    && siteQualityWorkflow.includes('verify-next-build-deployment-commit.mjs "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"'),
  "Site Quality must prove the explicit deployment commit survives a real Next build and runtime.",
);
invariant(
  siteUpdateWorkflow.includes("Record expected production identity")
    && siteUpdateWorkflow.includes("EXPECTED_SITE_SHA: ${{ github.sha }}")
    && siteUpdateWorkflow.includes('write-deployment-commit.mjs "$GITHUB_SHA"')
    && siteUpdateWorkflow.includes('verify-prebuilt-deployment-commit.mjs "$GITHUB_SHA"')
    && siteUpdateWorkflow.includes("verify-live-production-deployment.sh")
    && siteUpdateWorkflow.includes("production-deployment-identity-${{ github.run_id }}"),
  "Normal site deployment must record, embed, verify and retain the source/version/database identity tuple.",
);
invariant(
  checkpointPublisher.includes('DEPLOYMENT_ROOT=production-site EXPECTED_SITE_SHA="$EXPECTED_SHA"')
    && checkpointPublisher.includes('write-deployment-commit.mjs" "$EXPECTED_SHA"')
    && checkpointPublisher.includes('verify-prebuilt-deployment-commit.mjs" "$EXPECTED_SHA"')
    && checkpointPublisher.includes('ALLOW_VERCEL_ACTION_DEPLOY=1 vercel build')
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
const fixtureRoot = await mkdtemp(join(tmpdir(), "mfl-deployment-commit-"));
try {
  const fixtureCommit = "a".repeat(40);
  writeDeploymentCommit(fixtureCommit, { root: fixtureRoot });
  invariant(
    resolveDeploymentCommit({ root: fixtureRoot, env: {} }) === fixtureCommit,
    "Deployment commit files must round-trip through the canonical build owner.",
  );
  const fixtureCommitModule = await readFile(deploymentCommitModulePath(fixtureRoot), "utf8");
  invariant(
    fixtureCommitModule === `module.exports = "${fixtureCommit}";\n`,
    "Deployment commit binding must materialize the exact source SHA into the API bundle input.",
  );
  invariant(
    materializeDeploymentCommit({
      root: fixtureRoot,
      env: {},
      repositoryCommit: "c".repeat(40),
    }) === fixtureCommit,
    "Explicit deployment commit binding must take precedence over the local repository fallback.",
  );
  const localFixtureRoot = resolve(fixtureRoot, "local-runtime");
  await mkdir(localFixtureRoot, { recursive: true });
  const localFixtureCommit = "c".repeat(40);
  invariant(
    materializeDeploymentCommit({
      root: localFixtureRoot,
      env: {},
      repositoryCommit: localFixtureCommit,
    }) === localFixtureCommit
      && (await readFile(deploymentCommitModulePath(localFixtureRoot), "utf8"))
        === `module.exports = "${localFixtureCommit}";\n`,
    "Local runtime preparation must materialize the repository commit when no explicit deployment binding exists.",
  );
  let mismatchRejected = false;
  try {
    resolveDeploymentCommit({ root: fixtureRoot, env: { MFL_DEPLOY_COMMIT: "b".repeat(40) } });
  } catch {
    mismatchRejected = true;
  }
  invariant(mismatchRejected, "Conflicting deployment commit owners must fail closed.");

  let malformedRejected = false;
  try {
    writeDeploymentCommit("not-a-commit", { root: fixtureRoot });
  } catch {
    malformedRejected = true;
  }
  invariant(malformedRejected, "Malformed deployment commit inputs must fail before build.");
  invariant(
    (await readFile(deploymentCommitModulePath(fixtureRoot), "utf8")) === fixtureCommitModule,
    "Rejected deployment commit writes must not corrupt the previously materialized API bundle identity.",
  );

  const fixtureNextManifest = resolve(fixtureRoot, ".next/required-server-files.json");
  await mkdir(resolve(fixtureRoot, ".next"), { recursive: true });
  await writeFile(
    fixtureNextManifest,
    JSON.stringify({ config: { env: { MFL_DEPLOY_COMMIT: fixtureCommit } } }),
  );
  invariant(
    await verifyNextBuildDeploymentCommit({ expected: fixtureCommit, manifestPath: fixtureNextManifest }) === fixtureCommit,
    "Next build manifest verification must preserve the exact source commit.",
  );

  const fixtureFunctions = resolve(fixtureRoot, ".vercel/output/functions");
  const fixtureIdentityFunction = resolve(fixtureFunctions, "api/identity.func");
  await mkdir(fixtureIdentityFunction, { recursive: true });
  await writeFile(resolve(fixtureIdentityFunction, "index.js"), `module.exports = "${fixtureCommit}";\n`);
  invariant(
    await verifyPrebuiltDeploymentCommit({ expected: fixtureCommit, functionsRoot: fixtureFunctions }) === fixtureIdentityFunction,
    "Prebuilt deployment verification must accept an identity function containing the exact source commit.",
  );
  await writeFile(resolve(fixtureIdentityFunction, "index.js"), "module.exports = null;\n");
  let missingCommitRejected = false;
  try {
    await verifyPrebuiltDeploymentCommit({ expected: fixtureCommit, functionsRoot: fixtureFunctions });
  } catch {
    missingCommitRejected = true;
  }
  invariant(missingCommitRejected, "Prebuilt deployment verification must reject an identity function that lost its source commit.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
invariant(
  prebuiltVerifier.includes("identity.func")
    && prebuiltVerifier.includes(".vercel/output/functions")
    && prebuiltVerifier.includes("verifyPrebuiltDeploymentCommit"),
  "Production deploys must retain the canonical prebuilt identity verifier.",
);

invariant(
  !siteUpdateWorkflow.includes("ensure-vercel-remote-project-root.mjs"),
  "Normal site deployment must not require privileged Vercel project-setting mutation.",
);

console.log("Next.js/Vercel deployment ownership and production identity verification passed.");
