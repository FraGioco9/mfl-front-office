const { signedWalletFromRequest } = require("./_wallet-auth");
const { supabaseConfig, supabaseRequest } = require("./_supabase");
const { readJsonBody, sendRequestBodyError } = require("./_request-body");
const { sendPlannerPersistenceUnavailable } = require("./_planner-persistence");
const {
  normalizePlannerId,
  generatePlannerId,
  normalizePlannerName,
  normalizePlannerPayload,
} = require("./_planner-payload");

const MAX_BODY_BYTES = 128 * 1024;

function shareExpiresAt(now = new Date()) {
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return expires.toISOString();
}

function responseShare(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    clubId: String(row.club_id || ""),
    payload: row.payload || {},
    createdAt: row.created_at || "",
    expiresAt: row.expires_at || "",
    ...(owner ? { sourcePlanId: String(row.source_plan_id || "") } : {}),
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!supabaseConfig()) {
    response.status(500).json({ error: "Supabase is not configured." });
    return;
  }

  try {
    if (request.method === "POST") {
      const wallet = await signedWalletFromRequest(request);
      if (!wallet) {
        response.status(401).json({ error: "Opt in to share plans." });
        return;
      }
      const body = await readJsonBody(request, { maxBytes: MAX_BODY_BYTES });
      const name = normalizePlannerName(body?.name);
      const payload = normalizePlannerPayload(body?.payload || body);
      const sourcePlanId = normalizePlannerId(body?.sourcePlanId || body?.savedId);
      if (!name || !payload) {
        response.status(400).json({ error: "Invalid planner share payload." });
        return;
      }
      if (sourcePlanId) {
        const ownedPlans = await supabaseRequest(`planner_plans?select=id&wallet_address=eq.${encodeURIComponent(wallet)}&id=eq.${encodeURIComponent(sourcePlanId)}&limit=1`);
        if (!Array.isArray(ownedPlans) || !ownedPlans[0]) {
          response.status(404).json({ error: "Saved plan not found." });
          return;
        }
      }
      const id = generatePlannerId();
      const expiresAt = shareExpiresAt();
      const sharePath = sourcePlanId
        ? "planner_shares?on_conflict=wallet_address,source_plan_id"
        : "planner_shares";
      const rows = await supabaseRequest(sharePath, {
        method: "POST",
        headers: { Prefer: sourcePlanId ? "resolution=merge-duplicates,return=representation" : "return=representation" },
        body: JSON.stringify([{ id, wallet_address: wallet, source_plan_id: sourcePlanId || null, club_id: payload.clubId, name, payload, expires_at: expiresAt }]),
      });
      response.status(200).json({ share: responseShare(Array.isArray(rows) ? rows[0] : { id, name, source_plan_id: sourcePlanId || null, club_id: payload.clubId, payload, expires_at: expiresAt }, { owner: true }) });
      return;
    }

    if (request.method === "GET") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizePlannerId(requestUrl.searchParams.get("id"));
      const owned = requestUrl.searchParams.get("owned") === "1";
      if (owned) {
        const wallet = await signedWalletFromRequest(request);
        if (!wallet) {
          response.status(401).json({ error: "Opt in to manage shared plans." });
          return;
        }
        const rows = await supabaseRequest(`planner_shares?select=id,name,club_id,payload,source_plan_id,created_at,expires_at&wallet_address=eq.${encodeURIComponent(wallet)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc`);
        response.status(200).json({ shares: Array.isArray(rows) ? rows.map(row => responseShare(row, { owner: true })).filter(Boolean) : [] });
        return;
      }
      if (!id) {
        response.status(400).json({ error: "Missing share id." });
        return;
      }
      const rows = await supabaseRequest(`planner_shares?select=id,name,club_id,payload,created_at,expires_at&id=eq.${encodeURIComponent(id)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) {
        response.status(404).json({ error: "Shared plan not found or expired." });
        return;
      }
      response.status(200).json({ share: responseShare(row) });
      return;
    }

    if (request.method === "DELETE") {
      const wallet = await signedWalletFromRequest(request);
      if (!wallet) {
        response.status(401).json({ error: "Opt in to revoke shared plans." });
        return;
      }
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizePlannerId(requestUrl.searchParams.get("id"));
      if (!id) {
        response.status(400).json({ error: "Missing share id." });
        return;
      }
      await supabaseRequest(`planner_shares?id=eq.${encodeURIComponent(id)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    if (sendRequestBodyError(response, error)) return;
    if (sendPlannerPersistenceUnavailable(response, error, "planner_shares")) return;
    console.warn("Could not handle planner share.", error);
    response.status(500).json({ error: "Could not handle shared plan." });
  }
};
