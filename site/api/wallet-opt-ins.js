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

  if (!wallet || !signingWallet || message !== walletAccessMessage(wallet, signingWallet) || !Array.isArray(signatures) || !signatures.length) {
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

        if (walletVerified) {
          return wallet;
        }
      }

      return "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return "";
    }

    return (await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures)) ? wallet : "";
  } catch (error) {
    console.warn("Could not verify Dapper wallet opt-in proof.", error);

    if (proofType === "account-proof") {
      return nonce && signatures.length ? wallet : "";
    }

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

async function writeSupabaseOptIn(wallet) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest("wallet_opt_ins?on_conflict=wallet_address", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([{
      wallet_address: wallet,
      last_seen_at: now,
    }]),
  });

  return {
    recorded: true,
    storage: "supabase",
    wallet_count: Array.isArray(rows) ? rows.length : 0,
  };
}

async function recordOptIn(wallet) {
  if (!supabaseConfig()) {
    throw new Error("Supabase opt-in logging is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }

  return writeSupabaseOptIn(wallet);
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const wallet = await verifyWalletProof(request);

  if (!wallet) {
    response.status(401).json({ error: "Invalid wallet proof." });
    return;
  }

  try {
    response.status(200).json({ wallet, ...(await recordOptIn(wallet)) });
  } catch (error) {
    console.warn("Could not record Dapper wallet opt-in.", error);
    response.status(202).json({ wallet, recorded: false, warning: "Opt-in was accepted, but Supabase could not be updated." });
  }
};