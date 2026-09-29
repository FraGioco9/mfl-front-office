import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  normalizePlannerId,
  normalizePlannerName,
  normalizePlannerPayload,
} = require("./api/_planner-payload.js");

assert.equal(normalizePlannerId("ABCDEF0123456789"), "abcdef0123456789");
assert.equal(normalizePlannerId("bad"), "");
assert.equal(normalizePlannerName("  Main   plan  "), "Main plan");

const normalized = normalizePlannerPayload({
  clubId: "9001",
  formation: "4231",
  squad: [
    { playerId: 10, contract: 4.125 },
    { playerId: "11", contract: 99 },
    { playerId: 10, contract: 2 },
  ],
  lineup: [
    { slotKey: "ST#1", playerId: 10 },
    { slotKey: "CM#1", playerId: 11 },
    { slotKey: "CM#2", playerId: 99 },
  ],
});
assert.deepEqual(normalized, {
  schemaVersion: 1,
  clubId: "9001",
  formation: "4231",
  squad: [
    { playerId: "10", contract: 4.13 },
    { playerId: "11", contract: 20 },
  ],
  lineup: [
    { slotKey: "ST#1", playerId: "10" },
    { slotKey: "CM#1", playerId: "11" },
  ],
});
assert.equal(normalizePlannerPayload({ clubId: "9001", formation: "invalid", squad: [], lineup: [] }), null);
const budgeted = normalizePlannerPayload({
  clubId: "9001",
  formation: "442",
  squad: Array.from({ length: 6 }, (_, index) => ({ playerId: 100 + index, contract: 20 })),
  lineup: [],
});
assert.equal(budgeted.squad.reduce((sum, player) => sum + player.contract, 0), 100, "Server normalization must cap the aggregate contract budget at 100%.");

const [saveApi, shareApi, persistenceErrors, schema, migration, docs, html, planner, generatedPlanner, styles, generatedStyles, routing, lifecycle, bootstrap] = await Promise.all([
  readFile(new URL("./api/planner-save.js", import.meta.url), "utf8"),
  readFile(new URL("./api/planner-share.js", import.meta.url), "utf8"),
  readFile(new URL("./api/_planner-persistence.js", import.meta.url), "utf8"),
  readFile(new URL("./supabase-schema.sql", import.meta.url), "utf8"),
  readFile(new URL("./supabase/migrations/20260929215838_planner_plans_and_shares.sql", import.meta.url), "utf8"),
  readFile(new URL("./SUPABASE_PERSISTENCE.md", import.meta.url), "utf8"),
  readFile(new URL("./html-sources/planner.html", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/planner.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/app-core-planner-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("./planner.css", import.meta.url), "utf8"),
  readFile(new URL("./styles-runtime.css", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/shared-routing.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/shared-page-lifecycle.js", import.meta.url), "utf8"),
  readFile(new URL("./bootstrap.js", import.meta.url), "utf8"),
]);

for (const source of [schema, migration]) {
  assert(source.includes("create table if not exists public.planner_plans"));
  assert(source.includes("create table if not exists public.planner_shares"));
  assert(source.includes("planner_plans_wallet_updated_idx"));
  assert(source.includes("planner_shares_expires_at_idx"));
  assert(source.includes("alter table public.planner_plans enable row level security;"));
  assert(source.includes("alter table public.planner_shares enable row level security;"));
  assert(source.includes("grant select, insert, update, delete on table public.planner_plans to service_role"));
  assert(source.includes("grant select, insert, update, delete on table public.planner_shares to service_role"));
}
assert(saveApi.includes('signedWalletFromRequest(request)') && saveApi.includes("MAX_SAVED_PLANS_PER_WALLET = 50"));
assert(saveApi.includes('method: "PATCH"') && saveApi.includes('method: "DELETE"'));
assert(shareApi.includes('signedWalletFromRequest(request)') && shareApi.includes('request.method === "GET"'));
assert(saveApi.includes('sendPlannerPersistenceUnavailable(response, error, "planner_plans")'));
assert(shareApi.includes('sendPlannerPersistenceUnavailable(response, error, "planner_shares")'));
assert(persistenceErrors.includes("Planner persistence is not initialized.")
  && persistenceErrors.includes("Apply the latest Supabase Planner migration"));
assert(shareApi.includes("expires_at=gt.") && !shareApi.includes("select=id,name,club_id,payload,created_at,expires_at,wallet_address"));
assert(docs.includes("### `planner_plans`") && docs.includes("### `planner_shares`"));
assert(docs.includes("view the share without opting in") && docs.includes("current packaged database"));

assert(html.includes('id="plannerPlanBar"') && html.includes('id="plannerPlansModal"') && html.includes('id="plannerSharedBanner"'));
assert(html.includes('id="plannerPlansButton"') && html.includes('id="plannerSavePlanButton"') && html.includes('id="plannerSharePlanButton"'));
assert(!html.includes('id="plannerSaveAsPlanButton"') && !planner.includes("saveAsPlanButton"));
assert(html.includes('id="plannerPlanNameModal"') && html.includes('id="plannerPlanNameInput"') && html.includes('id="plannerPlanDeleteModal"'));
assert(html.includes('<span class="plannerPlanNameLabel">Name</span>')
  && html.includes('id="plannerPlanNameInput" type="text" maxlength="60" autocomplete="off" spellcheck="false"')
  && !html.includes('<label for="plannerPlanNameInput">Name</label>'));
assert(html.includes("getAssignments()") && html.includes("setAssignments(entries)") && html.includes("setReadOnly(value)"));
assert(html.includes('root.dataset.storedWalletOptIn !== "true" && !initialShareId'));
assert(planner.includes("currentPlannerPayload") && planner.includes("resolvePlannerPlayers"));
assert(planner.includes('scope:"players"') && planner.includes('playerIds:ids.join(",")'));
assert(planner.includes('"/api/planner-save"') && planner.includes('"/api/planner-share"'));
assert(planner.includes('routeParams.get("share")') && planner.includes('routeParams.get("saved")'));
assert(planner.includes("plannerReadOnly") && planner.includes("copySharedPlannerPlan"));
assert(planner.includes("requestPlannerPlanName") && planner.includes("requestPlannerPlanDelete"));
assert(!planner.includes("window.prompt(") && !planner.includes("window.confirm("));
assert(generatedPlanner.startsWith("// Generated") && generatedPlanner.includes("currentPlannerPayload"));
assert(styles.includes(".plannerPlanBar{") && styles.includes(".plannerPlansDialog{") && styles.includes(".plannerSharedBanner{"));
assert(styles.includes(".plannerPlanNameDialog{width:min(440px,calc(100vw - 40px))")
  && styles.includes(".plannerPlanNameLabel{color:var(--text-soft)")
  && styles.includes("pointer-events:none")
  && !styles.includes(".plannerPlanNameDialog,.plannerPlanDeleteDialog{")
  && !styles.includes(".plannerPlanDeleteConfirmButton{color:var(--danger)}"));
assert(html.includes('class="mflDialog deleteWatchlistDialog plannerPlanDeleteDialog"')
  && html.includes('class="deleteWatchlistBody plannerPlanDeleteBody"')
  && html.includes('class="mflDialogFooter deleteWatchlistFooter plannerPlanDeleteFooter"')
  && html.includes('class="deleteWatchlistConfirmButton plannerPlanDeleteConfirmButton"'));
assert(generatedStyles.includes(".plannerPlanBar{") && generatedStyles.includes(".plannerPlansDialog{"));
assert(routing.includes('const shareId = String(params.get("share") || "").trim();')
  && routing.includes('!shareId && !hasWalletOptIn()')
  && routing.includes('/planner?share='));
assert(lifecycle.includes("function protectedOptOutRoute(pageName, options = {})")
  && lifecycle.includes('explicitPath.startsWith("/planner?share=")')
  && lifecycle.includes("if (shareId) return false;"));
assert(bootstrap.includes("const publicPlannerShare = pageName === \"planner\"")
  && bootstrap.includes("root.dataset.storedWalletOptIn === \"true\" || publicPlannerShare"));

console.log("Planner saved plans and unlisted share persistence validation passed.");
