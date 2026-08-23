let fcl = null;
let fclLoadAttempted = false;

const WALLET_ACCESS_MESSAGE = "MFL Front Office Dapper Opt-In";

function flowClient() {
  if (fclLoadAttempted) return fcl;
  fclLoadAttempted = true;
  try {
    fcl = require("@onflow/fcl");
    fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });
  } catch {
    fcl = null;
  }
  return fcl;
}

function normalizeWalletAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
}

function walletAccessMessage() {
  return WALLET_ACCESS_MESSAGE;
}

function signatureWalletAddresses(signatures) {
  return new Set((Array.isArray(signatures) ? signatures : [])
    .map((signature) => normalizeWalletAddress(signature?.addr || signature?.address))
    .filter(Boolean));
}

function stringToHex(value) {
  return Buffer.from(value, "utf8").toString("hex");
}

async function signedWalletFromRequest(request, options = {}) {
  const headers = request?.headers || {};
  const wallet = normalizeWalletAddress(headers["x-dapper-wallet-address"]);
  const signingWallet = normalizeWalletAddress(headers["x-wallet-signing-address"] || wallet);
  const message = String(headers["x-wallet-message"] || "");
  const proofType = String(headers["x-wallet-proof-type"] || "user-signature");
  const appIdentifier = String(headers["x-wallet-app-identifier"] || walletAccessMessage());
  const nonce = String(headers["x-wallet-nonce"] || "");
  const allowAccountProofFallback = options.allowAccountProofFallback === true;
  const warning = options.warning === false
    ? ""
    : String(options.warning || "Could not verify Dapper wallet proof.");
  let signatures = [];

  try {
    signatures = JSON.parse(String(headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

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
    if (warning) console.warn(warning, error);
    return allowAccountProofFallback
      && proofType === "account-proof"
      && nonce
      && signatures.length
      ? wallet
      : "";
  }
}

module.exports = {
  normalizeWalletAddress,
  walletAccessMessage,
  signedWalletFromRequest,
};
