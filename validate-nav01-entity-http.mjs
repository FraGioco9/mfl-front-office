import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEntityDeepLink, resolveEntityDeepLink, entityStatusMetadata } from "./entity-deep-links.mjs";

for (const [path, kind, id] of [
  ["/players/1", "player", 1],
  ["/players/0001?wallet=private", "player", 1],
  ["/clubs/123/squad", "club", 123],
  ["/club/123/current", "club", 123],
  ["/clubs/123/all-time", "club", 123],
]) {
  const parsed = parseEntityDeepLink(path);
  assert.ok(parsed?.valid && parsed.kind === kind && parsed.id === id, "Valid entity route " + path);
}
for (const path of [
  "/players/0", "/players/abc", "/players/-3",
  "/players/9007199254740992", "/players/1/contracts",
  "/clubs", "/clubs/0", "/clubs/abc", "/club/%2fetc",
  "/clubs/123/unknown", "/clubs/123/squad/more",
]) {
  assert.equal(parseEntityDeepLink(path)?.valid, false, "Malformed entity route must be invalid: " + path);
  const outcome = await resolveEntityDeepLink(path, () => { throw new Error("must not probe SQLite"); });
  assert.equal(outcome.status, 404, "Malformed entity IDs must return 404 without SQL: " + path);
}
assert.equal(parseEntityDeepLink("/database/stats"), null);
assert.equal(parseEntityDeepLink("/planner/aaaaaaaaaaaaaaaa"), null);
assert.equal(await resolveEntityDeepLink("/mfl/stats"), null);

const calls = [];
const probe = async (kind, id) => { calls.push([kind, id]); return id === 1 || id === 123; };
for (const [path, status, reason] of [
  ["/players/1", 200, "found"],
  ["/players/8", 404, "missing"],
  ["/clubs/123/squad", 200, "found"],
  ["/club/99/contracts", 404, "missing"],
]) {
  const outcome = await resolveEntityDeepLink(path, probe);
  assert.deepEqual([outcome.status, outcome.reason], [status, reason], path);
}
assert.deepEqual(calls, [["player",1],["player",8],["club",123],["club",99]]);
assert.equal((await resolveEntityDeepLink("/clubs/123", async () => null)).status, 200,
  "Absent club identity tables must not be treated as authoritative missing clubs.");
const failing = await resolveEntityDeepLink("/players/1", async () => { throw new Error("sqlite path must remain private"); });
assert.deepEqual(failing, { kind: "player", status: 503, reason: "unavailable" });
assert.ok(!JSON.stringify(failing).includes("sqlite path"));
assert.equal(entityStatusMetadata("player", 404).title, "Player not found - MFL Front Office");
assert.equal(entityStatusMetadata("club", 503).title, "Could not load Club - MFL Front Office");
assert.equal(entityStatusMetadata("club", 200), null);

const page = readFileSync(new URL("./pages/[...path].js", import.meta.url), "utf8");
const workflow = readFileSync(new URL("./.github/workflows/site-quality.yml", import.meta.url), "utf8");
const smoke = readFileSync(new URL("./scripts/ci/create-next-sqlite-smoke-fixture.cjs", import.meta.url), "utf8");
assert.match(page, /const entity = await resolveEntityDeepLink\(context\.resolvedUrl\);/);
assert.match(page, /context\.res\.statusCode = entity\.status;/);
assert.match(page, /entityStatusMetadata\(entity\?\.kind, entity\?\.status\)/);
assert.match(workflow, /MFL_DATABASE_PATH: \$\{\{ runner\.temp \}\}\/mfl-next-http-smoke\.db/);
assert.match(workflow, /node scripts\/ci\/create-next-sqlite-smoke-fixture\.cjs "\$MFL_DATABASE_PATH"/);
assert.match(smoke, /CREATE TABLE runtime_clubs \(club_id TEXT PRIMARY KEY/);
console.log("NAV-01 entity deep-link syntax, lightweight lookup, status and metadata checks passed.");
