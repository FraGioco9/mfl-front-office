const { createHash, randomUUID } = require("node:crypto");
const { resolveRuntimeDeploymentCommit } = require("./_runtime-data-identity");

const SAFE_LABEL = /^[A-Za-z0-9_.:-]{1,80}$/;
const SAFE_ERROR = /^[A-Za-z0-9_.:-]{1,64}$/;

function safeLabel(value) {
  const text = String(value || "").trim();
  return SAFE_LABEL.test(text) ? text : "";
}

function safeGeneration(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 80) return "";
  return Number.isNaN(Date.parse(text)) ? "" : text;
}

function safeCommit(value) {
  const text = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(text) ? text : "";
}

function runtimeCommit() {
  try {
    return safeCommit(resolveRuntimeDeploymentCommit());
  } catch {
    return "";
  }
}

function correlationDigest(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function errorMetadata(error) {
  const name = safeLabel(error?.name || error?.constructor?.name || "");
  const code = String(error?.code || "").trim();
  return {
    ...(name ? { errorType: name } : {}),
    ...(SAFE_ERROR.test(code) ? { errorCode: code } : {}),
  };
}

function createRequestLog(response, {
  category,
  commit = runtimeCommit(),
  logger = console,
  requestIdFactory = randomUUID,
  now = () => new Date(),
} = {}) {
  const normalizedCategory = safeLabel(category);
  if (!normalizedCategory) throw new Error("Request log category is required.");

  const requestId = String(requestIdFactory()).trim().toLowerCase();
  if (!/^[0-9a-f-]{32,36}$/.test(requestId)) {
    throw new Error("Request log id factory returned an invalid identifier.");
  }

  response?.setHeader?.("X-Request-Id", requestId);

  function write(level, event, fields = {}) {
    const normalizedEvent = safeLabel(event);
    if (!normalizedEvent) throw new Error("Request log event is required.");

    const status = Number(fields.status);
    const generation = safeGeneration(fields.generation);
    const occurrenceDigest = correlationDigest(fields.occurrenceKey);
    const idempotencyDigest = correlationDigest(fields.idempotencyKey);

    const entry = {
      timestamp: now().toISOString(),
      requestId,
      category: normalizedCategory,
      event: normalizedEvent,
      ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
      ...(safeCommit(commit) ? { commit: safeCommit(commit) } : {}),
      ...(generation ? { generation } : {}),
      ...(occurrenceDigest ? { occurrenceDigest } : {}),
      ...(idempotencyDigest ? { idempotencyDigest } : {}),
      ...errorMetadata(fields.error),
    };

    const line = JSON.stringify(entry);
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "info";
    if (typeof logger?.[method] === "function") logger[method](line);
    return entry;
  }

  return Object.freeze({
    requestId,
    info(event, fields) { return write("info", event, fields); },
    warn(event, fields) { return write("warn", event, fields); },
    error(event, fields) { return write("error", event, fields); },
  });
}

module.exports = {
  correlationDigest,
  createRequestLog,
  errorMetadata,
  safeGeneration,
};
