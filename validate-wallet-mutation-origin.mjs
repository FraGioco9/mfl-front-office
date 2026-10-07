import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const { exactConfiguredOrigin, requestOrigin, requireSameOriginMutation } = require("./api/_request-origin.js");

const previousConfigured = process.env.WALLET_CHALLENGE_ORIGIN;
const previousVercel = process.env.VERCEL_URL;
delete process.env.WALLET_CHALLENGE_ORIGIN;
delete process.env.VERCEL_URL;

function reply() {
  return { code: null, payload: null, setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.payload = value; return this; } };
}

try {
  const localHeaders = { host: "127.0.0.1:4000", "x-forwarded-proto": "http" };
  assert.equal(requestOrigin({ headers: localHeaders }), "http://127.0.0.1:4000");
  assert.equal(exactConfiguredOrigin("example.vercel.app"), "https://example.vercel.app");
  assert.equal(exactConfiguredOrigin("https://front-office.example"), "https://front-office.example");
  assert.throws(() => exactConfiguredOrigin("https://front-office.example/path"), /exact origin/);
  assert.throws(() => requestOrigin({ headers: { host: "attacker.example", "x-forwarded-proto": "https" } }), /configured trusted deployment origin/);

  for (const supplied of ["https://attacker.example", "null", "", "http://127.0.0.1:4001"]) {
    const response = reply();
    const passed = requireSameOriginMutation({ headers: { ...localHeaders, ...(supplied ? { origin: supplied } : {}) } }, response);
    assert.equal(passed, false, `Rejected invalid Origin ${supplied || "(absent)"}`);
    assert.equal(response.code, 403);
  }
  const accepted = reply();
  assert.equal(requireSameOriginMutation({ headers: { ...localHeaders, origin: "http://127.0.0.1:4000" } }, accepted), true);
  assert.equal(accepted.code, null);
  const spoofed = reply();
  assert.equal(requireSameOriginMutation({ headers: { ...localHeaders, "x-forwarded-host": "attacker.example", origin: "https://attacker.example", "x-forwarded-proto": "https" } }, spoofed), false);
  assert.equal(spoofed.code, 400);

  process.env.WALLET_CHALLENGE_ORIGIN = "https://mfl-front-office.example";
  assert.equal(requestOrigin({ headers: { host: "attacker.example", origin: "https://mfl-front-office.example" } }), "https://mfl-front-office.example");
  const deployed = reply();
  assert.equal(requireSameOriginMutation({ headers: { host: "attacker.example", origin: "https://mfl-front-office.example" } }, deployed), true);
  const forged = reply();
  assert.equal(requireSameOriginMutation({ headers: { host: "mfl-front-office.example", origin: "https://attacker.example" } }, forged), false);
  assert.equal(forged.code, 403);
  delete process.env.WALLET_CHALLENGE_ORIGIN;

  const boundaries = [
    ["planner-save", ["POST", "DELETE"]],
    ["planner-share", ["POST", "DELETE"]],
    ["evaluation-save", ["POST", "DELETE"]],
    ["evaluation-share", ["POST"]],
    ["wallet-preferences", ["PUT"]],
    ["wallet-opt-ins", ["POST"]],
  ];
  for (const [name, methods] of boundaries) {
    const source = await readFile(new URL(`./api/_handler-${name}.js`, import.meta.url), "utf8");
    assert.match(source, /require\("\.\/_request-origin"\)/, `${name} must import the shared guard`);
    const module = { exports: {} };
    let authenticated = 0;
    let databaseAccess = 0;
    runInNewContext(source, {
      module,
      URL,
      console: { warn() {} },
      require(dep) {
        if (dep === "./_request-origin") return { requireSameOriginMutation };
        if (dep === "./_error-envelope") return { installApiErrorEnvelope(response) { return response; } };
        if (dep === "./_wallet-auth") return { signedWalletFromRequest() { authenticated += 1; return "0x1111111111111111"; } };
        if (dep === "./_supabase") return { supabaseConfig() { databaseAccess += 1; return true; }, supabaseRequest() { databaseAccess += 1; return []; } };
        if (dep === "./_request-log") return {
          createRequestLog() {
            return { info() {}, warn() {}, error() {} };
          },
        };
        return {};
      },
    }, { filename: `api/_handler-${name}.js` });
    for (const method of methods) {
      for (const origin of [undefined, "https://attacker.example"]) {
        const response = reply();
        await module.exports({ method, headers: { ...localHeaders, ...(origin ? { origin } : {}) } }, response);
        assert.equal(response.code, 403, `${name} ${method} must reject a missing or cross-site Origin`);
        assert.equal(authenticated, 0, `${name} ${method} must reject before wallet authentication`);
        assert.equal(databaseAccess, 0, `${name} ${method} must reject before database calls`);
      }
    }
  }
  const sessionSource = await readFile(new URL("./api/_handler-wallet-session.js", import.meta.url), "utf8");
  assert.match(sessionSource, /require\("\.\/_request-origin"\)/, "Wallet challenge and mutations must share trusted-origin rules");
  assert.match(sessionSource, /sameOriginRequest\(request, origin\)/, "Wallet session must retain its same-origin check");
  console.log("Wallet mutation Origin tests passed across six API handlers and authentication.");
} finally {
  if (previousConfigured === undefined) delete process.env.WALLET_CHALLENGE_ORIGIN;
  else process.env.WALLET_CHALLENGE_ORIGIN = previousConfigured;
  if (previousVercel === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = previousVercel;
}
