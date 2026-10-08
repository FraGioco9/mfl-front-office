import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  installApiErrorEnvelope,
  normalizeApiErrorPayload,
  stableErrorCode,
} = require("../api/_error-envelope.js");

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    json(payload) { this.body = payload; return this; },
    headers,
  };
}

{
  const response = mockResponse();
  installApiErrorEnvelope(response);
  response.setHeader("Retry-After", "2");
  response.status(429).json({ error: "Too many requests." });
  assert.equal(response.body.error, "Too many requests.");
  assert.equal(response.body.code, "rate_limited");
  assert.equal(response.body.retryable, true);
  assert.equal(response.body.retryAfterSeconds, 2);
  assert.equal(response.getHeader("x-mfl-error-code"), "rate_limited");
  assert.match(response.getHeader("server-timing"), /api_error;dur=0/);
  assert.equal(response.getHeader("cache-control"), "no-store");
}

{
  const response = mockResponse();
  const body = normalizeApiErrorPayload(response, 409, { error: "Saved plan changed." });
  assert.deepEqual(body, {
    error: "Saved plan changed.",
    code: "conflict",
    retryable: false,
  });
  assert.equal(stableErrorCode(415), "unsupported_media_type");
}

const appEntry = await readFile(new URL("../modules/app-entry.js", import.meta.url), "utf8");
const end = appEntry.indexOf("\nfunction runtimeResources()");
assert(end > 0, "Could not isolate canonical data client source");

const events = [];
const windowObject = {
  location: { href: "https://example.test/", origin: "https://example.test" },
  fetch: async () => { throw new Error("transport not configured"); },
  setTimeout,
  clearTimeout,
  dispatchEvent(event) { events.push(event); return true; },
  __mflClientPerformance: {
    entries: [],
    record(phase, detail) { this.entries.push({ phase, detail }); },
  },
};
const navigatorObject = { onLine: true };
class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}
const context = vm.createContext({
  window: windowObject,
  navigator: navigatorObject,
  performance,
  Request,
  Response,
  Headers,
  URL,
  AbortController,
  AbortSignal,
  DOMException,
  CustomEvent: TestCustomEvent,
  Date,
  Set,
  Map,
  Object,
  Number,
  String,
  Array,
  Reflect,
  Promise,
  console,
  setTimeout,
  clearTimeout,
});
vm.runInContext(
  appEntry.slice(0, end)
    + "\nglobalThis.__api02 = { createDataClient, retryAfterDelayMs, retryDelayForResponse, shouldRetryFetchError };",
  context,
);
const { createDataClient } = context.__api02;

async function withTransport(transport, fn) {
  context.nativeFetch = transport;
  // nativeFetch is lexical in app-entry, so rebuild the isolated source with this transport.
  windowObject.fetch = transport;
  const localContext = vm.createContext({
    ...context,
    window: windowObject,
    navigator: navigatorObject,
  });
  vm.runInContext(
    appEntry.slice(0, end)
      + "\nglobalThis.__client = createDataClient({ timeoutMs: 5000 });",
    localContext,
  );
  try {
    return await fn(localContext.__client, localContext);
  } finally {
    events.length = 0;
  }
}

await withTransport(
  (() => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "Busy" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "0.001" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    fn.calls = () => calls;
    return fn;
  })(),
  async (client) => {
    const transport = windowObject.fetch;
    const response = await client.fetch("/api/retry-after");
    assert.equal(response.status, 200);
    assert.equal(transport.calls(), 2, "GET 429 with short Retry-After must retry once");
  },
);

await withTransport(
  (() => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "Conflict" }), { status: 409 });
    };
    fn.calls = () => calls;
    return fn;
  })(),
  async (client) => {
    const transport = windowObject.fetch;
    const response = await client.fetch("/api/conflict");
    assert.equal(response.status, 409);
    assert.equal(transport.calls(), 1, "409 must never be retried");
  },
);

await withTransport(
  (() => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    };
    fn.calls = () => calls;
    return fn;
  })(),
  async (client) => {
    const transport = windowObject.fetch;
    await assert.rejects(client.fetch("/api/mutation", { method: "POST" }), /Failed to fetch/);
    assert.equal(transport.calls(), 1, "POST network failure must never be retried");
  },
);

navigatorObject.onLine = false;
await withTransport(
  (() => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    };
    fn.calls = () => calls;
    return fn;
  })(),
  async (client) => {
    const transport = windowObject.fetch;
    await assert.rejects(client.fetch("/api/offline"), /Failed to fetch/);
    assert.equal(transport.calls(), 1, "Known offline state must not trigger automatic retry");
  },
);
navigatorObject.onLine = true;

await withTransport(
  (() => {
    let calls = 0;
    const fn = async (_input, init) => {
      calls += 1;
      if (init.signal.aborted) {
        throw init.signal.reason || new DOMException("Aborted", "AbortError");
      }
      return new Response("{}", { status: 200 });
    };
    fn.calls = () => calls;
    return fn;
  })(),
  async (client) => {
    const transport = windowObject.fetch;
    const controller = new AbortController();
    controller.abort(new DOMException("Caller cancelled", "AbortError"));
    await assert.rejects(client.fetch("/api/abort", { signal: controller.signal }), (error) => error?.name === "AbortError");
    assert.equal(transport.calls(), 1, "Caller abort must not retry");
  },
);

await withTransport(
  (() => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("{}", { status: 503, headers: { "Retry-After": "0.001" } });
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    fn.calls = () => calls;
    return fn;
  })(),
  async (client) => {
    const transport = windowObject.fetch;
    const [a, b] = await Promise.all([
      client.fetch("/api/dedupe", {}, { dedupe: true }),
      client.fetch("/api/dedupe", {}, { dedupe: true }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(transport.calls(), 2, "Duplicate GETs must share one request/retry sequence, not double it");
  },
);

assert(appEntry.includes('recordClientTiming("data-retry"'));
assert(appEntry.includes('new CustomEvent("mfl:data-client-retry"'));
assert(appEntry.includes('method === "GET" || method === "HEAD"'));
assert(appEntry.includes('new Set([408, 429, 502, 503, 504])'));

const ratioSource = await readFile(new URL("../api/_handler-mfl-season-ratios-v2.js", import.meta.url), "utf8");
assert(!ratioSource.includes("response.status(500).json({ error: message })"), "Internal upstream errors must not leak to clients");
assert(ratioSource.includes('response.status(500).json({ error: "Could not load MFL season ratios." })'));

console.log("API02_ERROR_RETRY_PASS " + JSON.stringify({
  legacyErrorFieldPreserved: true,
  stableCodes: true,
  retryAfter: true,
  conflictNoRetry: true,
  mutationNoRetry: true,
  offlineNoRetry: true,
  abortNoRetry: true,
  duplicateGetShared: true,
  upstreamLeakClosed: true,
}));
