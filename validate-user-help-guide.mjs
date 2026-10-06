import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [
  guide,
  htmlSource,
  indexHtml,
  walletPreferences,
  evaluationSave,
  evaluationShare,
  plannerSave,
  plannerShare,
  pageLifecycle,
  staticUi,
  walletSession,
  sec06Fixtures,
] = await Promise.all([
  read("./docs/account-sharing-help.md"),
  read("./html-sources/static.html"),
  read("./index.html"),
  read("./api/wallet-preferences.js"),
  read("./api/evaluation-save.js"),
  read("./api/evaluation-share.js"),
  read("./api/planner-save.js"),
  read("./api/planner-share.js"),
  read("./modules/core-sources/shared-page-lifecycle.js"),
  read("./static-ui-runtime.js"),
  read("./api/wallet-session.js"),
  read("./validate-sec06-share-api-fixtures.mjs"),
]);

const helpHref = 'https://github.com/FraGioco9/mfl-front-office/blob/main/docs/account-sharing-help.md';
const helpLink = '<a href="' + helpHref + '" target="_blank" rel="noreferrer" aria-label="Help for account, opt-in, saved and shared content">Help</a>';

assert.ok(htmlSource.includes(helpLink), "Canonical footer source must expose the public DOC-04 Help link.");
assert.ok(indexHtml.includes(helpLink), "Generated index must project the DOC-04 Help link.");
assert.ok(indexHtml.indexOf(helpLink) > indexHtml.indexOf(">Report a bug</button>"), "Help must remain a lightweight footer action after Report a bug.");

for (const token of [
  "| Guest | Yes | Yes | Yes | Opt-in screen | No |",
  "| Wallet connected but opted out | Yes | Yes | Yes | Opt-in screen | No |",
  "A browser-side opt-in marker is only a UI hint. It is not authentication by itself.",
  "Each Watchlist can contain up to **250 players**.",
  "A wallet can keep up to **5 Watchlists**.",
  "A wallet can keep up to **100 saved Evaluations**.",
  "A wallet can keep up to **50 saved plans**.",
  "New Evaluation shares expire **one calendar year** after creation.",
  "The owner can explicitly **Revoke** a share.",
  "Revocation makes the existing public link unavailable immediately.",
  "public pages remain usable;",
  "active public Evaluation/Planner share links remain readable;",
]) {
  assert.ok(guide.includes(token), "DOC-04 guide is missing required user-facing contract: " + token);
}

assert.ok(walletPreferences.includes("const MAX_WATCHLISTS = 5;"), "Watchlist guide limit must remain sourced from the API.");
assert.ok(walletPreferences.includes("const MAX_WATCHLIST_PLAYERS = 250;"), "Watchlist player guide limit must remain sourced from the API.");
assert.ok(walletPreferences.includes("return normalizeIdList(ids, MAX_WATCHLIST_PLAYERS);"), "250-player limit must be applied to Watchlist player ID normalization.");

assert.ok(evaluationSave.includes("const MAX_SAVED_EVALUATIONS_PER_WALLET = 100;"), "Saved Evaluation guide limit must remain sourced from the API.");
assert.ok(evaluationSave.includes('response.status(401).json({ error: "Opt in to use saved evaluations." });'), "Saved Evaluations must continue requiring opt-in.");

const evaluationPost = evaluationShare.indexOf('if (request.method === "POST")');
const evaluationAuth = evaluationShare.indexOf("signedWalletFromRequest(request)", evaluationPost);
const evaluationGet = evaluationShare.indexOf('if (request.method === "GET")');
assert.ok(evaluationPost >= 0 && evaluationAuth > evaluationPost && evaluationGet > evaluationAuth, "Evaluation share creation must authenticate before the separate public GET branch.");
assert.ok(evaluationShare.includes("expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);"), "Evaluation shares must retain one-calendar-year expiry.");
assert.ok(evaluationShare.includes('response.status(404).json({ error: "Evaluation share not found or expired." });'), "Expired/unavailable Evaluation shares must remain explicit 404s.");

assert.ok(plannerSave.includes("const MAX_SAVED_PLANS_PER_WALLET = 50;"), "Saved Planner guide limit must remain sourced from the API.");
assert.ok(plannerSave.includes('response.status(401).json({ error: "Opt in to use saved plans." });'), "Saved Planner plans must continue requiring opt-in.");

assert.ok(plannerShare.includes('if (request.method === "GET")'), "Planner must retain a public GET share path.");
assert.ok(plannerShare.includes('const owned = requestUrl.searchParams.get("owned") === "1";'), "Owner-only Planner share listing must remain explicitly separated from public GET.");
assert.ok(plannerShare.includes('if (request.method === "DELETE")'), "Planner share owner must retain explicit revoke support.");
assert.ok(plannerShare.includes('response.status(404).json({ error: "Shared plan not found or expired." });'), "Revoked/expired Planner shares must remain unavailable.");
assert.ok(plannerShare.includes("expires.setUTCFullYear(expires.getUTCFullYear() + 1);"), "Planner shares must retain one-year expiry.");
assert.ok(plannerShare.includes('response.setHeader("Cache-Control", "no-store");'), "Planner share reads must not cache revoked content.");

assert.ok(
  pageLifecycle.includes('["myplayers", "my-clubs", "planner", "watchlist", "settings"].includes(normalizedPage)')
    && pageLifecycle.includes('if (publicPlanPath || shareId) return false;'),
  "Opted-out private routes must stay locked while public Planner share paths remain exempt.",
);
assert.ok(
  staticUi.includes('Saved plans require Dapper opt-in; shared plans remain accessible.'),
  "Navigation accessibility copy must keep public Planner shares distinct from private saved plans.",
);

assert.ok(
  walletSession.includes('"Wallet authentication is temporarily unavailable."'),
  "Wallet-unavailable help must remain anchored to the server authentication failure contract.",
);
assert.ok(
  sec06Fixtures.includes('"A revoked share must immediately be unavailable without public caching."'),
  "DOC-04 revoked-share guidance must remain backed by the SEC-06 fixture.",
);

console.log("DOC-04 account, opt-in, save and public-sharing help contracts verified.");
