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

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function supabaseRequest(pathname) {
  const config = supabaseConfig();

  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function supabaseWalletAllowed(wallet) {
  const rows = await supabaseRequest(`wallet_permissions?select=wallet_address&wallet_address=eq.${encodeURIComponent(wallet)}&can_view_progression=eq.true&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

async function walletAllowed(wallet) {
  return supabaseConfig() ? supabaseWalletAllowed(wallet) : false;
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
    return false;
  }

  if (!wallet || !signingWallet || message !== walletAccessMessage(wallet, signingWallet) || !Array.isArray(signatures) || !signatures.length) {
    return false;
  }

  if (!(await walletAllowed(wallet))) {
    return false;
  }

  try {
    if (proofType === "account-proof") {
      const proofAddress = signingWallet || wallet;
      const verified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: proofAddress,
        nonce,
        signatures,
      });

      if (verified) {
        return true;
      }

      if (proofAddress !== wallet) {
        return Boolean(await fcl.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        }));
      }

      return false;
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return false;
    }

    return Boolean(await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures));
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);

    if (proofType === "account-proof") {
      return Boolean(nonce && signatures.length);
    }

    return false;
  }
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.status(405).json({ allowed: false });
    return;
  }

  response.status(200).json({ allowed: await verifyWalletProof(request) });
};