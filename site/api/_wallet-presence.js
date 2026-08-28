const { queryOne } = require("./_database");
const { supabaseRequest } = require("./_supabase");

function agentNameForWallet(wallet) {
  const row = queryOne(
    "SELECT name FROM wallets WHERE lower(wallet_address) = lower(?) LIMIT 1",
    [wallet],
  );
  return String(row?.name || "").trim();
}

async function touchWalletLastSeen(wallet) {
  const now = new Date().toISOString();
  const agentName = agentNameForWallet(wallet);
  const presence = {
    wallet_address: wallet,
    last_seen_at: now,
  };
  if (agentName) presence.agent_name = agentName;

  const rows = await supabaseRequest("wallet_opt_ins?on_conflict=wallet_address", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([presence]),
  });

  return {
    lastSeenAt: now,
    rows: Array.isArray(rows) ? rows : [],
  };
}

module.exports = { touchWalletLastSeen };
