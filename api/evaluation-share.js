const { signedWalletFromRequest } = require("./_wallet-auth");
const { requireSameOriginMutation } = require("./_request-origin");
const { supabaseConfig, supabaseRequest } = require("./_supabase");
const { readJsonBody, sendRequestBodyError } = require("./_request-body");
const {
  normalizeEvaluationShareId,
  generateEvaluationShareId,
  normalizeEvaluationPayload,
} = require("./_evaluation-payload");
const { evaluationPresentValueTotalFromSharePayload } = require("./_evaluation-preview-value");
const { readActiveEvaluationShare } = require("./_evaluation-share-preview");
const { loadRatiosFromSupabase } = require("./mfl-season-ratios-v2");

const MAX_BODY_BYTES = 256 * 1024;

function evaluationShareExpiresAt(now = new Date()) {
  const expiresAt = new Date(now);
  const month = expiresAt.getUTCMonth();
  const dayOfMonth = expiresAt.getUTCDate();
  expiresAt.setUTCDate(1);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  expiresAt.setUTCMonth(month);
  const daysInTargetMonth = new Date(Date.UTC(
    expiresAt.getUTCFullYear(),
    month + 1,
    0,
  )).getUTCDate();
  expiresAt.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));
  return expiresAt.toISOString();
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
  if ((request.method === "POST" || request.method === "DELETE") && !requireSameOriginMutation(request, response)) return;

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

      const payload = normalizeEvaluationPayload(await readJsonBody(request, { maxBytes: MAX_BODY_BYTES }), { includeSummaryMetrics: true });

      if (!payload) {
        response.status(400).json({ error: "Invalid evaluation share payload." });
        return;
      }

      await snapshotPresentValue(payload);

      const id = generateEvaluationShareId();
      const expiresAt = evaluationShareExpiresAt();
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
      const row = Array.isArray(rows) ? rows[0] : null;

      response.status(200).json({
        id: row?.id || id,
        playerId: payload.playerId,
        expiresAt: row?.expires_at || expiresAt,
      });
      return;
    }

    if (request.method === "GET") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizeEvaluationShareId(requestUrl.searchParams.get("id"));
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

    if (request.method === "DELETE") {
      const wallet = await signedWalletFromRequest(request);
      if (!wallet) {
        response.status(401).json({ error: "Opt in to revoke shared evaluations." });
        return;
      }
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizeEvaluationShareId(requestUrl.searchParams.get("id"));
      if (!id) {
        response.status(400).json({ error: "Missing share id." });
        return;
      }
      // Idempotent and owner-scoped: callers cannot distinguish another
      // wallet's valid capability from an already absent/revoked share.
      await supabaseRequest(`evaluation_shares?id=eq.${encodeURIComponent(id)}&wallet_address=eq.${encodeURIComponent(wallet)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      response.status(200).json({ ok: true });
      return;
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    if (sendRequestBodyError(response, error)) return;
    console.warn("Could not handle evaluation share.", error);
    response.status(500).json({ error: "Could not handle evaluation share." });
  }
};