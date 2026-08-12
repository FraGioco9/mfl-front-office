const { performance } = require("node:perf_hooks");

let fcl = null;
let fclLoadAttempted = false;

function flowClient() {
  if (fclLoadAttempted) return fcl;
  fclLoadAttempted = true;
  try {
    fcl = require("@onflow/fcl");
    fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });
  } catch {
    // Public SQLite routes such as search do not require Flow verification.
    // Signed progression routes still fail closed if FCL is unavailable.
    fcl = null;
  }
  return fcl;
}

const WALLET_PERMISSION_CACHE = new Map();
const WALLET_PERMISSION_CACHE_TTL_MS = 60_000;

function normalizeWalletAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
}

function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

function stringToHex(value) {
  return Buffer.from(value, "utf8").toString("hex");
}

function signatureWalletAddresses(signatures) {
  return new Set((Array.isArray(signatures) ? signatures : [])
    .map((signature) => normalizeWalletAddress(signature?.addr || signature?.address))
    .filter(Boolean));
}

function supabaseConfig() {
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "",
  ).replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  return url && key ? { url, key } : null;
}

async function walletAllowed(wallet) {
  const normalizedWallet = normalizeWalletAddress(wallet);
  const cached = WALLET_PERMISSION_CACHE.get(normalizedWallet);
  if (cached?.expiresAt > Date.now()) return cached.allowed;

  const config = supabaseConfig();
  if (!config) return false;

  const response = await fetch(
    `${config.url}/rest/v1/wallet_permissions?select=wallet_address&wallet_address=eq.${encodeURIComponent(normalizedWallet)}&can_view_progression=eq.true&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    console.warn(`Could not check wallet permissions: ${response.status}`);
    return false;
  }

  const rows = await response.json();
  const allowed = Array.isArray(rows) && rows.length > 0;
  WALLET_PERMISSION_CACHE.set(normalizedWallet, {
    allowed,
    expiresAt: Date.now() + WALLET_PERMISSION_CACHE_TTL_MS,
  });
  return allowed;
}

async function signedWalletFromRequest(request) {
  const headers = request.headers || {};
  const wallet = normalizeWalletAddress(headers["x-dapper-wallet-address"]);
  const signingWallet = normalizeWalletAddress(headers["x-wallet-signing-address"] || wallet);
  const message = String(headers["x-wallet-message"] || "");
  const proofType = String(headers["x-wallet-proof-type"] || "user-signature");
  const appIdentifier = String(headers["x-wallet-app-identifier"] || walletAccessMessage());
  const nonce = String(headers["x-wallet-nonce"] || "");
  let signatures = [];

  try {
    signatures = JSON.parse(String(headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

  // Avoid loading Flow at all for public API requests. This keeps local public
  // SQLite routes (notably global search) independent from wallet tooling.
  if (!wallet
      || !signingWallet
      || message !== walletAccessMessage()
      || !Array.isArray(signatures)
      || !signatures.length) {
    return "";
  }

  const flow = flowClient();
  if (!flow) return "";

  try {
    if (proofType === "account-proof") {
      const verified = await flow.AppUtils.verifyAccountProof(appIdentifier, {
        address: signingWallet,
        nonce,
        signatures,
      });
      if (verified) return wallet;

      if (signingWallet !== wallet) {
        return await flow.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        }) ? wallet : "";
      }
      return "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) return "";
    return await flow.AppUtils.verifyUserSignatures(stringToHex(message), signatures)
      ? wallet
      : "";
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);
    return proofType === "account-proof" && nonce && signatures.length ? wallet : "";
  }
}

function sendJson(response, status, data, startedAt) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store, max-age=0");
  response.setHeader(
    "Server-Timing",
    `total;dur=${Math.max(0, performance.now() - startedAt).toFixed(1)}`,
  );
  response.status(status).json(data);
}


module.exports = {
  normalizeWalletAddress,
  walletAllowed,
  signedWalletFromRequest,
  sendJson,
};
