import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const {
  correlationDigest,
  createRequestLog,
  errorMetadata,
  safeGeneration,
} = require("../api/_request-log");

test("request id is server-generated and exposed only as a response correlation header", () => {
  const headers = {};
  const response = { setHeader(name, value) { headers[name] = value; } };
  const lines = [];
  const logger = {
    info(line) { lines.push(["info", line]); },
    warn(line) { lines.push(["warn", line]); },
    error(line) { lines.push(["error", line]); },
  };
  const requestId = "11111111-1111-4111-8111-111111111111";
  const trace = createRequestLog(response, {
    category: "planner-save",
    commit: "a".repeat(40),
    logger,
    requestIdFactory: () => requestId,
    now: () => new Date("2026-10-05T12:34:56.000Z"),
  });

  assert.equal(trace.requestId, requestId);
  assert.equal(headers["X-Request-Id"], requestId);

  const rawSecret = "wallet=0xABC token=TOP-SECRET body={private:true}";
  const rawPlanId = "abcdef0123456789";
  const entry = trace.warn("revision_conflict", {
    status: 409,
    generation: "2026-10-05T12:00:00.000Z",
    occurrenceKey: "20261005-0515-p0200",
    idempotencyKey: rawPlanId,
    error: Object.assign(new Error(rawSecret), { code: "PGRST409" }),
    token: "TOP-SECRET",
    wallet: "0xABC",
    ip: "127.0.0.1",
    body: "{private:true}",
    url: "https://example.invalid/private?token=TOP-SECRET",
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], "warn");
  const parsed = JSON.parse(lines[0][1]);
  assert.deepEqual(parsed, entry);
  assert.equal(parsed.requestId, requestId);
  assert.equal(parsed.category, "planner-save");
  assert.equal(parsed.event, "revision_conflict");
  assert.equal(parsed.status, 409);
  assert.equal(parsed.commit, "a".repeat(40));
  assert.equal(parsed.generation, "2026-10-05T12:00:00.000Z");
  assert.match(parsed.occurrenceDigest, /^[0-9a-f]{16}$/);
  assert.match(parsed.idempotencyDigest, /^[0-9a-f]{16}$/);
  assert.equal(parsed.errorType, "Error");
  assert.equal(parsed.errorCode, "PGRST409");

  const serialized = lines[0][1];
  for (const forbidden of [
    rawSecret,
    rawPlanId,
    "TOP-SECRET",
    "0xABC",
    "127.0.0.1",
    "{private:true}",
    "example.invalid",
    "message",
    "stack",
  ]) {
    assert.equal(serialized.includes(forbidden), false, "structured log leaked " + forbidden);
  }
});

test("correlation keys are digest-only and malformed metadata fails closed", () => {
  assert.equal(correlationDigest("same-key"), correlationDigest("same-key"));
  assert.notEqual(correlationDigest("same-key"), correlationDigest("other-key"));
  assert.match(correlationDigest("same-key"), /^[0-9a-f]{16}$/);
  assert.equal(safeGeneration("2026-10-05T12:00:00Z"), "2026-10-05T12:00:00Z");
  assert.equal(safeGeneration("not-a-date"), "");
  assert.deepEqual(errorMetadata({ name: "TypeError", code: "ERR_SAFE", message: "secret" }), {
    errorType: "TypeError",
    errorCode: "ERR_SAFE",
  });
  assert.deepEqual(errorMetadata({ name: "Bad Name", code: "bad code", message: "secret" }), {});
});

test("OPS-06 boundaries cover 401/409/429/500 and dataset generation without raw Error logging", () => {
  const planner = readFileSync(resolve(root, "api/planner-save.js"), "utf8");
  const data = readFileSync(resolve(root, "api/data.js"), "utf8");
  const helper = readFileSync(resolve(root, "api/_request-log.js"), "utf8");

  assert.match(planner, /createRequestLog\(response, \{ category: "planner-save" \}\)/);
  assert.match(planner, /trace\.info\("authentication_required", \{ status: 401 \}\)/);
  assert.match(planner, /trace\.warn\("revision_conflict", \{ status: 409, idempotencyKey:/);
  assert.match(planner, /trace\.warn\("capacity_limit", \{ status: 429 \}\)/);
  assert.match(planner, /trace\.error\("request_failed", \{ status: 500, error \}\)/);
  assert.match(planner, /trace\.error\("persistence_unavailable", \{ status: 503, error \}\)/);
  assert.doesNotMatch(planner, /console\.warn\("Could not handle saved planner plan\.", error\)/);

  assert.match(data, /createRequestLog\(response, \{ category: "data" \}\)/);
  assert.match(data, /trace\.info\("authentication_required", \{ status: 401 \}\)/);
  assert.match(data, /trace\.error\("query_failed", \{ status: 500, generation, error \}\)/);
  assert.match(data, /generation = getGeneratedAt\(\)/);
  assert.doesNotMatch(data, /console\.error\("Could not query MFL database\.", error\)/);

  assert.match(helper, /randomUUID/);
  assert.match(helper, /X-Request-Id/);
  assert.match(helper, /correlationDigest/);
  assert.match(helper, /errorType/);
  assert.match(helper, /errorCode/);
  assert.doesNotMatch(helper, /request\.headers|request\.body|request\.url|x-forwarded-for|x-real-ip|cookie/i);
});

console.log("OPS-06 request correlation/privacy contracts verified.");
