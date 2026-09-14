import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

const require = createRequire(import.meta.url);
const { createWalletChallengeService, WALLET_CHALLENGE_TTL_MS } = require("./api/_wallet-challenge.js");
const { walletAccessMessage } = require("./api/_wallet-proof.js");

const secret = "12".repeat(32);
const origin = "https://wallet-test.example";
const issuedAt = Date.UTC(2026, 8, 14, 12);
let time = issuedAt;
const service = createWalletChallengeService({ secret, origin, now: () => time });
const challenge = service.issue();
const verify = (token = challenge.token, binding = challenge.browserBinding) => service.verify(token, binding);
assert.match(challenge.nonce, /^[0-9a-f]{64}$/);
assert.match(challenge.browserBinding, /^[0-9a-f]{64}$/);
assert.equal(challenge.appIdentifier, walletAccessMessage());
assert.equal(challenge.expiresAt, issuedAt + WALLET_CHALLENGE_TTL_MS);
assert.equal(WALLET_CHALLENGE_TTL_MS, 300000);
assert.notEqual(challenge.nonce, challenge.browserBinding);
assert.deepEqual(verify(), {
  nonce: challenge.nonce,
  appIdentifier: walletAccessMessage(),
  message: challenge.message,
  issuedAt,
  expiresAt: challenge.expiresAt,
});
assert.ok(challenge.message.includes("Origin: " + origin));
assert.ok(challenge.message.includes("Nonce: " + challenge.nonce));
assert.ok(challenge.message.includes(new Date(challenge.expiresAt).toISOString()));
assert.equal(Object.isFrozen(verify()), true);

// New server instances validate the same challenge; no process-local Map owns it.
const secondInstance = createWalletChallengeService({ secret, origin, now: () => time });
assert.deepEqual(secondInstance.verify(challenge.token, challenge.browserBinding), verify());
assert.equal(createWalletChallengeService({ secret: "34".repeat(32), origin, now: () => time })
  .verify(challenge.token, challenge.browserBinding), null);
assert.equal(createWalletChallengeService({ secret, origin: "https://other.example", now: () => time })
  .verify(challenge.token, challenge.browserBinding), null);

time = challenge.expiresAt - 1;
assert.ok(verify());
time = challenge.expiresAt;
assert.equal(verify(), null, "Expiry is exclusive");
time += 1;
assert.equal(verify(), null);
time = issuedAt - 1;
assert.equal(verify(), null, "Future challenges must be rejected");
time = issuedAt;

assert.equal(verify(challenge.token, "56".repeat(32)), null);
assert.equal(verify(challenge.token, ""), null);
assert.equal(verify(challenge.token, null), null);
const [encoded, mac] = challenge.token.split(".");
const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
assert.equal(payload.binding === challenge.browserBinding, false);
assert.equal(JSON.stringify(payload).includes(challenge.browserBinding), false);
const altered = Buffer.from(JSON.stringify({ ...payload, expiresAt: payload.expiresAt + 1 })).toString("base64url");
assert.equal(verify(altered + "." + mac), null, "Changing expiry without the key must fail");
const badMac = (mac[0] === "A" ? "B" : "A") + mac.slice(1);
assert.equal(verify(encoded + "." + badMac), null);
for (const token of ["", null, 42, "x".repeat(2049), encoded, challenge.token + ".extra",
  encoded + "." + mac + "=", encoded + ".AA", "!.!"]) {
  assert.equal(verify(token), null);
}

// Even correctly signed malformed envelopes must not become valid challenges.
function sign(value) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update("mfl.wallet-login-challenge.v1." + body).digest("base64url");
  return body + "." + signature;
}
for (const value of [null, [], {}, { ...payload, purpose: "session" },
  { ...payload, nonce: "invalid" }, { ...payload, issuedAt: "0" },
  { ...payload, issuedAt: -1 }, { ...payload, expiresAt: payload.expiresAt + 1 },
  { ...payload, origin: "https://other.example" }, { ...payload, binding: "" }]) {
  assert.equal(verify(sign(value)), null);
}

const challenges = Array.from({ length: 16 }, () => service.issue());
assert.equal(new Set(challenges.map((item) => item.nonce)).size, challenges.length);
assert.equal(new Set(challenges.map((item) => item.browserBinding)).size, challenges.length);
assert.equal(verify(challenges[0].token, challenges[1].browserBinding), null);

// Validation deliberately does not consume challenges; only a later durable
// atomic exchange can guarantee single use across requests and server instances.
assert.ok(verify());
assert.ok(verify());

for (const badSecret of ["", "12".repeat(16), "g".repeat(64), null]) {
  assert.throws(() => createWalletChallengeService({ secret: badSecret, origin }));
}
for (const badOrigin of ["http://remote.example", "https://wallet-test.example/path",
  "https://wallet-test.example/", "https://user:password@wallet-test.example", "file:///tmp"]) {
  assert.throws(() => createWalletChallengeService({ secret, origin: badOrigin }));
}
for (const local of ["http://localhost:4000", "http://127.0.0.1:4000", "http://[::1]:4000"]) {
  const localService = createWalletChallengeService({ secret, origin: local, now: () => time });
  const localChallenge = localService.issue();
  assert.ok(localService.verify(localChallenge.token, localChallenge.browserBinding));
}
for (const invalidTime of [NaN, Infinity, -1, 0.5, 8.64e15]) {
  const brokenClock = createWalletChallengeService({ secret, origin, now: () => invalidTime });
  assert.throws(() => brokenClock.issue());
  assert.equal(brokenClock.verify(challenge.token, challenge.browserBinding), null);
}

console.log("Wallet challenge validation passed: random issuance, tamper rejection, origin/browser binding, expiry, and cross-instance verification.");
