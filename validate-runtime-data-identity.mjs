import { createRequire } from "node:module";
import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const require = createRequire(import.meta.url);
const release = require("./release.json");
const { runtimeDataIdentity } = require("./api/_runtime-data-identity");
const { snapshotEtag, requestMatchesEtag } = require("./api/_http-cache");
const read = (path) => readValidationText(path, import.meta.url);

const generatedAt = "2026-09-09T12:00:00.000Z";
const identity = runtimeDataIdentity(generatedAt);
invariant(identity.runtime.version === release.version, "Runtime identity must use the canonical release.json version.");
invariant(identity.runtime.description === release.description, "Runtime identity must use the canonical release.json description.");
invariant(identity.database.generatedAt === generatedAt, "Runtime identity must preserve the database generation exactly.");

let invalidGeneratedAtRejected = false;
try {
  runtimeDataIdentity("not-a-date");
} catch {
  invalidGeneratedAtRejected = true;
}
invariant(invalidGeneratedAtRejected, "Runtime/data identity must reject invalid database generations.");

const baseEtag = snapshotEtag(identity.runtime.version, identity.runtime.description, identity.database.generatedAt);
invariant(baseEtag === snapshotEtag(identity.runtime.version, identity.runtime.description, identity.database.generatedAt), "Runtime/data identity ETags must be deterministic.");
invariant(baseEtag !== snapshotEtag(`${identity.runtime.version}-next`, identity.runtime.description, identity.database.generatedAt), "Runtime release changes must invalidate the runtime/data identity ETag.");
invariant(baseEtag !== snapshotEtag(identity.runtime.version, identity.runtime.description, "2026-09-09T13:00:00.000Z"), "Database generation changes must invalidate the runtime/data identity ETag.");
invariant(requestMatchesEtag({ headers: { "if-none-match": baseEtag } }, baseEtag), "Strong If-None-Match values must revalidate runtime/data identity.");
invariant(requestMatchesEtag({ headers: { "if-none-match": `W/${baseEtag}` } }, baseEtag), "Weak If-None-Match values must revalidate runtime/data identity.");

const [identityApi, dataApi] = await Promise.all([
  read("./api/identity.js"),
  read("./api/data.js"),
]);
invariant(
  identityApi.includes("runtimeDataIdentity(getGeneratedAt())")
    && identityApi.includes("PUBLIC_REVALIDATE_CACHE_CONTROL")
    && identityApi.includes("sendNotModified(response, startedAt, timings, cacheOptions);"),
  "The public identity endpoint must combine canonical runtime/data identity with conditional revalidation.",
);
invariant(
  dataApi.includes('require("./_http-cache")')
    && !dataApi.includes('require("node:crypto")'),
  "Public data snapshots and runtime/data identity must share one HTTP ETag owner.",
);

console.log("Canonical runtime and database release identity validation passed.");
