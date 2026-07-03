const crypto = require("crypto");

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function supabaseRequest(pathname, options = {}) {
  const config = supabaseConfig();

  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}: ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeShareId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function normalizeEvaluationPayload(payload) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const playerId = String(data.playerId || "").trim();
  const mflPerUsd = Number(data.mflPerUsd);
  const overallValues = Array.isArray(data.overallValues)
    ? data.overallValues.map((value) => Number(value)).filter((value) => Number.isFinite(value)).slice(0, 40)
    : [];
  const summaryPosition = String(data.summaryPosition || "").trim().slice(0, 12);

  if (!playerId) {
    return null;
  }

  return {
    playerId,
    mflPerUsd: Number.isFinite(mflPerUsd) && mflPerUsd > 0 ? Math.round(mflPerUsd * 100) / 100 : 400,
    ignoreDiscountRate: Boolean(data.ignoreDiscountRate),
    ignoreFirstSeason: Boolean(data.ignoreFirstSeason),
    overallValues,
    summaryPosition,
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
      const rawBody = await readBody(request);
      const payload = normalizeEvaluationPayload(rawBody ? JSON.parse(rawBody) : {});

      if (!payload) {
        response.status(400).json({ error: "Invalid evaluation share payload." });
        return;
      }

      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const rows = await supabaseRequest("evaluation_shares", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([{
          id,
          player_id: payload.playerId,
          payload,
          expires_at: expiresAt,
        }]),
      });

      response.status(200).json({
        id: Array.isArray(rows) && rows[0]?.id ? rows[0].id : id,
        expiresAt,
      });
      return;
    }

    if (request.method === "GET") {
      const requestUrl = new URL(request.url, "http://localhost");
      const id = normalizeShareId(requestUrl.searchParams.get("id"));

      if (!id) {
        response.status(400).json({ error: "Missing share id." });
        return;
      }

      const rows = await supabaseRequest(`evaluation_shares?select=id,player_id,payload,expires_at&id=eq.${encodeURIComponent(id)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
      const row = Array.isArray(rows) ? rows[0] : null;

      if (!row) {
        response.status(404).json({ error: "Evaluation share not found or expired." });
        return;
      }

      response.status(200).json({
        id: row.id,
        playerId: row.player_id,
        payload: row.payload,
        expiresAt: row.expires_at,
      });
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.warn("Could not handle evaluation share.", error);
    response.status(500).json({ error: "Could not handle evaluation share." });
  }
};
