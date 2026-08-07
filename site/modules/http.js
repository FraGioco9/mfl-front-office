// @ts-check

const nativeFetch = window.fetch.bind(window);
const DEFAULT_TIMEOUT_MS = 60_000;

/** @param {RequestInfo | URL} input */
function isSameOriginApiRequest(input) {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/**
 * Install one request policy for same-origin API calls made by the legacy and modular clients.
 * Existing caller signals are preserved; calls without a signal receive a bounded timeout.
 * @param {{timeoutMs?: number}} [options]
 */
export function installApiFetchPolicy({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (window.__mflApiFetchPolicyInstalled) return;
  window.__mflApiFetchPolicyInstalled = true;

  window.fetch = async (input, init = {}) => {
    if (!isSameOriginApiRequest(input)) {
      return nativeFetch(input, init);
    }

    const requestInit = { ...init };
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers || undefined).forEach((value, key) => headers.set(key, value));
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    requestInit.headers = headers;

    const callerSignal = init.signal || (input instanceof Request ? input.signal : null);
    if (callerSignal) {
      requestInit.signal = callerSignal;
      return nativeFetch(input, requestInit);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    requestInit.signal = controller.signal;
    try {
      return await nativeFetch(input, requestInit);
    } finally {
      window.clearTimeout(timer);
    }
  };
}

/**
 * Fetch JSON and turn non-2xx responses into consistent errors.
 * @template T
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<T>}
 */
export async function requestJson(input, init = {}) {
  const response = await window.fetch(input, init);
  /** @type {any} */
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && typeof payload.error === "string"
      ? payload.error
      : `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return /** @type {T} */ (payload);
}
