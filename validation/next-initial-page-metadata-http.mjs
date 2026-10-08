import assert from "node:assert/strict";
import { initialPageMetadata } from "../initial-page-metadata.mjs";
import { entityStatusMetadata } from "../entity-deep-links.mjs";

const origin = String(process.argv[2] || "http://127.0.0.1:4010").replace(/\/$/, "");
const routes = [
  ["/", 200], ["/database/attributes", 200], ["/mfl/stats", 200],
  ["/progression/current-season", 200], ["/evaluation?player=123", 200],
  ["/planner", 200], ["/planner/aaaaaaaaaaaaaaaa", 200],
  ["/players/1", 200], ["/players/2", 200],
  ["/players/999999999", 404], ["/players/abc", 404], ["/players/0", 404],
  ["/players/1/contracts", 404], ["/clubs/123/squad", 200],
  ["/clubs/invalid/squad", 404], ["/clubs/123/unknown", 404],
  ["/watchlist", 200], ["/settings", 200], ["/changelog", 200],
];

for (const [path, expectedStatus] of routes) {
  const response = await fetch(origin + path);
  assert.equal(response.status, expectedStatus, "Next route HTTP status " + path);
  const html = await response.text();
  const head = html.split(/<\/head>/i)[0];
  const titles = [...head.matchAll(/<title\b[^>]*>([^<]*)<\/title>/gi)].map(m => m[1]);
  const kind = path.startsWith("/players/") ? "player" : path.startsWith("/club") ? "club" : null;
  const expected = expectedStatus === 200
    ? initialPageMetadata(path) : entityStatusMetadata(kind, expectedStatus);
  assert.deepEqual(titles, [expected.title], "Raw first-response HTML must have one correct title: " + path);
  assert.match(head, /<meta\b[^>]*name="description"/i, "Missing description on " + path);
  if (path.startsWith("/evaluation")) {
    // Ordinary Evaluation navigation must not appear as a shared player card.
    assert.doesNotMatch(head, /<meta\b[^>]*property="og:/i,
      "Non-shared Evaluation must not advertise Open Graph metadata: " + path);
    assert.doesNotMatch(head, /<meta\b[^>]*name="twitter:/i,
      "Non-shared Evaluation must not advertise a Twitter card: " + path);
  } else {
    assert.match(head, /<meta\b[^>]*property="og:title"/i, "Missing og:title on " + path);
  }
  assert.ok(!head.includes("private-wallet-secret"), "Private query should not appear in metadata.");
}
console.log("NAV-01 Next first HTML: metadata and HTTP 200/404 passed on " + routes.length + " routes.");
