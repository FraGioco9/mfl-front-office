const { signedWalletFromRequest } = require("./_wallet-proof");
const { supabaseConfig, supabaseRequest } = require("./_supabase");
const { readJsonBody } = require("./_request-body");
const {
  normalizeEvaluationId,
  generateEvaluationId,
  normalizeEvaluationPayload,
} = require("./_evaluation-payload");
const { evaluationPresentValueTotalFromSharePayload } = require("./_evaluation-preview-value");
const { readActiveEvaluationShare } = require("./_evaluation-share-preview");
const { loadRatiosFromSupabase } = require("./mfl-season-ratios-v2");

async function activeShareRows(wallet) {
  const rows = await supabaseRequest(`evaluation_shares?select=id,created_at&wallet_address=eq.${encodeURIComponent(wallet)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc`);
  return Array.isArray(rows) ? rows : [];
}

async function pruneOldestActiveShare(wallet) {
  const rows = await activeShareRows(wallet);

  if (rows.length < 5) {
    return;
  }

  const oldest = rows[0];

  if (!oldest?.id) {
    return;
  }

  await supabaseRequest(`evaluation_shares?id=eq.${encodeURIComponent(oldest.id)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

async function snapshotPresentValue(payload) {
  let ratioRows = [];

  if (!payload.ignoreDiscountRate) {
    try {
      ratioRows = await loadRatiosFromSupabase();
    } catch (error) {
      console.warn("Could not load live MFL season ratios while creating Evaluation share.", error);
      return payload;
    }
  }

  const presentValue = evaluationPresentValueTotalFromSharePayload(payload, {}, ratioRows);
  if (Number.isFinite(presentValue)) {
    payload.summaryPresentValue = presentValue;
  }
  return payload;
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
        response.status(401).json({ error: "Opt in to share evaluations." });
        return;
      }

      const payload = normalizeEvaluationPayload(await readJsonBody(request), { includeSummaryMetrics: true });

      if (!payload) {
        response.status(400).json({ error: "Invalid evaluation share payload." });
        return;
      }

      await snapshotPresentValue(payload);
      await pruneOldestActiveShare(wallet);

      const id = generateEvaluationId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const rows = await supabaseRequest("evaluation_shares", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([{
          id,
          wallet_address: wallet,
          player_id: payload.playerId,
          payload,
          expires_at: expiresAt,
        }]),
      });

      response.status(200).json({
        id: Array.isArray(rows) && rows[0]?.id ? rows[0].id : id,
        playerId: payload.playerId,
        expiresAt,
      });
      return;
    }

    if (request.method === "GET") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizeEvaluationId(requestUrl.searchParams.get("id"));
      const playerId = String(requestUrl.searchParams.get("player") || requestUrl.searchParams.get("playerId") || "").trim();

      if (!id) {
        response.status(400).json({ error: "Missing share id." });
        return;
      }

      const row = await readActiveEvaluationShare(id, playerId);

      if (!row) {
        response.status(404).json({ error: "Evaluation share not found or expired." });
        return;
      }

      response.status(200).json({
        id: row.id,
        playerId: row.playerId,
        payload: row.payload,
        expiresAt: row.expiresAt,
      });
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.warn("Could not handle evaluation share.", error);
    response.status(500).json({ error: "Could not handle evaluation share." });
  }
};
