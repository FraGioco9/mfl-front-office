const SAFE_CODE = /^[a-z][a-z0-9_]{1,63}$/;

const STATUS_CODES = Object.freeze({
  400: "invalid_request",
  401: "authentication_required",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  408: "request_timeout",
  409: "conflict",
  413: "payload_too_large",
  422: "validation_failed",
  429: "rate_limited",
  500: "internal_error",
  502: "bad_gateway",
  503: "service_unavailable",
  504: "gateway_timeout",
});

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);

function stableErrorCode(status, explicitCode = "") {
  const normalized = String(explicitCode || "").trim().toLowerCase();
  if (SAFE_CODE.test(normalized)) return normalized;
  return STATUS_CODES[Number(status)] || "request_failed";
}

function retryableStatus(status) {
  return RETRYABLE_STATUS.has(Number(status));
}

function retryAfterSeconds(response) {
  const raw = String(response?.getHeader?.("Retry-After") || "").trim();
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.ceil(parsed));
}

function installApiErrorEnvelope(response) {
  if (!response || typeof response.json !== "function" || response.__mflErrorEnvelopeInstalled) {
    return response;
  }

  const originalJson = response.json.bind(response);
  Object.defineProperty(response, "__mflErrorEnvelopeInstalled", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  response.json = (payload) => {
    const status = Number(response.statusCode || 200);
    if (status < 400 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return originalJson(payload);
    }

    const legacyMessage = typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : "Request failed.";
    const code = stableErrorCode(status, payload.code);
    const retryAfter = retryAfterSeconds(response);
    const normalized = {
      ...payload,
      error: legacyMessage,
      code,
      retryable: typeof payload.retryable === "boolean"
        ? payload.retryable
        : retryableStatus(status),
      ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
    };

    response.setHeader?.("Cache-Control", "no-store");
    response.setHeader?.("X-MFL-Error-Code", code);
    return originalJson(normalized);
  };

  return response;
}

module.exports = {
  installApiErrorEnvelope,
  retryableStatus,
  stableErrorCode,
};
