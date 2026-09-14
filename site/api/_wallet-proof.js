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

async function verifyWalletProof(proof = {}, options = {}) {
  const wallet = normalizeWalletAddress(proof.walletAddress || proof.address);
  const signingWallet = normalizeWalletAddress(proof.signingAddress || wallet);
  const message = String(proof.message || "");
  const proofType = String(proof.proofType || proof.type || "user-signature");
  const appIdentifier = String(proof.appIdentifier || walletAccessMessage());
  const nonce = String(proof.nonce || "");
  const signatures = Array.isArray(proof.signatures) ? proof.signatures : [];
  const expectedMessage = String(options.expectedMessage ?? walletAccessMessage());
  const expectedAppIdentifier = String(options.expectedAppIdentifier ?? walletAccessMessage());
  const expectedNonce = options.expectedNonce === undefined ? null : String(options.expectedNonce);
  const warning = options.warning === false
    ? ""
    : String(options.warning || "Could not verify Dapper wallet proof.");

  if (!/^0x[0-9a-f]{16}$/.test(wallet)
      || signingWallet !== wallet
      || message !== expectedMessage
      || appIdentifier !== expectedAppIdentifier
      || !["account-proof", "user-signature"].includes(proofType)
      || !signatures.length) {
    return "";
  }

  if (proofType === "account-proof"
      && (!/^[0-9a-f]{64}$/i.test(nonce)
        || (expectedNonce !== null && nonce.toLowerCase() !== expectedNonce.toLowerCase()))) {
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

async function signedWalletFromRequest(request, options = {}) {
  const headers = request?.headers || {};
  let signatures;
  try {
    signatures = JSON.parse(String(headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

  return verifyWalletProof({
    walletAddress: headers["x-dapper-wallet-address"],
    signingAddress: headers["x-wallet-signing-address"],
    message: headers["x-wallet-message"],
    proofType: headers["x-wallet-proof-type"],
    appIdentifier: headers["x-wallet-app-identifier"],
    nonce: headers["x-wallet-nonce"],
    signatures,
  }, options);
}

module.exports = {
  normalizeWalletAddress,
  walletAccessMessage,
  verifyWalletProof,
  signedWalletFromRequest,
};
