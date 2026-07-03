const crypto = require("crypto");
const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

function normalizeWalletAddress(address) {
  const value = String(address || "").trim().toLowerCase();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function signatureWalletAddresses(signatures) {
  return new Set((Array.isArray(signatures) ? signatures : [])
    .map((signature) => normalizeWalletAddress(signature?.addr || signature?.address))
    .filter(Boolean));
}

function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

function stringToHex(value) {
  return Buffer.from(value, "utf8").toString("hex");
}

async function verifyWalletProof(request) {
  const wallet = normalizeWalletAddress(request.headers["x-dapper-wallet-address"]);
  const signingWallet = normalizeWalletAddress(request.headers["x-wallet-signing-address"] || wallet);
  const message = String(request.headers["x-wallet-message"] || "");
  const proofType = String(request.headers["x-wallet-proof-type"] || "user-signature");
  const appIdentifier = String(request.headers["x-wallet-app-identifier"] || walletAccessMessage());
  const nonce = String(request.headers["x-wallet-nonce"] || "");
  let signatures = [];

  try {
    signatures = JSON.parse(String(request.headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

  if (!wallet || !signingWallet || message !== walletAccessMessage() || !Array.isArray(signatures) || !signatures.length) {
    return "";
  }

  try {
    if (proofType === "account-proof") {
      const verified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: signingWallet,
        nonce,
        signatures,
      });

      if (verified) {
        return wallet;
      }

      if (signingWallet !== wallet) {
        const walletVerified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        });

        return walletVerified ? wallet : "";
      }

      return "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return "";
    }

    return (await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures)) ? wallet : "";
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);
    return "";
  }
}

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

async function activeShareCount(wallet) {
  const rows = await supabaseRequest(`evaluation_shares?select=id&wallet_address=eq.${encodeURIComponent(wallet)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);

  return Array.isArray(rows) ? rows.length : 0;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!supabaseConfig()) {
    response.status(500).json({ error: "Supabase is not configured." });
    return;
  }

  try {
    if (request.method === "POST") {
      const wallet = await verifyWalletProof(request);

      if (!wallet) {
        response.status(401).json({ error: "Opt in to share evaluations." });
        return;
      }

      const rawBody = await readBody(request);
      const payload = normalizeEvaluationPayload(rawBody ? JSON.parse(rawBody) : {});

      if (!payload) {
        response.status(400).json({ error: "Invalid evaluation share payload." });
        return;
      }

      if (await activeShareCount(wallet) >= 5) {
        response.status(429).json({ error: "You can have a maximum of 5 active shared evaluations." });
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
      const id = normalizeShareId(requestUrl.searchParams.get("id"));
      const playerId = String(requestUrl.searchParams.get("player") || requestUrl.searchParams.get("playerId") || "").trim();

      if (!id) {
        response.status(400).json({ error: "Missing share id." });
        return;
      }

      const playerFilter = playerId ? `&player_id=eq.${encodeURIComponent(playerId)}` : "";
      const rows = await supabaseRequest(`evaluation_shares?select=id,player_id,payload,expires_at&id=eq.${encodeURIComponent(id)}${playerFilter}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
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
