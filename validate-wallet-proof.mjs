import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { performance } from "node:perf_hooks";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [proofSource, authSource, optInSource] = await Promise.all([
  read("./api/_wallet-proof.js"), read("./api/_data-auth.js"), read("./api/wallet-opt-ins.js"),
]);
const wallet = "0x1111111111111111";
const otherWallet = "0x2222222222222222";
const message = "MFL Front Office Dapper Opt-In";
const nonce = "ab".repeat(32);
const signature = { addr: wallet, keyId: 0, signature: "cd".repeat(64) };

function load(source, dependencies) {
  const module = { exports: {} };
  runInNewContext(source, {
    module, Buffer, console: { warn() {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      const dependency = dependencies[name];
      if (dependency instanceof Error) throw dependency;
      return dependency;
    },
  });
  return module.exports;
}

function harness(result = true, available = true) {
  const calls = [];
  const verify = (kind) => async (...args) => {
    calls.push({ kind, args });
    if (result instanceof Error) throw result;
    return result;
  };
  const proof = load(proofSource, {
    "@onflow/fcl": available ? {
      config() {},
      AppUtils: { verifyAccountProof: verify("account"), verifyUserSignatures: verify("message") },
    } : new Error("SDK unavailable"),
  });
  return { proof, calls };
}

function request(type = "account-proof", overrides = {}) {
  return { method: "POST", headers: {
    "x-dapper-wallet-address": wallet,
    "x-wallet-signing-address": wallet,
    "x-wallet-message": message,
    "x-wallet-proof-type": type,
    "x-wallet-app-identifier": message,
    "x-wallet-nonce": nonce,
    "x-wallet-signatures": JSON.stringify([signature]),
    ...overrides,
  } };
}

for (const type of ["account-proof", "user-signature"]) {
  const valid = harness();
  assert.equal(await valid.proof.signedWalletFromRequest(request(type)), wallet);
  assert.equal(valid.calls.length, 1);
  if (type === "account-proof") {
    assert.equal(valid.calls[0].args[0], message);
    assert.equal(valid.calls[0].args[1].address, wallet);
    assert.equal(valid.calls[0].args[1].nonce, nonce);
  } else {
    assert.equal(valid.calls[0].args[0], Buffer.from(message).toString("hex"));
    assert.equal(valid.calls[0].args[1][0].addr, wallet);
  }

  for (const result of [false, null, "true", new Error("Verifier unavailable")]) {
    const denied = harness(result);
    // A stale caller must not be able to restore the former fail-open behavior.
    assert.equal(await denied.proof.signedWalletFromRequest(request(type), {
      allowAccountProofFallback: true,
    }), "", `${type}: non-true verifier results must deny access`);
  }
  assert.equal(await harness(true, false).proof.signedWalletFromRequest(request(type)), "");

  for (const overrides of [
    { "x-dapper-wallet-address": otherWallet },
    { "x-wallet-signing-address": otherWallet },
    { "x-dapper-wallet-address": "invalid", "x-wallet-signing-address": "invalid" },
    { "x-wallet-message": "Another application" },
    { "x-wallet-proof-type": "unsupported" },
    { "x-wallet-signatures": "not json" },
    { "x-wallet-signatures": "[]" },
    { "x-wallet-signatures": "{}" },
  ]) {
    const denied = harness();
    assert.equal(await denied.proof.signedWalletFromRequest(request(type, overrides)), "");
    assert.equal(denied.calls.length, 0, "Reject invalid identity/envelope before verifier work");
  }

  const normalized = harness();
  assert.equal(await normalized.proof.signedWalletFromRequest(request(type, {
    "x-dapper-wallet-address": ` ${wallet.slice(2)} `,
    "x-wallet-signing-address": undefined,
    "x-wallet-signatures": JSON.stringify([signature, { ...signature, keyId: 1 }]),
  })), wallet, "Default signing identity and same-wallet multiple keys remain supported");
}

for (const overrides of [
  { "x-wallet-app-identifier": "Another application" },
  { "x-wallet-nonce": "" },
  { "x-wallet-nonce": "z".repeat(64) },
  { "x-wallet-nonce": "ab" },
]) {
  const denied = harness();
  assert.equal(await denied.proof.signedWalletFromRequest(request("account-proof", overrides)), "");
  assert.equal(denied.calls.length, 0);
}

// Account proof verification binds keys to the explicit address; providers may
// omit per-signature addresses. Preserve that FCL account-proof envelope.
assert.equal(await harness().proof.signedWalletFromRequest(request("account-proof", {
  "x-wallet-signatures": JSON.stringify([{ keyId: 0, signature: signature.signature }]),
})), wallet);

for (const signatures of [[{ ...signature, addr: otherWallet }],
  [signature, { ...signature, addr: otherWallet }], [null], [{}]]) {
  const denied = harness();
  assert.equal(await denied.proof.signedWalletFromRequest(request("user-signature", {
    "x-wallet-signatures": JSON.stringify(signatures),
  })), "");
  assert.equal(denied.calls.length, 0);
}

// Challenge exchanges bind both proof variants to the exact server-issued message and nonce.
const challengeMessage = `${message}\nOrigin: https://wallet-test.example\nNonce: ${"ef".repeat(32)}`;
const challengeNonce = "ef".repeat(32);
for (const type of ["account-proof", "user-signature"]) {
  const valid = harness();
  assert.equal(await valid.proof.verifyWalletProof({
    walletAddress: wallet,
    signingAddress: wallet,
    message: challengeMessage,
    proofType: type,
    appIdentifier: "https://wallet-test.example",
    nonce: challengeNonce,
    signatures: [signature],
  }, {
    expectedMessage: challengeMessage,
    expectedAppIdentifier: "https://wallet-test.example",
    expectedNonce: challengeNonce,
  }), wallet);
  assert.equal(valid.calls.length, 1);

  for (const [expectedMessage, expectedNonce] of [
    ["wrong message", challengeNonce],
    [challengeMessage, "aa".repeat(32)],
  ]) {
    const denied = harness();
    assert.equal(await denied.proof.verifyWalletProof({
      walletAddress: wallet,
      signingAddress: wallet,
      message: challengeMessage,
      proofType: type,
      appIdentifier: message,
      nonce: challengeNonce,
      signatures: [signature],
    }, { expectedMessage, expectedAppIdentifier: "https://wallet-test.example", expectedNonce }), "");
    assert.equal(denied.calls.length, 0);
  }
}


// Even with a valid nonce and signatures, the old descriptive account-proof
// identifier must not pass an origin-bound challenge exchange.
const legacyAccountProof = harness();
assert.equal(await legacyAccountProof.proof.verifyWalletProof({
  walletAddress: wallet,
  signingAddress: wallet,
  message: challengeMessage,
  proofType: "account-proof",
  appIdentifier: message,
  nonce: challengeNonce,
  signatures: [signature],
}, {
  expectedMessage: challengeMessage,
  expectedAppIdentifier: "https://wallet-test.example",
  expectedNonce: challengeNonce,
}), "");
assert.equal(legacyAccountProof.calls.length, 0);

// Exercise the former fail-open consumers using the real canonical verifier.
for (const result of [true, false, new Error("Verifier unavailable")]) {
  const { proof } = harness(result);
  let writes = 0;
  const supabase = { supabaseConfig: () => ({ configured: true }) };
  const auth = load(authSource, {
    "node:perf_hooks": { performance }, "./_wallet-auth": proof, "./_supabase": supabase,
  });
  assert.equal(await auth.signedWalletFromRequest(request()), result === true ? wallet : "");
  const handler = load(optInSource, {
    "./_wallet-auth": proof, "./_supabase": supabase,
    "./_wallet-presence": { async touchWalletLastSeen(address) {
      assert.equal(address, wallet);
      writes += 1;
      return { rows: [{}] };
    } },
  });
  const response = { code: 0, body: null, setHeader() {},
    status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler(request(), response);
  assert.equal(response.code, result === true ? 200 : 401);
  assert.equal(writes, result === true ? 1 : 0, "Unverified requests must never record opt-ins");
}

console.log("Wallet proof validation passed: verified identity, failure rejection, supported proofs, and opt-in boundaries.");
