import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { readValidationText } from "./validation-text.mjs";
import { includes, excludes } from "./validation/assertions.mjs";

const require = createRequire(import.meta.url);
const {
  DEFAULT_MAX_BODY_BYTES,
  RequestBodyTooLargeError,
  MalformedJsonBodyError,
  readRequestBody,
  readJsonBody,
  sendRequestBodyError,
} = require("./api/_request-body.js");

const paths = [
  "./api/_request-body.js",
  "./api/wallet-session.js",
  "./api/wallet-preferences.js",
  "./api/evaluation-save.js",
  "./api/evaluation-share.js",
  "./api/bug-reports.js",
];
const sources = Object.fromEntries(
  await Promise.all(paths.map(async (path) => [path, await readValidationText(path, import.meta.url)])),
);
const source = (path) => sources[path];

function request(chunks, headers = {}) {
  const stream = Readable.from(chunks);
  stream.headers = headers;
  return stream;
}

function response() {
  return {
    code: 0,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

assert.equal(DEFAULT_MAX_BODY_BYTES, 64 * 1024, "Shared JSON parsing must retain a bounded fallback.");
assert.equal(
  await readRequestBody(request([Buffer.from("1234")]), { maxBytes: 4 }),
  "1234",
  "The body limit must allow an exact-boundary payload.",
);
await assert.rejects(
  readRequestBody(request([Buffer.from("12345")]), { maxBytes: 4 }),
  RequestBodyTooLargeError,
  "Streaming must stop when actual bytes exceed the endpoint limit.",
);
await assert.rejects(
  readRequestBody(request([], { "content-length": "5" }), { maxBytes: 4 }),
  RequestBodyTooLargeError,
  "Known oversized Content-Length must fail before body accumulation.",
);
await assert.rejects(
  readJsonBody(request([Buffer.from("{not-json}")]), { maxBytes: 64 }),
  MalformedJsonBodyError,
  "Malformed JSON must have a dedicated client-error classification.",
);
assert.deepEqual(
  await readJsonBody(request([Buffer.from('{"ok":true}')]), { maxBytes: 64 }),
  { ok: true },
  "Valid bounded JSON must retain normal parsing.",
);

const malformedResponse = response();
assert.equal(sendRequestBodyError(malformedResponse, new MalformedJsonBodyError()), true);
assert.equal(malformedResponse.code, 400);
assert.deepEqual(malformedResponse.body, { error: "Malformed JSON request body." });

const oversizedResponse = response();
assert.equal(sendRequestBodyError(oversizedResponse, new RequestBodyTooLargeError()), true);
assert.equal(oversizedResponse.code, 413);
assert.deepEqual(oversizedResponse.body, { error: "Request body is too large." });

const unrelatedResponse = response();
assert.equal(sendRequestBodyError(unrelatedResponse, new Error("boom")), false);
assert.equal(unrelatedResponse.code, 0);

includes(source("./api/_request-body.js"), "totalBytes += buffer.length;", "Shared body streaming must count actual bytes.");
includes(source("./api/_request-body.js"), "if (totalBytes > maxBytes)", "Shared body streaming must stop above the configured byte limit.");
includes(source("./api/_request-body.js"), "contentLength > maxBytes", "Shared body parsing must reject known oversized requests before streaming.");
includes(source("./api/_request-body.js"), "throw new MalformedJsonBodyError();", "Malformed JSON must use the canonical request-body error.");
includes(source("./api/_request-body.js"), "function sendRequestBodyError(response, error)", "Request-body errors must have one canonical response mapper.");

for (const [path, limit] of [
  ["./api/wallet-session.js", "32 * 1024"],
  ["./api/bug-reports.js", "32 * 1024"],
  ["./api/evaluation-save.js", "256 * 1024"],
  ["./api/evaluation-share.js", "256 * 1024"],
  ["./api/wallet-preferences.js", "512 * 1024"],
]) {
  const endpoint = source(path);
  includes(endpoint, `const MAX_BODY_BYTES = ${limit};`, `${path} must declare its explicit JSON request limit.`);
  includes(endpoint, "maxBytes: MAX_BODY_BYTES", `${path} must pass its limit to the shared parser.`);
  includes(endpoint, "sendRequestBodyError", `${path} must map malformed/oversized bodies through the shared response owner.`);
}

excludes(source("./api/wallet-session.js"), 'Number(request?.headers?.["content-length"] || 0)', "Wallet session must not duplicate shared body-size preflight.");
excludes(source("./api/bug-reports.js"), 'Number(request.headers?.["content-length"] || 0)', "Bug reports must not duplicate shared body-size preflight.");

console.log("Request body limit validation passed: JSON writers use explicit limits, streamed bytes are bounded, malformed JSON returns 400, and oversized bodies return 413.");
