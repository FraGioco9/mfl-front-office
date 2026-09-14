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
  const warning = options.warning === false
    ? ""
    : String(options.warning || "Could not verify Dapper wallet proof.");
  let signatures;

  try {
    signatures = JSON.parse(String(headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

  if (!/^0x[0-9a-f]{16}$/.test(wallet)
      || signingWallet !== wallet
      || message !== walletAccessMessage()
      || !["account-proof", "user-signature"].includes(proofType)
      || !Array.isArray(signatures)
      || !signatures.length) {
    return "";
  }

  if (proofType === "account-proof"
      && (appIdentifier !== walletAccessMessage() || !/^[0-9a-f]{64}$/i.test(nonce))) {
    return "";
  }

  // FCL derives a user-signature's verification address from the first entry.
  // Account proofs instead verify every key against the explicit wallet below.
  if (proofType === "user-signature" && signatures.some((signature) => !signature
      || typeof signature !== "object"
      || Array.isArray(signature)
      || normalizeWalletAddress(signature.addr || signature.address) !== wallet)) {
    return "";
  }

  const flow = flowClient();
  if (!flow) return "";

  try {
    if (proofType === "account-proof") {
      const verified = await flow.AppUtils.verifyAccountProof(appIdentifier, {
        address: wallet,
        nonce,
        signatures,
      });
      return verified === true ? wallet : "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) return "";
    const verified = await flow.AppUtils.verifyUserSignatures(stringToHex(message), signatures);
    return verified === true ? wallet : "";
  } catch (error) {
    if (warning) console.warn(warning, error);
    return "";
  }
}

module.exports = {
  normalizeWalletAddress,
  walletAccessMessage,
  signedWalletFromRequest,
};
