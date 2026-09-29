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

const MAX_SAVED_PLANS_PER_WALLET = 50;
const MAX_BODY_BYTES = 128 * 1024;

async function savedPlanCount(wallet) {
  const rows = await supabaseRequest(`planner_plans?select=id&wallet_address=eq.${encodeURIComponent(wallet)}`);
  return Array.isArray(rows) ? rows.length : 0;
}

function responsePlan(row) {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    clubId: String(row.club_id || ""),
    payload: row.payload || {},
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!supabaseConfig()) {
    response.status(500).json({ error: "Supabase is not configured." });
    return;
  }

  try {
    const wallet = await signedWalletFromRequest(request);
    if (!wallet) {
      response.status(401).json({ error: "Opt in to use saved plans." });
      return;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request, { maxBytes: MAX_BODY_BYTES });
      const name = normalizePlannerName(body?.name);
      const payload = normalizePlannerPayload(body?.payload || body);
      const requestedId = normalizePlannerId(body?.savedId || body?.id);
      if (!name || !payload) {
        response.status(400).json({ error: "Invalid planner save payload." });
        return;
      }

      if (requestedId) {
        const existingRows = await supabaseRequest(`planner_plans?select=id&wallet_address=eq.${encodeURIComponent(wallet)}&id=eq.${encodeURIComponent(requestedId)}&limit=1`);
        if (!Array.isArray(existingRows) || !existingRows[0]) {
          response.status(404).json({ error: "Saved plan not found." });
          return;
        }
        const rows = await supabaseRequest(`planner_plans?id=eq.${encodeURIComponent(requestedId)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ name, club_id: payload.clubId, payload, updated_at: new Date().toISOString() }),
        });
        response.status(200).json({ plan: responsePlan(Array.isArray(rows) ? rows[0] : { id: requestedId, name, club_id: payload.clubId, payload }) });
        return;
      }

      if (await savedPlanCount(wallet) >= MAX_SAVED_PLANS_PER_WALLET) {
        response.status(429).json({ error: `You can save a maximum of ${MAX_SAVED_PLANS_PER_WALLET} plans.` });
        return;
      }

      const id = generatePlannerId();
      const rows = await supabaseRequest("planner_plans", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{ id, wallet_address: wallet, club_id: payload.clubId, name, payload }]),
      });
      response.status(200).json({ plan: responsePlan(Array.isArray(rows) ? rows[0] : { id, name, club_id: payload.clubId, payload }) });
      return;
    }

    if (request.method === "GET") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizePlannerId(requestUrl.searchParams.get("id"));
      if (id) {
        const rows = await supabaseRequest(`planner_plans?select=id,name,club_id,payload,created_at,updated_at&id=eq.${encodeURIComponent(id)}&wallet_address=eq.${encodeURIComponent(wallet)}&limit=1`);
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) {
          response.status(404).json({ error: "Saved plan not found." });
          return;
        }
        response.status(200).json({ plan: responsePlan(row) });
        return;
      }
      const rows = await supabaseRequest(`planner_plans?select=id,name,club_id,payload,created_at,updated_at&wallet_address=eq.${encodeURIComponent(wallet)}&order=updated_at.desc&limit=${MAX_SAVED_PLANS_PER_WALLET}`);
      response.status(200).json({ plans: Array.isArray(rows) ? rows.map(responsePlan).filter(Boolean) : [] });
      return;
    }

    if (request.method === "DELETE") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizePlannerId(requestUrl.searchParams.get("id"));
      if (!id) {
        response.status(400).json({ error: "Missing saved plan id." });
        return;
      }
      await supabaseRequest(`planner_plans?id=eq.${encodeURIComponent(id)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    if (sendRequestBodyError(response, error)) return;
    if (sendPlannerPersistenceUnavailable(response, error, "planner_plans")) return;
    console.warn("Could not handle saved planner plan.", error);
    response.status(500).json({ error: "Could not handle saved plan." });
  }
};
