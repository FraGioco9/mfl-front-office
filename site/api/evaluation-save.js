const { signedWalletFromRequest } = require("./_wallet-proof");
const { supabaseConfig, supabaseRequest } = require("./_supabase");
const { readJsonBody } = require("./_request-body");
const {
  normalizeEvaluationId,
  generateEvaluationId,
  normalizeEvaluationPayload,
} = require("./_evaluation-payload");

const MAX_SAVED_EVALUATIONS_PER_WALLET = 100;

async function savedEvaluationCount(wallet) {
  const rows = await supabaseRequest(`evaluation_saves?select=id&wallet_address=eq.${encodeURIComponent(wallet)}`);
  return Array.isArray(rows) ? rows.length : 0;
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
      response.status(401).json({ error: "Opt in to use saved evaluations." });
      return;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      const payload = normalizeEvaluationPayload(body, { includeSummaryMetrics: true });
      const requestedSavedId = normalizeEvaluationId(body.savedId || body.id);

      if (!payload) {
        response.status(400).json({ error: "Invalid evaluation save payload." });
        return;
      }

      if (requestedSavedId) {
        const existingRows = await supabaseRequest(`evaluation_saves?select=id&wallet_address=eq.${encodeURIComponent(wallet)}&id=eq.${encodeURIComponent(requestedSavedId)}&limit=1`);
        const existing = Array.isArray(existingRows) ? existingRows[0] : null;

        if (!existing) {
          response.status(404).json({ error: "Saved evaluation not found." });
          return;
        }

        const rows = await supabaseRequest(`evaluation_saves?id=eq.${encodeURIComponent(requestedSavedId)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            player_id: payload.playerId,
            payload,
          }),
        });

        response.status(200).json({
          id: Array.isArray(rows) && rows[0]?.id ? rows[0].id : requestedSavedId,
          playerId: payload.playerId,
          overwritten: true,
        });
        return;
      }

      if (await savedEvaluationCount(wallet) >= MAX_SAVED_EVALUATIONS_PER_WALLET) {
        response.status(429).json({ error: `You can save a maximum of ${MAX_SAVED_EVALUATIONS_PER_WALLET} evaluations.` });
        return;
      }

      const id = generateEvaluationId();
      const rows = await supabaseRequest("evaluation_saves", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([{
          id,
          wallet_address: wallet,
          player_id: payload.playerId,
          payload,
        }]),
      });

      response.status(200).json({
        id: Array.isArray(rows) && rows[0]?.id ? rows[0].id : id,
        playerId: payload.playerId,
        overwritten: false,
      });
      return;
    }

    if (request.method === "GET") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizeEvaluationId(requestUrl.searchParams.get("id"));
      const playerId = String(requestUrl.searchParams.get("player") || requestUrl.searchParams.get("playerId") || "").trim();

      if (id) {
        const playerFilter = playerId ? `&player_id=eq.${encodeURIComponent(playerId)}` : "";
        const rows = await supabaseRequest(`evaluation_saves?select=id,player_id,payload,created_at&id=eq.${encodeURIComponent(id)}&wallet_address=eq.${encodeURIComponent(wallet)}${playerFilter}&limit=1`);
        const row = Array.isArray(rows) ? rows[0] : null;

        if (!row) {
          response.status(404).json({ error: "Saved evaluation not found." });
          return;
        }

        response.status(200).json({
          id: row.id,
          playerId: row.player_id,
          payload: row.payload,
          createdAt: row.created_at,
        });
        return;
      }

      const rows = await supabaseRequest(`evaluation_saves?select=id,player_id,payload,created_at&wallet_address=eq.${encodeURIComponent(wallet)}&order=created_at.desc&limit=${MAX_SAVED_EVALUATIONS_PER_WALLET}`);
      response.status(200).json({
        evaluations: Array.isArray(rows) ? rows.map((row) => ({
          id: row.id,
          playerId: row.player_id,
          payload: row.payload,
          createdAt: row.created_at,
        })) : [],
      });
      return;
    }

    if (request.method === "DELETE") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizeEvaluationId(requestUrl.searchParams.get("id"));

      if (!id) {
        response.status(400).json({ error: "Missing saved evaluation id." });
        return;
      }

      await supabaseRequest(`evaluation_saves?id=eq.${encodeURIComponent(id)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal",
        },
      });

      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.warn("Could not handle saved evaluation.", error);
    response.status(500).json({ error: "Could not handle saved evaluation." });
  }
};