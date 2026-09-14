import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const require = createRequire(import.meta.url);

const [
  authSource,
  endpointSource,
  walletSource,
  generatedWallet,
  dataAuthSource,
  optInSource,
  preferencesSource,
  saveSource,
  shareSource,
  bugReportSource,
] = await Promise.all([
  read("./api/_wallet-auth.js"),
  read("./api/wallet-session.js"),
  read("./modules/core-sources/wallet.js"),
  read("./modules/app-core-wallet-runtime.js"),
  read("./api/_data-auth.js"),
  read("./api/wallet-opt-ins.js"),
  read("./api/wallet-preferences.js"),
  read("./api/evaluation-save.js"),
  read("./api/evaluation-share.js"),
  read("./api/bug-reports.js"),
]);

const wallet = "0x1111111111111111";

function load(source, dependencies) {
  const module = { exports: {} };
  runInNewContext(source, {
    module,
    console: { warn() {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

let legacyCalls = 0;
let resolveCalls = 0;
let resolvedSession = { walletAddress: wallet };
const auth = load(authSource, {
  "./_wallet-proof": {
    normalizeWalletAddress(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return normalized ? (normalized.startsWith("0x") ? normalized : `0x${normalized}`) : "";
    },
    async signedWalletFromRequest() {
      legacyCalls += 1;
      return wallet;
    },
  },
  "./_wallet-session": {
    createWalletSessionStore() {
      return {
        async resolveSession(token) {
          resolveCalls += 1;
          assert.equal(token, "session-token");
          return resolvedSession;
        },
      };
    },
  },
});

assert.equal(
  await auth.signedWalletFromRequest({ headers: { cookie: "other=x; mfl_wallet_session=session-token" } }),
  wallet,
);
assert.equal(resolveCalls, 1);
assert.equal(legacyCalls, 0, "A valid server session must not re-run legacy proof verification.");

resolvedSession = null;
assert.equal(
  await auth.signedWalletFromRequest({
    headers: {
      cookie: "mfl_wallet_session=session-token",
      "x-dapper-wallet-address": wallet,
    },
  }),
  "",
  "A present but invalid/revoked session must fail closed instead of falling back to legacy proof headers.",
);
assert.equal(legacyCalls, 0);

assert.equal(await auth.signedWalletFromRequest({ headers: {} }), wallet);
assert.equal(legacyCalls, 1, "Legacy proof transport remains a temporary migration fallback only when no session cookie exists.");
assert.equal(
  await auth.signedWalletFromRequest({ headers: {} }, { allowLegacyProof: false }),
  "",
);
assert.equal(legacyCalls, 1);

const { createWalletSessionHandler } = require("./api/wallet-session.js");
const now = Date.UTC(2026, 8, 14, 15, 0, 0);
const nonce = "ab".repeat(32);
const binding = "cd".repeat(32);
const challenge = {
  token: "signed-challenge",
  nonce,
  appIdentifier: "MFL Front Office Dapper Opt-In",
  message: "server-bound challenge message",
  expiresAt: now + 5 * 60 * 1000,
  browserBinding: binding,
};
let consumed = false;
let revoked = "";
let verifyCalls = 0;

function challengeFactory({ secret, origin }) {
  assert.equal(secret, "12".repeat(32));
  assert.equal(origin, "https://wallet-test.example");
  return {
    issue() {
      return { ...challenge };
    },
    verify(token, suppliedBinding) {
      if (token !== challenge.token || suppliedBinding !== binding) return null;
      const { browserBinding: _private, token: _token, ...verified } = challenge;
      return verified;
    },
  };
}

function sessionStoreFactory() {
  return {
    async consumeChallengeAndCreateSession(input) {
      assert.equal(input.nonce, nonce);
      assert.equal(input.walletAddress, wallet);
      assert.equal(input.challengeExpiresAt, challenge.expiresAt);
      if (consumed) return null;
      consumed = true;
      return {
        token: "s".repeat(43),
        walletAddress: wallet,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      };
    },
    async revokeSession(token) {
      revoked = token;
      return true;
    },
  };
}

async function verifyProof(proof, options) {
  verifyCalls += 1;
  assert.equal(proof.walletAddress, wallet);
  assert.equal(options.expectedMessage, challenge.message);
  assert.equal(options.expectedAppIdentifier, challenge.appIdentifier);
  assert.equal(options.expectedNonce, challenge.nonce);
  return wallet;
}

const handler = createWalletSessionHandler({
  secret: "12".repeat(32),
  now: () => now,
  challengeFactory,
  sessionStoreFactory,
  verifyProof,
  readBody: async (request) => request.body,
});

function request(method, overrides = {}) {
  return {
    method,
    headers: {
      host: "wallet-test.example",
      "x-forwarded-proto": "https",
      origin: "https://wallet-test.example",
      "x-forwarded-for": overrides.ip || "203.0.113.10",
      ...(overrides.headers || {}),
    },
    body: overrides.body,
  };
}

function response() {
  return {
    code: 0,
    body: undefined,
    headers: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end(body) {
      this.body = body;
      return this;
    },
  };
}

const issuedResponse = response();
await handler(request("GET"), issuedResponse);
assert.equal(issuedResponse.code, 200);
assert.equal(issuedResponse.body.token, challenge.token);
assert.equal(issuedResponse.body.nonce, nonce);
assert.ok(!Object.hasOwn(issuedResponse.body, "browserBinding"), "Raw browser binding must never be returned in public JSON.");
assert.match(String(issuedResponse.headers["set-cookie"]), /mfl_wallet_challenge=/);
assert.match(String(issuedResponse.headers["set-cookie"]), /HttpOnly/);
assert.match(String(issuedResponse.headers["set-cookie"]), /SameSite=Strict/);
assert.match(String(issuedResponse.headers["set-cookie"]), /Secure/);

const proof = {
  walletAddress: wallet,
  signingAddress: wallet,
  message: challenge.message,
  proofType: "user-signature",
  appIdentifier: challenge.appIdentifier,
  nonce,
  signatures: [{ addr: wallet, keyId: 0, signature: "ef".repeat(64) }],
};
const exchangeResponse = response();
await handler(request("POST", {
  headers: {
    cookie: `mfl_wallet_challenge=${binding}`,
    "content-length": "1024",
  },
  body: { challengeToken: challenge.token, proof },
}), exchangeResponse);
assert.equal(exchangeResponse.code, 200);
assert.equal(exchangeResponse.body.wallet, wallet);
assert.equal(verifyCalls, 1);
assert.ok(Array.isArray(exchangeResponse.headers["set-cookie"]));
assert.ok(exchangeResponse.headers["set-cookie"].some((value) => String(value).startsWith("mfl_wallet_session=")));
assert.ok(exchangeResponse.headers["set-cookie"].some((value) => String(value).includes("mfl_wallet_challenge=;")));
assert.ok(exchangeResponse.headers["set-cookie"].every((value) => String(value).includes("HttpOnly")));
assert.ok(exchangeResponse.headers["set-cookie"].every((value) => String(value).includes("SameSite=Strict")));

const replayResponse = response();
await handler(request("POST", {
  headers: { cookie: `mfl_wallet_challenge=${binding}` },
  body: { challengeToken: challenge.token, proof },
}), replayResponse);
assert.equal(replayResponse.code, 401, "The same durable challenge may establish at most one session.");

const wrongOriginResponse = response();
await handler(request("POST", {
  headers: {
    origin: "https://attacker.example",
    cookie: `mfl_wallet_challenge=${binding}`,
  },
  body: { challengeToken: challenge.token, proof },
}), wrongOriginResponse);
assert.equal(wrongOriginResponse.code, 403);

const logoutResponse = response();
await handler(request("DELETE", {
  headers: { cookie: `mfl_wallet_session=${"s".repeat(43)}` },
}), logoutResponse);
assert.equal(logoutResponse.code, 204);
assert.equal(revoked, "s".repeat(43));
assert.ok(logoutResponse.headers["set-cookie"].some((value) => String(value).startsWith("mfl_wallet_session=;")));

assert.ok(endpointSource.includes('const MAX_BODY_BYTES = 32 * 1024;'));
assert.ok(endpointSource.includes('const MAX_RATE_BUCKETS = 2_000;'));
assert.ok(endpointSource.includes('expectedNonce: challenge.nonce'));
assert.ok(endpointSource.includes('consumeChallengeAndCreateSession'));
assert.ok(endpointSource.includes('response.status(429)'));
assert.ok(endpointSource.includes('HttpOnly; SameSite=Strict'));
assert.ok(endpointSource.includes('response.status(204).end();'));

for (const [label, source] of [
  ["data auth", dataAuthSource],
  ["wallet opt-ins", optInSource],
  ["wallet preferences", preferencesSource],
  ["evaluation save", saveSource],
  ["evaluation share", shareSource],
  ["bug reports", bugReportSource],
]) {
  assert.ok(source.includes('require("./_wallet-auth")'), `${label} must authenticate through the session-aware owner.`);
}

const exchangeIndex = walletSource.indexOf("await exchangeWalletChallenge(challenge.token, linkedWalletProof);");
const stateIndex = walletSource.indexOf("state.linkedWalletAddress = dapperAddress;", exchangeIndex);
assert.ok(exchangeIndex >= 0 && stateIndex > exchangeIndex, "Client linked state must not commit before the server session exchange succeeds.");
assert.ok(walletSource.includes('type: "session",'));
assert.ok(!walletSource.includes("function walletAccessNonce() {"), "Browser-generated login nonces must be retired.");
assert.ok(walletSource.includes("await logoutWalletSession();\n    optOutWallet();"), "Explicit opt-out must revoke the server session before clearing local state.");

const walletBanner = "// Generated Wallet core from modules/core-sources/wallet.js. Do not edit directly.\n";
assert.equal(
  generatedWallet.slice(walletBanner.length).replace(/\s*$/, ""),
  walletSource.replace(/\s*$/, ""),
  "Generated Wallet runtime must match the secure-session source.",
);

console.log("Wallet session integration validation passed: challenge exchange, cookie authority, replay rejection, consumer migration, and logout are covered.");
