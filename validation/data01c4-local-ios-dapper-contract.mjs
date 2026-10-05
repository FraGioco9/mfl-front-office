import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [script, doc] = await Promise.all([
  readFile(resolve(root, "scripts/qa/start-data01c4-ios-dapper-local.ps1"), "utf8"),
  readFile(resolve(root, "docs/data01c4-local-ios-dapper.md"), "utf8"),
]);

for (const forbidden of [
  /supabase\s+link/i,
  /supabase\s+db\s+push/i,
  /supabase\s+db\s+reset\s+--linked/i,
  /vercel\s+(?:deploy|build|pull|env|link)/i,
]) {
  assert.doesNotMatch(script, forbidden, "Local DATA-01C4 launcher must not target remote Supabase or Vercel.");
}

assert.match(script, /supabase\s+start/);
assert.match(script, /supabase\s+db\s+reset/);
assert.match(script, /Refusing non-local Supabase URL/);
assert.match(script, /SUPABASE_URL\s*=\s*\$apiUrl/);
assert.match(script, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\$serviceRole/);
assert.match(script, /WALLET_CHALLENGE_ORIGIN\s*=\s*\$origin/);
assert.match(script, /https:\/\/\[a-z0-9-\]\+\\\.trycloudflare\\\.com/);
assert.match(script, /localIdentity\.runtime\.commit/);
assert.match(script, /publicIdentity\.runtime\.commit/);
assert.match(script, /challenge\.appIdentifier/);
assert.match(script, /branch -ne "main"/);
assert.match(script, /git status --porcelain/);
assert.match(script, /Node\.js 22/);
assert.match(script, /supabase stop --no-backup/);

assert.match(doc, /local Supabase Docker stack/i);
assert.match(doc, /real Dapper/i);
assert.match(doc, /Do not mark a gate PASS/i);
assert.match(doc, /G01/);
assert.match(doc, /G09/);
assert.match(doc, /No Vercel deployment or live Supabase write/i);

console.log("DATA-01C4 local iPhone/Dapper QA safety contract passed.");
