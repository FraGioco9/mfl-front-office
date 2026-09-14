const { signedWalletFromRequest, walletAllowed } = require("./_data-auth");

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.status(405).json({ allowed: false });
    return;
  }

  const wallet = await signedWalletFromRequest(request);
  response.status(200).json({
    allowed: Boolean(wallet && await walletAllowed(wallet)),
  });
};
