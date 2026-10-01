import assert from "node:assert/strict";
import { initialPageMetadata } from "../initial-page-metadata.mjs";
const origin = String(process.argv[2] || "http://127.0.0.1:4010").replace(/\/$/, "");
const routes = ["/", "/database/attributes", "/mfl/stats", "/progression/current-season",
  "/evaluation?player=123", "/planner", "/planner/aaaaaaaaaaaaaaaa",
  "/players/123", "/clubs/123/squad", "/watchlist", "/settings", "/changelog"];
for (const path of routes) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, "Next route HTTP status " + path);
  const html = await response.text();
  const head = html.split(/<\/head>/i)[0];
  const titles = [...head.matchAll(/<title\b[^>]*>([^<]*)<\/title>/gi)].map(m => m[1]);
  const expected = initialPageMetadata(path);
  assert.deepEqual(titles, [expected.title], "Raw first-response HTML must have one correct title: " + path);
  assert.match(head, /<meta\b[^>]*name="description"/i, "Missing description on " + path);
  assert.match(head, /<meta\b[^>]*property="og:title"/i, "Missing og:title on " + path);
  assert.ok(!head.includes('private-wallet-secret'), "Private query should not appear in metadata.");
}
console.log("UX-01 actual Next initial HTML titles/descriptions passed on " + routes.length + " routes.");
