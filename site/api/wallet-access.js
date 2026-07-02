const fs = require("node:fs/promises");
const path = require("node:path");
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

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next possible Vercel/local path.
    }
  }

  return null;
}

async function allowedWallets() {
  const permissionsPath = await findFile([
    path.join(__dirname, "wallet-permissions.json"),
    path.join(process.cwd(), "api", "wallet-permissions.json"),
    path.join(process.cwd(), "site", "api", "wallet-permissions.json"),
  ]);

  if (!permissionsPath) {
    return new Set();
  }

  try {
    const data = JSON.parse(await fs.readFile(permissionsPath, "utf8"));
    const wallets = Array.isArray(data.wallets) ? data.wallets : [];
    return new Set(wallets.map(normalizeWalletAddress).filter(Boolean));
  } catch {
    return new Set();
  }
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

  if (!signatureWalletAddresses(signatures).has(signingWallet)) {
    return false;
  }

  const whitelist = await allowedWallets();
  if (!whitelist.has(wallet)) {
    return false;
  }

  try {
    if (proofType === "account-proof") {
      return Boolean(await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: signingWallet,
        nonce,
        signatures,
      }));
    }

    return Boolean(await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures));
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);
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