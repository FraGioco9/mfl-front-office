const { supabaseConfig, supabaseRequestSignal } = require("./_supabase");

const RUNTIME_BUCKET = "mfl-runtime";
const MARKETPLACE_OBJECT = "marketplace/listings.json";
const HEALTH_OBJECTS = Object.freeze({
  database: "health/database-refresh.json",
  marketplace: "health/marketplace-refresh.json",
});

const STORAGE_TIMEOUT_MS = 3_000;
const DATABASE_FRESHNESS_MAX_AGE_MS = 13 * 60 * 60 * 1000;
const MARKETPLACE_FRESHNESS_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const REPEATED_FAILURE_THRESHOLD = 2;

function objectUrl(config, objectPath) {
  const encoded = String(objectPath || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${config.url}/storage/v1/object/authenticated/${RUNTIME_BUCKET}/${encoded}`;
}

async function readRuntimeObject(objectPath) {
  const config = supabaseConfig();
  if (!config) return null;

  const response = await fetch(objectUrl(config, objectPath), {
    cache: "no-store",
    signal: supabaseRequestSignal(undefined, STORAGE_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.key}`,
      apikey: config.key,
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Runtime health storage returned ${response.status} for ${objectPath}.`);
  }
  return response.json();
}

async function safeRuntimeObject(objectPath) {
  try {
    const payload = await readRuntimeObject(objectPath);
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch (error) {
    console.warn("Could not read operational health object.", objectPath, error);
    return null;
  }
}

function timestampAge(generatedAt, now, maxAgeMs) {
  const text = String(generatedAt || "").trim();
  const timestamp = Date.parse(text);
  if (!text || !Number.isFinite(timestamp)) {
    return {
      status: "unknown",
      generatedAt: text || null,
      ageMs: null,
      maxAgeMs,
    };
  }

  const ageMs = Math.max(0, Number(now) - timestamp);
  return {
    status: ageMs <= maxAgeMs ? "fresh" : "stale",
    generatedAt: text,
    ageMs,
    maxAgeMs,
  };
}

function refreshHealth(marker, now, maxAgeMs) {
  const payload = marker && typeof marker === "object" && !Array.isArray(marker) ? marker : null;
  if (!payload) {
    return {
      status: "unknown",
      lastOutcome: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      consecutiveFailures: null,
      occurrenceKey: null,
      runId: null,
    };
  }

  const lastAttemptAt = String(payload.lastAttemptAt || "").trim();
  const lastAttemptMs = Date.parse(lastAttemptAt);
  if (!lastAttemptAt || !Number.isFinite(lastAttemptMs)) {
    return {
      status: "unknown",
      lastOutcome: String(payload.lastOutcome || "").trim() || null,
      lastAttemptAt: lastAttemptAt || null,
      lastSuccessAt: String(payload.lastSuccessAt || "").trim() || null,
      consecutiveFailures: Number.isInteger(payload.consecutiveFailures)
        ? Math.max(0, payload.consecutiveFailures)
        : null,
      occurrenceKey: String(payload.occurrenceKey || "").trim() || null,
      runId: String(payload.runId || "").trim() || null,
    };
  }

  const failures = Number.isInteger(payload.consecutiveFailures)
    ? Math.max(0, payload.consecutiveFailures)
    : 0;
  const ageMs = Math.max(0, Number(now) - lastAttemptMs);
  let status = "healthy";
  if (failures >= REPEATED_FAILURE_THRESHOLD) {
    status = "degraded";
  } else if (ageMs > maxAgeMs) {
    status = "stale";
  } else if (failures === 1) {
    status = "retrying";
  }

  return {
    status,
    lastOutcome: String(payload.lastOutcome || "").trim() || null,
    lastAttemptAt,
    lastSuccessAt: String(payload.lastSuccessAt || "").trim() || null,
    consecutiveFailures: failures,
    occurrenceKey: String(payload.occurrenceKey || "").trim() || null,
    runId: String(payload.runId || "").trim() || null,
  };
}

function overallStatus(parts) {
  const statuses = parts.map((part) => String(part?.status || "unknown"));
  if (statuses.some((status) => status === "stale" || status === "degraded")) return "degraded";
  if (statuses.includes("retrying")) return "warning";
  if (statuses.includes("unknown")) return "unknown";
  return "healthy";
}

function operationalHealthSnapshot({
  databaseGeneratedAt,
  marketplacePayload,
  databaseMarker,
  marketplaceMarker,
  now = Date.now(),
}) {
  const database = {
    freshness: timestampAge(databaseGeneratedAt, now, DATABASE_FRESHNESS_MAX_AGE_MS),
    refresh: refreshHealth(databaseMarker, now, DATABASE_FRESHNESS_MAX_AGE_MS),
  };
  const marketplace = {
    freshness: timestampAge(
      marketplacePayload?.generated_at,
      now,
      MARKETPLACE_FRESHNESS_MAX_AGE_MS,
    ),
    refresh: refreshHealth(marketplaceMarker, now, MARKETPLACE_FRESHNESS_MAX_AGE_MS),
  };

  return {
    status: overallStatus([
      database.freshness,
      database.refresh,
      marketplace.freshness,
      marketplace.refresh,
    ]),
    thresholds: {
      repeatedFailures: REPEATED_FAILURE_THRESHOLD,
      databaseFreshnessMaxAgeMs: DATABASE_FRESHNESS_MAX_AGE_MS,
      marketplaceFreshnessMaxAgeMs: MARKETPLACE_FRESHNESS_MAX_AGE_MS,
    },
    database,
    marketplace,
  };
}

async function loadOperationalHealth(databaseGeneratedAt, now = Date.now()) {
  const [marketplacePayload, databaseMarker, marketplaceMarker] = await Promise.all([
    safeRuntimeObject(MARKETPLACE_OBJECT),
    safeRuntimeObject(HEALTH_OBJECTS.database),
    safeRuntimeObject(HEALTH_OBJECTS.marketplace),
  ]);

  return operationalHealthSnapshot({
    databaseGeneratedAt,
    marketplacePayload,
    databaseMarker,
    marketplaceMarker,
    now,
  });
}

module.exports = {
  RUNTIME_BUCKET,
  MARKETPLACE_OBJECT,
  HEALTH_OBJECTS,
  DATABASE_FRESHNESS_MAX_AGE_MS,
  MARKETPLACE_FRESHNESS_MAX_AGE_MS,
  REPEATED_FAILURE_THRESHOLD,
  timestampAge,
  refreshHealth,
  overallStatus,
  operationalHealthSnapshot,
  loadOperationalHealth,
};
