const { signedWalletFromRequest } = require("./_wallet-proof");
const { supabaseConfig, supabaseRequest } = require("./_supabase");

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

  const wallet = await signedWalletFromRequest(request, {
    allowAccountProofFallback: true,
    warning: "Could not verify Dapper wallet opt-in proof.",
  });

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
