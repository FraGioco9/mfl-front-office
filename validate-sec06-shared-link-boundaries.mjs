import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { normalizeEvaluationId, generateEvaluationId } = require("./api/_evaluation-payload.js");
const { normalizePlannerId, generatePlannerId } = require("./api/_planner-payload.js");
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

// Shared identifiers must never truncate or remove disallowed input into an
// entirely different valid unlisted link.
for (const bad of ["12345678suffix", "1234-5678", "12/345678", "12345678?wallet=B", "..12345678", "１２３４５６７８", ""]) {
  assert.equal(normalizeEvaluationId(bad), "", `Malformed Evaluation ID should fail closed: ${bad}`);
}
for (const id of ["12345678", "deadBEEF", "a7"]) {
  assert.equal(normalizeEvaluationId(id), id);
}
assert.equal(normalizeEvaluationId("  aBc123  "), "aBc123");
assert.match(generateEvaluationId(), /^[a-f0-9]{8}$/);
assert.match(generatePlannerId(), /^[a-f0-9]{16}$/);
for (const bad of ["abcdef0123456789suffix", "abcdef01-23456789", "abcdef012345678!", "", "000"]) {
  assert.equal(normalizePlannerId(bad), "", `Malformed Planner ID should fail closed: ${bad}`);
}
assert.equal(normalizePlannerId(" ABCDEF0123456789 "), "abcdef0123456789");

// Regression inventory of scope and cache contracts; future changes must
// preserve these even if the handler/query structure is refactored.
const plannerSave = read("./api/planner-save.js");
const evalSave = read("./api/evaluation-save.js");
const plannerShare = read("./api/planner-share.js");
const evalShare = read("./api/evaluation-share.js");
const preview = read("./api/_evaluation-share-preview.js");
for (const [name, src] of [["Planner save", plannerSave], ["Evaluation save", evalSave],
  ["Planner share", plannerShare], ["Evaluation share", evalShare]]) {
  assert.ok(src.includes('response.setHeader("Cache-Control", "no-store")'), `${name} must never be publicly cached`);
  assert.ok(src.includes('signedWalletFromRequest(request)'), `${name} must authenticate private actions`);
}
for (const [name, src] of [["Planner saved plans", plannerSave], ["Evaluation saved evaluations", evalSave]]) {
  assert.ok(src.includes("wallet_address=eq.${encodeURIComponent(wallet)}"), `${name} must filter reads/mutations by owner`);
  assert.match(src, /response\.status\(404\)/, `${name} must reject missing or cross-wallet resources`);
}
for (const [name, src] of [["Planner shares", plannerShare], ["Evaluation shares", preview]]) {
  assert.ok(src.includes("expires_at=gt.${encodeURIComponent(new Date().toISOString())}"),
    `${name} must reject expired public shares at query time`);
}
assert.ok(plannerShare.includes('responseShare(row)'), "Public Planner shares must omit owner-only fields.");
assert.ok(plannerShare.includes('responseShare(row, { owner: true })'), "Private Planner share list must retain owner-specific fields.");
assert.ok(plannerShare.includes("wallet_address=eq.${encodeURIComponent(wallet)}"), "Only owners may revoke Planner shares.");
assert.ok(evalShare.includes("readActiveEvaluationShare(id, playerId)"), "Public Evaluation must use the expiry-aware reader.");
assert.ok(!preview.includes("select=id,player_id,payload,expires_at,wallet_address"),
  "Public Evaluation queries must not select a wallet identity.");
console.log("SEC-06 shared link ID validation, privacy, expiry, owner scope and cache contracts passed.");
