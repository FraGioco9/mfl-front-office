import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialPageMetadata } from "./initial-page-metadata.mjs";

const examples = [
  ["/", "MFL Front Office"],
  ["/home", "MFL Front Office"],
  ["/database/attributes", "Database - MFL Front Office"],
  ["/database/stats", "Database - MFL Front Office"],
  ["/mfl/stats", "MFL - MFL Front Office"],
  ["/progression/current-season", "Progression - MFL Front Office"],
  ["/evaluation?player=123", "Evaluation - MFL Front Office"],
  ["/evaluation?share=secret", "Evaluation - MFL Front Office"],
  ["/planner", "Planner - MFL Front Office"],
  ["/planner/aaaaaaaaaaaaaaaa", "Planner - MFL Front Office"],
  ["/planner/opted-out", "Planner - MFL Front Office"],
  ["/players/101", "Player - MFL Front Office"],
  ["/clubs/2/squad", "Club - MFL Front Office"],
  ["/agents/0xff8d2bbed8164db0", "Agent - MFL Front Office"],
  ["/watchlist/abcd1234/current-season", "Watchlist - MFL Front Office"],
  ["/my-players/attributes", "My Players - MFL Front Office"],
  ["/my-clubs", "My Clubs - MFL Front Office"],
  ["/settings", "Settings - MFL Front Office"],
  ["/settings/opted-out", "Settings - MFL Front Office"],
  ["/my-clubs/opted-out", "My Clubs - MFL Front Office"],
  ["/changelog", "Changelog - MFL Front Office"],
  ["/privacy", "Privacy - MFL Front Office"],
  ["/missing-page", "Page not found - MFL Front Office"],
  ["/database/unknown", "Page not found - MFL Front Office"],
  ["/planner/not-an-id", "Page not found - MFL Front Office"],
  ["/evaluation/extra", "Page not found - MFL Front Office"],
];
for (const [url, title] of examples) {
  const metadata = initialPageMetadata(url);
  assert.equal(metadata.title, title, url);
  assert.ok(metadata.description.includes("MFL Front Office"), "Missing app-safe description for " + url);
  assert.equal(initialPageMetadata(url).title, metadata.title);
}
const secret = initialPageMetadata("/evaluation?share=private-wallet-secret");
assert.ok(!secret.title.includes("private") && !secret.description.includes("private"), "Private query data must not leak.");
const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const routing = read("modules/app-config.js");
const runtime = read("document-title-runtime.js");
const page = read("pages/[...path].js");
const home = read("pages/index.js");
const planner = read("pages/planner.js");
const saved = read("pages/planner/[planId].js");
const vercel = JSON.parse(read("vercel.json"));
assert.ok(Array.isArray(vercel.rewrites), "Explicit Vercel rewrites must be versioned.");
assert.ok(!vercel.rewrites.some(rule => rule.destination === "/index.html"),
  "A static index.html rewrite would bypass route-specific first-response titles on Vercel.");
assert.ok(vercel.rewrites.some(rule => rule.destination === "/api/evaluation-preview"),
  "Shared Evaluation previews must retain their established routing override.");
assert.match(routing, /function canonicalRequest\(/);
assert.match(runtime, /titleForCurrentRoute/);
assert.match(page, /getServerSideProps/);
for (const source of [page, home, planner, saved]) {
  assert.match(source, /initialPageMetadata/);
  assert.match(source, /name: "description"/);
  assert.match(source, /property: "og:title"/);
}
console.log("UX-01 initial Next page metadata and privacy fallbacks passed.");
