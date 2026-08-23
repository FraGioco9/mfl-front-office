const { supabaseRequest } = require("./_supabase");

async function touchWalletLastSeen(wallet) {
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
    lastSeenAt: now,
    rows: Array.isArray(rows) ? rows : [],
  };
}

module.exports = { touchWalletLastSeen };
