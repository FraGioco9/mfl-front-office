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

const [saveApi, shareApi, persistenceErrors, schema, migration, shareSourceMigration, shareUniqueSourceMigration, planRevisionMigration, sourcePlanIndexMigration, docs, html, planner, generatedPlanner, styles, generatedStyles, routing, lifecycle, bootstrap, stableRoutePage] = await Promise.all([
  readFile(new URL("./api/planner-save.js", import.meta.url), "utf8"),
  readFile(new URL("./api/planner-share.js", import.meta.url), "utf8"),
  readFile(new URL("./api/_planner-persistence.js", import.meta.url), "utf8"),
  readFile(new URL("./supabase-schema.sql", import.meta.url), "utf8"),
  readFile(new URL("./supabase/migrations/20260929215838_planner_plans_and_shares.sql", import.meta.url), "utf8"),
  readFile(new URL("./supabase/migrations/20260930125208_planner_share_source_plan.sql", import.meta.url), "utf8"),
  readFile(new URL("./supabase/migrations/20260930220112_planner_share_unique_source.sql", import.meta.url), "utf8"),
  readFile(new URL("./supabase/migrations/20260930220121_planner_plan_revision.sql", import.meta.url), "utf8"),
  readFile(new URL("./supabase/migrations/20260930220230_planner_share_source_plan_index.sql", import.meta.url), "utf8"),
  readFile(new URL("./SUPABASE_PERSISTENCE.md", import.meta.url), "utf8"),
  readFile(new URL("./html-sources/planner.html", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/planner.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/app-core-planner-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("./planner.css", import.meta.url), "utf8"),
  readFile(new URL("./styles-runtime.css", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/shared-routing.js", import.meta.url), "utf8"),
  readFile(new URL("./modules/core-sources/shared-page-lifecycle.js", import.meta.url), "utf8"),
  readFile(new URL("./bootstrap.js", import.meta.url), "utf8"),
  readFile(new URL("./pages/planner/[planId].js", import.meta.url), "utf8"),
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
assert(shareApi.includes('signedWalletFromRequest(request)') && shareApi.includes('request.method === "GET"')
  && shareApi.includes('request.method === "DELETE"')
  && shareApi.includes('requestUrl.searchParams.get("owned") === "1"')
  && shareApi.includes("source_plan_id"));
assert(saveApi.includes('sendPlannerPersistenceUnavailable(response, error, "planner_plans")'));
assert(shareApi.includes('sendPlannerPersistenceUnavailable(response, error, "planner_shares")'));
assert(persistenceErrors.includes("Planner persistence is not initialized.")
  && persistenceErrors.includes("Apply the latest Supabase Planner migration"));
assert(shareApi.includes("expires_at=gt.") && !shareApi.includes("select=id,name,club_id,payload,created_at,expires_at,wallet_address"));
assert(shareSourceMigration.includes("add column if not exists source_plan_id text")
  && shareSourceMigration.includes("planner_shares_wallet_source_idx")
  && schema.includes("source_plan_id text"));
assert(shareUniqueSourceMigration.includes("row_number() over")
  && shareUniqueSourceMigration.includes("drop index if exists public.planner_shares_wallet_source_idx")
  && shareUniqueSourceMigration.includes("create unique index planner_shares_wallet_source_idx")
  && shareUniqueSourceMigration.includes("(wallet_address, source_plan_id)"));
assert(schema.includes("create unique index if not exists planner_shares_wallet_source_idx on public.planner_shares (wallet_address, source_plan_id);"));
assert(planRevisionMigration.includes("add column if not exists revision integer not null default 1")
  && planRevisionMigration.includes("foreign key (source_plan_id)")
  && planRevisionMigration.includes("on delete cascade"));
assert(schema.includes("revision integer not null default 1")
  && schema.includes("source_plan_id text references public.planner_plans(id) on delete cascade"));
assert(sourcePlanIndexMigration.includes("create index if not exists planner_shares_source_plan_idx")
  && sourcePlanIndexMigration.includes("on public.planner_shares (source_plan_id)"));
assert(schema.includes("create index if not exists planner_shares_source_plan_idx on public.planner_shares (source_plan_id);"));
assert(saveApi.includes("normalizePlannerRevision")
  && saveApi.includes("revision=eq." + "${expectedRevision}")
  && saveApi.includes("revision: expectedRevision + 1")
  && saveApi.includes('response.status(409).json({ error: "Saved plan changed. Reload it before saving." })')
  && saveApi.includes('response.status(409).json({ error: "Saved plan changed. Reload it before deleting." })'));
assert(shareApi.includes('"planner_shares?on_conflict=wallet_address,source_plan_id"')
  && shareApi.includes('"resolution=merge-duplicates,return=representation"')
  && !shareApi.includes('planner_shares?wallet_address=eq.${encodeURIComponent(wallet)}&source_plan_id=eq.${encodeURIComponent(sourcePlanId)}'));
assert(docs.includes("### `planner_plans`") && docs.includes("### `planner_shares`")
  && docs.includes("owners can explicitly revoke a share by ID"));
assert(docs.includes("without opting in") && docs.includes("current packaged database"));

assert(html.includes('id="plannerPlanBar"') && html.includes('id="plannerPlansModal"') && html.includes('id="plannerSharedBanner"'));
assert(html.includes('id="plannerPlanMode" class="plannerPlanMode" aria-live="polite">Draft</span>') && html.includes('id="plannerDuplicatePlanButton"'));
assert(html.includes('id="plannerPlansButton"') && html.includes('id="plannerNewPlanButton"')
  && html.includes('id="plannerSavePlanButton"') && html.includes('id="plannerSharePlanButton"')
  && !html.includes('id="plannerRevokeShareButton"'));
assert(planner.includes('sharePlanButton.textContent=shared?"Revoke":"Share";')
  && planner.includes('const action=revoking?revokePlannerShare():shareCurrentPlan();')
  && planner.includes('action("Revoke share"')
  && planner.includes('action("Share plan"')
  && planner.includes('action("Copy share link"'));
assert(!html.includes('id="plannerSaveAsPlanButton"') && !planner.includes("saveAsPlanButton"));
assert(html.includes('id="plannerPlanNameModal"') && html.includes('id="plannerPlanNameInput"')
  && html.includes('id="plannerPlanDeleteModal"') && html.includes('id="plannerPlanRevokeModal"')
  && html.includes('id="plannerPlanRevokeConfirmButton"'));
assert(planner.includes("requestPlannerPlanRevoke")
  && planner.includes("copyPlannerShareLink")
  && planner.includes('if(!silent&&!await requestPlannerPlanRevoke(name||activePlanName||"this plan"))return false;'));
assert(html.includes('<span class="plannerPlanNameLabel">Name</span>')
  && html.includes('id="plannerPlanNameInput" type="text" maxlength="60" autocomplete="off" spellcheck="false"')
  && !html.includes('<label for="plannerPlanNameInput">Name</label>'));
assert(html.includes("getAssignments()") && html.includes("setAssignments(entries)") && html.includes("setReadOnly(value)"));
assert(html.includes('const initialPlanMatch = String(location.pathname || "").match(/^\\/planner\\/([a-f0-9]{16})\\/?$/i);')
  && html.includes('root.dataset.storedWalletOptIn !== "true" && !initialPublicPlanId'));
assert(planner.includes("currentPlannerPayload") && planner.includes("resolvePlannerPlayers"));
assert(planner.includes('scope:"players"') && planner.includes('playerIds:ids.join(",")'));
assert(planner.includes("if(!player||plannerPlayerIsRetired(player))return null;")
  && generatedPlanner.includes("if(!player||plannerPlayerIsRetired(player))return null;"),
  "Saved/shared plan restoration must drop players that are now explicitly retired.");
assert(planner.includes('"/api/planner-save"') && planner.includes('"/api/planner-share"'));
assert(planner.includes("activePlanRevision")
  && planner.includes("expectedRevision:overwriting?activePlanRevision:0")
  && planner.includes("expectedRevision:plan.revision")
  && planner.includes('&revision="+encodeURIComponent(plannerPlanRevision(plan.revision))')
  && generatedPlanner.includes("activePlanRevision"));
assert(planner.includes('pathPlanMatch=String(location.pathname||"").match(/^\\/planner\\/([a-f0-9]{16})\\/?$/i)')
  && planner.includes("loadPlannerPlanById")
  && planner.includes("newPlannerPlan")
  && planner.includes("revokePlannerShare"));
assert(planner.includes("plannerReadOnly") && planner.includes("copySharedPlannerPlan"));
assert(planner.includes("requestPlannerPlanName") && planner.includes("requestPlannerPlanDelete"));
assert(!planner.includes("window.prompt(") && planner.includes('window.confirm("You have unsaved Planner changes. Leave without saving?")'));
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
assert(routing.includes('const plannerPlanMatch = cleanPath.match(/^\\/planner\\/([a-f0-9]{16})$/i);')
  && routing.includes('const planId = String(pathPlanId || legacyShareId || legacySavedId)')
  && routing.includes('? `/planner/${encodeURIComponent(planId)}`')
  && routing.includes('/^\\/planner\\/[a-f0-9]{16}$/i.test(explicitPath)'));
assert(lifecycle.includes("function protectedOptOutRoute(pageName, options = {})")
  && lifecycle.includes('/^\\/planner\\/[a-f0-9]{16}$/i.test(explicitPath)')
  && lifecycle.includes("if (publicPlanPath || shareId) return false;"));
assert(bootstrap.includes("const publicPlannerShare = pageName === \"planner\"")
  && bootstrap.includes('/^\\/planner\\/[a-f0-9]{16}\\/?$/i.test(String(window.location.pathname || ""))')
  && bootstrap.includes("root.dataset.storedWalletOptIn === \"true\" || publicPlannerShare"));
assert(stableRoutePage.includes("MflPlannerPlanPage")
  && stableRoutePage.includes('initialPageMetadata("/planner")')
  && stableRoutePage.includes('React.createElement("title", null, metadata.title)'));

console.log("Planner saved plans and unlisted share persistence validation passed.");
