import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const evaluationPayload = require("./api/_evaluation-payload.js");
const plannerPayload = require("./api/_planner-payload.js");
const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");

const evaluationShare = read("api/evaluation-share.js");
const evaluationPreviewOwner = read("api/_evaluation-share-preview.js");
const evaluationPreview = read("api/evaluation-preview.js");
const evaluationPreviewImage = read("api/evaluation-preview-image.js");
const plannerShare = read("api/planner-share.js");
const plannerSource = read("modules/core-sources/planner.js");
const appConfig = read("modules/app-config.js");
const sharedRouting = read("modules/core-sources/shared-routing.js");
const pageLifecycle = read("modules/core-sources/shared-page-lifecycle.js");
const bootstrap = read("bootstrap.js");

// Saved-object identifiers remain unchanged; only public capability links get
// stronger new identifiers.
assert.match(evaluationPayload.generateEvaluationId(), /^[a-f0-9]{8}$/);
assert.equal(evaluationPayload.normalizeEvaluationId("ABCDEF12"), "ABCDEF12");
assert.match(plannerPayload.generatePlannerId(), /^[a-f0-9]{16}$/);
assert.equal(plannerPayload.normalizePlannerId("ABCDEF0123456789"), "abcdef0123456789");

// New Evaluation share IDs are 128-bit, but existing 32-bit links survive.
assert.equal(evaluationPayload.normalizeEvaluationShareId("ABCDEF12"), "abcdef12");
assert.equal(
  evaluationPayload.normalizeEvaluationShareId("ABCDEF0123456789ABCDEF0123456789"),
  "abcdef0123456789abcdef0123456789",
);
for (const bad of ["", "abc", "gabcdef1", "abcdef0123456789", "a".repeat(31), "a".repeat(33)]) {
  assert.equal(evaluationPayload.normalizeEvaluationShareId(bad), "", `Evaluation share accepted malformed ID: ${bad}`);
}
const evaluationIds = new Set(Array.from({ length: 256 }, () => evaluationPayload.generateEvaluationShareId()));
assert.equal(evaluationIds.size, 256);
for (const id of evaluationIds) assert.match(id, /^[a-f0-9]{32}$/);

// New Planner public share IDs are 128-bit, while old 64-bit share paths stay valid.
assert.equal(plannerPayload.normalizePlannerShareId("ABCDEF0123456789"), "abcdef0123456789");
assert.equal(
  plannerPayload.normalizePlannerShareId("ABCDEF0123456789ABCDEF0123456789"),
  "abcdef0123456789abcdef0123456789",
);
for (const bad of ["", "abcdef12", "g".repeat(16), "a".repeat(15), "a".repeat(17), "a".repeat(31), "a".repeat(33)]) {
  assert.equal(plannerPayload.normalizePlannerShareId(bad), "", `Planner share accepted malformed ID: ${bad}`);
}
const plannerIds = new Set(Array.from({ length: 256 }, () => plannerPayload.generatePlannerShareId()));
assert.equal(plannerIds.size, 256);
for (const id of plannerIds) assert.match(id, /^[a-f0-9]{32}$/);

// Public Evaluation reads expose only the share snapshot, never creator wallet.
assert.match(evaluationPreviewOwner, /evaluation_shares\?select=id,player_id,payload,expires_at/);
assert.doesNotMatch(evaluationPreviewOwner, /evaluation_shares\?select=[^\n]*wallet_address/);
assert.match(evaluationPreviewOwner, /expires_at=gt\./);
assert.match(evaluationShare, /response\.setHeader\("Cache-Control", "no-store"\)/);
assert.match(evaluationPreview, /"Cache-Control", "no-store, max-age=0"/);
assert.match(evaluationPreviewImage, /"Cache-Control", "no-store, max-age=0"/);

// Evaluation revocation is authenticated, same-origin, owner-scoped and
// deliberately idempotent to avoid disclosing whether another wallet owns ID.
assert.match(evaluationShare, /request\.method === "POST" \|\| request\.method === "DELETE"/);
assert.match(evaluationShare, /if \(!wallet\)[\s\S]*?Opt in to revoke shared evaluations\./);
assert.match(
  evaluationShare,
  /evaluation_shares\?id=eq\.\$\{encodeURIComponent\(id\)\}&wallet_address=eq\.\$\{encodeURIComponent\(wallet\)\}/,
);
assert.match(evaluationShare, /method: "DELETE"/);
assert.match(evaluationShare, /response\.status\(200\)\.json\(\{ ok: true \}\)/);
assert.match(evaluationShare, /"Allow", "GET, POST, DELETE"/);

// Planner public reads similarly omit ownership, enforce expiry and owner-scope
// management/revocation.
assert.match(plannerShare, /planner_shares\?select=id,name,club_id,payload,created_at,expires_at&id=eq\./);
assert.doesNotMatch(
  plannerShare,
  /planner_shares\?select=id,name,club_id,payload,created_at,expires_at,wallet_address/,
);
assert.match(plannerShare, /expires_at=gt\./);
assert.match(
  plannerShare,
  /planner_shares\?id=eq\.\$\{encodeURIComponent\(id\)\}&wallet_address=eq\.\$\{encodeURIComponent\(wallet\)\}/,
);
assert.match(plannerShare, /response\.setHeader\("Cache-Control", "no-store"\)/);

// Stable public Planner routing accepts old and new capability lengths, while
// saved Planner object IDs remain their existing 16-hex internal format.
for (const source of [plannerSource, appConfig, sharedRouting, pageLifecycle, bootstrap]) {
  assert.ok(source.includes("[a-f0-9]{16}") && source.includes("[a-f0-9]{32}"),
    "Planner public routing must preserve legacy 16-hex and accept new 32-hex share IDs.");
}
assert.match(read("api/_planner-payload.js"), /function normalizePlannerId[\s\S]*?\^\[a-f0-9\]\{16\}\$/);
assert.match(read("api/_planner-payload.js"), /function normalizePlannerShareId[\s\S]*?\[a-f0-9\]\{16\}[\s\S]*?\[a-f0-9\]\{32\}/);

// Capability URLs remain no-index/no-cache and malformed/expired public reads
// share the same generic/not-found behavior without leaking wallet ownership.
assert.match(evaluationPreview, /noindex,nofollow,noarchive/);
assert.match(evaluationShare, /Evaluation share not found or expired\./);
assert.match(plannerShare, /Shared plan not found or expired\./);

console.log("SEC-06 share capability security passed: 128-bit new links, legacy compatibility, owner-scoped revoke, expiry and no-cache boundaries.");
