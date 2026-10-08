import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");

// SEC-07: MFL web clients use a first-party wallet session, not Supabase Auth
// passwords. Do not silently introduce a second user authentication path.
const auth = read("api/_wallet-auth.js");
const session = read("api/_handler-wallet-session.js");
const supabase = read("api/_supabase.js");

assert.match(auth, /signedWalletFromRequest/);
assert.match(auth, /createWalletSessionStore/);
assert.match(session, /verifyWalletProof/);
assert.match(session, /WALLET_SESSION_COOKIE/);
assert.match(supabase, /\/rest\/v1\//);
assert.match(supabase, /SUPABASE_SERVICE_ROLE_KEY/);

const packageJson = JSON.parse(read("package.json"));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
assert.equal(dependencies["@supabase/supabase-js"], undefined,
  "Supabase client dependency added: review the wallet-only authentication boundary");
assert.equal(dependencies["@supabase/ssr"], undefined,
  "Supabase SSR dependency added: review the wallet-only authentication boundary");

const runtimeFiles = [];
const sourceExtensions = /\.(?:[cm]?js|jsx|tsx?|html)$/i;
const visit = folder => {
  for (const item of readdirSync(join(root, folder), { withFileTypes: true })) {
    const file = join(folder, item.name);
    if (item.isDirectory()) visit(file);
    else if (item.isFile() && sourceExtensions.test(item.name)) runtimeFiles.push(file);
  }
};
for (const folder of ["api", "pages", "modules", "html-sources", "responsive-sources"]) visit(folder);
for (const path of ["bootstrap.js", "bootstrap-core.js"]) runtimeFiles.push(path);

const forbidden = [
  [/\/auth\/v1(?:\/|\?|["'])/i, "GoTrue /auth/v1 endpoint"],
  [/\b(?:supabase|supabaseClient)\s*\.\s*auth\b/i, "Supabase Auth client"],
  [/\b(?:signInWithPassword|signInWithOtp|signUp|resetPasswordForEmail)\s*\(/,
    "Supabase user credential flow"],
];
assert.ok(runtimeFiles.length >= 20, "SEC-07 runtime source inventory unexpectedly small");
for (const path of runtimeFiles) {
  const source = read(relative(root, join(root, path)).split("\\").join("/"));
  for (const [pattern, message] of forbidden) {
    assert.doesNotMatch(source, pattern, message + " introduced in " + path +
      "; review SEC-07 and Supabase Auth ownership first");
  }
}
console.log("SEC-07 wallet-only runtime authentication boundary passed (" +
  runtimeFiles.length + " source files checked).");
