import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { invariant } from "./validation/assertions.mjs";
import { outputFileTracingIncludes } from "./next.config.mjs";

const require = createRequire(import.meta.url);
const {
  DATABASE_FRESHNESS_MAX_AGE_MS,
  MARKETPLACE_FRESHNESS_MAX_AGE_MS,
  REPEATED_FAILURE_THRESHOLD,
  timestampAge,
  refreshHealth,
  operationalHealthSnapshot,
} = require("./api/_operational-health.js");

const now = Date.parse("2026-09-16T20:00:00Z");

invariant(
  DATABASE_FRESHNESS_MAX_AGE_MS === 13 * 60 * 60 * 1000,
  "Database operational freshness must allow the longest normal overnight scheduler gap plus recovery margin.",
);
invariant(
  MARKETPLACE_FRESHNESS_MAX_AGE_MS === 2 * 60 * 60 * 1000,
  "Marketplace operational freshness must tolerate the full reconcile window without retaining the old 24-hour monitoring blind spot.",
);
invariant(
  REPEATED_FAILURE_THRESHOLD === 2,
  "Operational health must distinguish one recoverable scheduled failure from repeated failures.",
);

invariant(
  timestampAge("2026-09-16T08:00:01Z", now, DATABASE_FRESHNESS_MAX_AGE_MS).status === "fresh"
    && timestampAge("2026-09-16T06:59:59Z", now, DATABASE_FRESHNESS_MAX_AGE_MS).status === "stale",
  "Database freshness must switch at the 13-hour boundary.",
);
invariant(
  timestampAge("2026-09-16T18:00:01Z", now, MARKETPLACE_FRESHNESS_MAX_AGE_MS).status === "fresh"
    && timestampAge("2026-09-16T17:59:59Z", now, MARKETPLACE_FRESHNESS_MAX_AGE_MS).status === "stale",
  "Marketplace freshness must switch at the two-hour boundary.",
);

const oneFailure = refreshHealth({
  lastOutcome: "failure",
  lastAttemptAt: "2026-09-16T19:45:00Z",
  lastSuccessAt: "2026-09-16T19:30:00Z",
  consecutiveFailures: 1,
  occurrenceKey: "one",
  runId: "10",
}, now, MARKETPLACE_FRESHNESS_MAX_AGE_MS);
const repeatedFailure = refreshHealth({
  lastOutcome: "failure",
  lastAttemptAt: "2026-09-16T19:45:00Z",
  lastSuccessAt: "2026-09-16T19:15:00Z",
  consecutiveFailures: 2,
  occurrenceKey: "two",
  runId: "11",
}, now, MARKETPLACE_FRESHNESS_MAX_AGE_MS);
invariant(oneFailure.status === "retrying", "One scheduled failure must remain visible as retrying.");
invariant(repeatedFailure.status === "degraded", "Two consecutive scheduled failures must be degraded.");
invariant(
  refreshHealth({
    lastOutcome: "failure",
    lastAttemptAt: "2026-09-16T17:00:00Z",
    lastSuccessAt: "2026-09-16T16:45:00Z",
    consecutiveFailures: 1,
  }, now, MARKETPLACE_FRESHNESS_MAX_AGE_MS).status === "stale",
  "An old single-failure marker must age into stale instead of remaining retrying forever.",
);

const healthy = operationalHealthSnapshot({
  databaseGeneratedAt: "2026-09-16T12:00:00Z",
  marketplacePayload: { generated_at: "2026-09-16T19:45:00Z" },
  databaseMarker: {
    lastOutcome: "success",
    lastAttemptAt: "2026-09-16T19:03:00Z",
    lastSuccessAt: "2026-09-16T19:03:00Z",
    consecutiveFailures: 0,
  },
  marketplaceMarker: {
    lastOutcome: "success",
    lastAttemptAt: "2026-09-16T19:45:00Z",
    lastSuccessAt: "2026-09-16T19:45:00Z",
    consecutiveFailures: 0,
  },
  now,
});
invariant(healthy.status === "healthy", "Fresh data and successful scheduled markers must be healthy.");

const warning = operationalHealthSnapshot({
  ...healthy,
  databaseGeneratedAt: "2026-09-16T12:00:00Z",
  marketplacePayload: { generated_at: "2026-09-16T19:45:00Z" },
  databaseMarker: {
    lastOutcome: "success",
    lastAttemptAt: "2026-09-16T19:03:00Z",
    lastSuccessAt: "2026-09-16T19:03:00Z",
    consecutiveFailures: 0,
  },
  marketplaceMarker: {
    lastOutcome: "failure",
    lastAttemptAt: "2026-09-16T19:45:00Z",
    lastSuccessAt: "2026-09-16T19:30:00Z",
    consecutiveFailures: 1,
  },
  now,
});
invariant(warning.status === "warning", "A single scheduled failure must surface as an operational warning.");

invariant(
  Array.isArray(outputFileTracingIncludes["/api/operational-health"])
    && outputFileTracingIncludes["/api/operational-health"].includes("./api/data-files/mfl_database.db"),
  "Operational health must package the SQLite database needed for database freshness.",
);

const [databaseWorkflow, marketplaceWorkflow, marketplaceState, docs] = await Promise.all([
  readFile(new URL("./.github/workflows/full-database-refresh.yml", import.meta.url), "utf8"),
  readFile(new URL("./.github/workflows/mfl-marketplace-snapshot.yml", import.meta.url), "utf8"),
  readFile(new URL("./api/_marketplace-state.js", import.meta.url), "utf8"),
  readFile(new URL("./docs/operational-health-969.md", import.meta.url), "utf8"),
]);

for (const [name, source, surface] of [
  ["database", databaseWorkflow, "database"],
  ["Marketplace", marketplaceWorkflow, "marketplace"],
]) {
  invariant(
    source.includes("python -m scripts.operations.runtime_health")
      && source.includes(`--surface ${surface}`)
      && source.includes("SUPABASE_SERVICE_ROLE_KEY")
      && source.includes("continue-on-error: true"),
    `${name} scheduled refresh must publish a non-blocking operational health marker.`,
  );
}
invariant(
  databaseWorkflow.includes("needs.resolve-refresh-trigger.outputs.trigger_source == 'supabase-cron'"),
  "Database health markers must be owned only by Supabase-Cron production dispatches.",
);
invariant(
  marketplaceWorkflow.includes("inputs.trigger_source == 'supabase-cron'"),
  "Marketplace health markers must be owned only by Supabase-Cron production dispatches.",
);
invariant(
  marketplaceState.includes("const MARKETPLACE_MAX_AGE_MS = 24 * 60 * 60 * 1000;"),
  "Operational monitoring must not silently change the existing 24-hour Marketplace product fail-closed cutoff.",
);
for (const phrase of [
  "Database freshness warning: **13 hours**",
  "Marketplace freshness warning: **2 hours**",
  "Repeated refresh failure: **2 consecutive scheduled failures**",
  "existing 24-hour fail-closed listing cutoff is unchanged",
]) {
  invariant(docs.includes(phrase), "Operational health documentation must retain thresholds and product-behavior separation.");
}

console.log("Operational freshness and repeated-refresh-failure validation passed.");
