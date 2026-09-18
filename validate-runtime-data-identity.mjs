import { createRequire } from "node:module";
import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const require = createRequire(import.meta.url);
const release = require("./release.json");
const {
  normalizeDeploymentCommit,
  runtimeDataIdentity,
} = require("./api/_runtime-data-identity");
const { snapshotEtag, requestMatchesEtag } = require("./api/_http-cache");
const read = (path) => readValidationText(path, import.meta.url);

const generatedAt = "2026-09-09T12:00:00.000Z";
const commit = "60d702734951e4542f90a4fea29c7da2bef1ee18";
const identity = runtimeDataIdentity(generatedAt, { commit });
invariant(identity.runtime.version === release.version, "Runtime identity must use the canonical release.json version.");
invariant(identity.runtime.description === release.description, "Runtime identity must use the canonical release.json description.");
invariant(identity.runtime.commit === commit, "Runtime identity must preserve the exact build-bound deployment commit.");
invariant(identity.database.generatedAt === generatedAt, "Runtime identity must preserve the database generation exactly.");
invariant(normalizeDeploymentCommit(commit.toUpperCase()) === commit, "Deployment commits must normalize to lowercase.");

let invalidGeneratedAtRejected = false;
try {
  runtimeDataIdentity("not-a-date", { commit });
} catch {
  invalidGeneratedAtRejected = true;
}
invariant(invalidGeneratedAtRejected, "Runtime/data identity must reject invalid database generations.");

let invalidCommitRejected = false;
try {
  runtimeDataIdentity(generatedAt, { commit: "not-a-commit" });
} catch {
  invalidCommitRejected = true;
}
invariant(invalidCommitRejected, "Runtime/data identity must reject malformed deployment commits.");

const baseEtag = snapshotEtag(
  identity.runtime.version,
  identity.runtime.description,
  identity.runtime.commit,
  identity.database.generatedAt,
);
invariant(
  baseEtag === snapshotEtag(
    identity.runtime.version,
    identity.runtime.description,
    identity.runtime.commit,
    identity.database.generatedAt,
  ),
  "Runtime/data identity ETags must be deterministic.",
);
invariant(
  baseEtag !== snapshotEtag(
    identity.runtime.version,
    identity.runtime.description,
    "1111111111111111111111111111111111111111",
    identity.database.generatedAt,
  ),
  "Deployment commit changes must invalidate the runtime/data identity ETag.",
);
invariant(
  baseEtag !== snapshotEtag(
    `${identity.runtime.version}-next`,
    identity.runtime.description,
    identity.runtime.commit,
    identity.database.generatedAt,
  ),
  "Runtime release changes must invalidate the runtime/data identity ETag.",
);
invariant(
  baseEtag !== snapshotEtag(
    identity.runtime.version,
    identity.runtime.description,
    identity.runtime.commit,
    "2026-09-09T13:00:00.000Z",
  ),
  "Database generation changes must invalidate the runtime/data identity ETag.",
);
invariant(requestMatchesEtag({ headers: { "if-none-match": baseEtag } }, baseEtag), "Strong If-None-Match values must revalidate runtime/data identity.");
invariant(requestMatchesEtag({ headers: { "if-none-match": `W/${baseEtag}` } }, baseEtag), "Weak If-None-Match values must revalidate runtime/data identity.");

const [identityApi, runtimeIdentitySource, dataApi, nextConfig, runtimePreparation] = await Promise.all([
  read("./api/identity.js"),
  read("./api/_runtime-data-identity.js"),
  read("./api/data.js"),
  read("./next.config.mjs"),
  read("./prepare-next-runtime.mjs"),
]);
invariant(
  identityApi.includes("runtimeDataIdentity(getGeneratedAt())")
    && identityApi.includes("identity.runtime.commit || \"\"")
    && identityApi.includes("PUBLIC_REVALIDATE_CACHE_CONTROL")
    && identityApi.includes("sendNotModified(response, startedAt, timings, cacheOptions);"),
  "The public identity endpoint must combine canonical runtime/data identity with deployment commit and conditional revalidation.",
);
invariant(
  nextConfig.includes("MFL_DEPLOY_COMMIT: deploymentCommit") && nextConfig.includes("resolveDeploymentCommit({ root })"),
  "Next builds must bind the deployment commit into the server runtime identity.",
);
invariant(
  runtimeIdentitySource.includes('require("./_deployment-commit.generated")')
    && runtimeIdentitySource.includes("Bundled and environment deployment identities disagree."),
  "Runtime identity must prefer the build-materialized API commit while rejecting conflicting environment identity.",
);
invariant(
  runtimePreparation.includes("materializeDeploymentCommit({ root })"),
  "Next runtime preparation must materialize deployment identity before function packaging.",
);
invariant(
  dataApi.includes('require("./_http-cache")')
    && !dataApi.includes('require("node:crypto")'),
  "Public data snapshots and runtime/data identity must share one HTTP ETag owner.",
);

console.log("Canonical deployment, runtime and database release identity validation passed.");
