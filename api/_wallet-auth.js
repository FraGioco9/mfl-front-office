const { normalizeWalletAddress } = require("./_wallet-proof");
const { createWalletSessionStore } = require("./_wallet-session");

const WALLET_SESSION_COOKIE = "mfl_wallet_session";
const WALLET_CHALLENGE_COOKIE = "mfl_wallet_challenge";

function cookieValue(request, name) {
  const raw = String(request?.headers?.cookie || "");
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return "";
}

async function signedWalletFromRequest(request, options = {}) {
  const sessionToken = cookieValue(request, WALLET_SESSION_COOKIE);
  if (!sessionToken) return "";

  try {
    const session = await createWalletSessionStore().resolveSession(sessionToken);
    return normalizeWalletAddress(session?.walletAddress);
  } catch (error) {
    if (options.warning !== false) {
      console.warn(String(options.warning || "Could not resolve Dapper wallet session."), error);
    }
    return "";
  }
}

module.exports = {
  WALLET_SESSION_COOKIE,
  WALLET_CHALLENGE_COOKIE,
  cookieValue,
  normalizeWalletAddress,
  signedWalletFromRequest,
};
